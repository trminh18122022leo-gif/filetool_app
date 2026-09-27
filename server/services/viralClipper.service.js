'use strict';

/**
 * viralClipper.service.js — Dịch vụ tự động phân tích video dài và tạo TikTok / Shorts / Reels
 * Tích hợp:
 * 1. Groq Whisper / Faster-Whisper để nhận diện giọng nói & timestamps.
 * 2. Multi-AI Failover (Gemini, Groq, Cerebras...) đóng vai trò Content Director chọn highlight kịch tính.
 * 3. FFmpeg GPU Hardware Acceleration (NVENC/QSV) crop dọc 9:16 với nền mờ và ép phụ đề động.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const videoSvc = require('./video.service');
const speechSvc = require('./speech.service');
const aiSvc = require('./ai.service');
const { stringifySrt } = require('../utils/subtitleCleanup');

const OUT_DIR = path.resolve('outputs');
const UPLOAD_DIR = path.resolve('uploads');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function runFfmpeg(args, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    execFile(ffmpegPath, args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`FFmpeg error: ${error.message}\n${stderr}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

function escapeFilterPath(rawPath) {
  return rawPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\\\\\''")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

const VIRAL_SUBTITLE_STYLES = {
  tiktok: 'Fontname=Arial,FontSize=22,Bold=1,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3.5,Shadow=1.5,Alignment=2,MarginV=160',
  classic: 'Fontname=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=140',
  neon: 'Fontname=Arial,FontSize=22,Bold=1,PrimaryColour=&H00FFFF00,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV=160',
  boxed: 'Fontname=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,BackColour=&H90000000,BorderStyle=4,Outline=0,Shadow=0,Alignment=2,MarginV=150',
};

/**
 * Thuật toán Heuristic dự phòng khi AI không khả dụng hoặc vượt quá hạn mức
 */
function heuristicHighlightDetection(segments, totalDuration) {
  if (!segments || segments.length === 0) {
    const clipEnd = Math.min(totalDuration, 35);
    return [
      {
        id: 1,
        title: 'Khoảnh khắc mở đầu ấn tượng',
        hook: 'Khám phá ngay điểm nổi bật của nội dung',
        start: 0,
        end: clipEnd,
        viralityScore: 85,
        summary: 'Đoạn mở đầu cô đọng, thu hút sự chú ý ngay từ giây đầu tiên.'
      }
    ];
  }

  // Danh sách từ khóa kích thích tính tò mò & cảm xúc (Viral Hooks)
  const viralKeywords = [
    'bí quyết', 'quan trọng', 'lưu ý', 'sai lầm', 'bất ngờ', 'thực ra', 'kinh ngạc',
    'đặc biệt', 'thành công', 'tại sao', 'làm sao', 'cách tốt nhất', 'đừng bao giờ',
    'secret', 'important', 'mistake', 'why', 'how', 'best', 'never', 'truth', 'insane'
  ];

  const targetMinDuration = 20;
  const targetMaxDuration = 55;
  const candidateClips = [];

  let currentChunk = [];
  let chunkStart = segments[0].start;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentChunk.push(seg);
    const curDuration = seg.end - chunkStart;

    if (curDuration >= targetMinDuration && (curDuration >= targetMaxDuration || i === segments.length - 1)) {
      const combinedText = currentChunk.map(s => s.text).join(' ');
      let score = 70;

      // Tính điểm theo từ khóa viral
      for (const kw of viralKeywords) {
        if (combinedText.toLowerCase().includes(kw)) {
          score += 6;
        }
      }

      // Điểm cộng nếu có dấu chấm than hoặc dấu hỏi
      const puncCount = (combinedText.match(/[!?]/g) || []).length;
      score += Math.min(15, puncCount * 4);

      // Điểm cộng theo tốc độ phát âm (từ/giây vừa phải, sinh động)
      const wordCount = combinedText.split(/\s+/).length;
      const wps = wordCount / curDuration;
      if (wps >= 2.0 && wps <= 4.0) score += 8;

      score = Math.min(98, Math.max(72, score));

      candidateClips.push({
        start: Math.round(chunkStart * 10) / 10,
        end: Math.round(seg.end * 10) / 10,
        duration: Math.round(curDuration * 10) / 10,
        score,
        sampleText: combinedText.slice(0, 100) + '...'
      });

      // Nhảy sang cụm tiếp theo có chút gối đầu (overlap)
      currentChunk = [];
      if (i + 1 < segments.length) {
        chunkStart = segments[i + 1].start;
      }
    }
  }

  // Sắp xếp theo điểm số và lấy tối đa 3 clips không trùng lặp quá nhiều
  candidateClips.sort((a, b) => b.score - a.score);
  const selected = candidateClips.slice(0, 3).map((clip, idx) => ({
    id: idx + 1,
    title: `Highlight #${idx + 1}: ${clip.sampleText.slice(0, 35)}...`,
    hook: 'Đoạn cao trào hấp dẫn nhất video với mật độ thông tin cao',
    start: clip.start,
    end: clip.end,
    viralityScore: clip.score,
    summary: clip.sampleText
  }));

  return selected.length > 0 ? selected : [
    {
      id: 1,
      title: 'Đoạn cắt nổi bật',
      hook: 'Nội dung thú vị nhất được chọn lọc tự động',
      start: 0,
      end: Math.min(totalDuration, 40),
      viralityScore: 88,
      summary: 'Trích đoạn hấp dẫn sẵn sàng đăng TikTok / Shorts'
    }
  ];
}

/**
 * 1. Quét video và tự động nhận diện các đoạn Highlight Viral
 */
async function detectHighlights(videoPath, options = {}) {
  const duration = await videoSvc.getVideoDuration(videoPath);
  if (duration <= 0) {
    throw new Error('Không thể xác định thời lượng của video');
  }

  const hasAudio = await videoSvc.hasAudioStream(videoPath);
  if (!hasAudio) {
    throw new Error('Video không có âm thanh để phân tích nội dung');
  }

  // Trích xuất audio 16k
  let audioPath = null;
  let transcribeResult = null;
  try {
    audioPath = await videoSvc.extractAudio16k(videoPath);
    transcribeResult = await speechSvc.transcribeAudio(audioPath, {
      language: options.language || 'auto',
      withTimestamps: true
    });
  } finally {
    if (audioPath && fs.existsSync(audioPath)) {
      try { fs.unlinkSync(audioPath); } catch (_) {}
    }
  }

  let segments = [];
  if (Array.isArray(transcribeResult?.segments) && transcribeResult.segments.length > 0) {
    segments = transcribeResult.segments.map((s, idx) => ({
      id: idx + 1,
      start: s.start,
      end: s.end,
      text: (s.text || '').trim()
    }));
  } else if (transcribeResult?.text) {
    const sentences = transcribeResult.text.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
    const segDur = sentences.length > 0 ? Math.max(2, duration / sentences.length) : 3;
    segments = sentences.map((st, idx) => ({
      id: idx + 1,
      start: idx * segDur,
      end: Math.min(duration, (idx + 1) * segDur),
      text: st.trim()
    }));
  }

  // Nếu video quá ngắn (< 30 giây), trả về 1 clip toàn bộ
  if (duration <= 30) {
    return {
      duration,
      segments,
      detectedLanguage: transcribeResult?.language || 'auto',
      highlights: [
        {
          id: 1,
          title: 'Toàn bộ nội dung video (Độ dài chuẩn Shorts)',
          hook: 'Video có thời lượng hoàn hảo dưới 30s để đăng ngay',
          start: 0,
          end: duration,
          viralityScore: 96,
          summary: transcribeResult?.text?.slice(0, 120) || 'Shorts clip'
        }
      ]
    };
  }

  // Sử dụng AI Content Director phân tích kịch bản
  const transcriptSnippet = segments
    .slice(0, 200) // Giới hạn 200 câu để không vượt context token
    .map(s => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: ${s.text}`)
    .join('\n');

  const systemPrompt = `Bạn là đạo diễn nội dung hàng đầu thế giới chuyên gia phân tích và cắt video dài thành các video ngắn TikTok, YouTube Shorts, Instagram Reels triệu views (Viral Clip Selector).
Nhiệm vụ của bạn:
1. Đọc kịch bản có mốc thời gian (timestamps) của video.
2. Chọn ra đúng 2 đến 3 đoạn hay nhất, kịch tính nhất, giải thích bí quyết, hoặc gây sốc/tò mò nhất.
3. Mỗi đoạn PHẢI có thời lượng từ 20 giây đến 55 giây (end - start trong khoảng 20s - 55s).
4. Các đoạn KHÔNG ĐƯỢC trùng lặp thời gian với nhau.
5. Trả về định dạng JSON thuần túy (không kèm markdown \`\`\`json):
[
  {
    "id": 1,
    "title": "Tiêu đề giật tít bắt tai (dưới 40 ký tự)",
    "hook": "Câu mở đầu tò mò khiến người xem phải dừng lại xem tiếp",
    "start": 15.5,
    "end": 48.0,
    "viralityScore": 95,
    "summary": "Tóm tắt ngắn gọn 1-2 câu vì sao đoạn này viral"
  }
]`;

  let highlights = null;
  try {
    const aiResponse = await aiSvc.callAI(
      `Video tổng thời lượng: ${duration.toFixed(1)} giây.\nKịch bản kèm timestamps:\n${transcriptSnippet}\nHãy chọn 2 đến 3 đoạn clip viral tốt nhất:`,
      { system: systemPrompt, maxTokens: 1200 }
    );

    // Trích xuất JSON an toàn
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        highlights = parsed.map((item, idx) => {
          let s = Math.max(0, parseFloat(item.start) || 0);
          let e = Math.min(duration, parseFloat(item.end) || (s + 30));
          if (e <= s || (e - s) < 15) {
            e = Math.min(duration, s + 30);
          }
          return {
            id: idx + 1,
            title: item.title || `Viral Short #${idx + 1}`,
            hook: item.hook || 'Khoảnh khắc kịch tính nhất',
            start: Math.round(s * 10) / 10,
            end: Math.round(e * 10) / 10,
            viralityScore: Math.min(99, Math.max(70, parseInt(item.viralityScore, 10) || 90)),
            summary: item.summary || ''
          };
        });
      }
    }
  } catch (err) {
    console.warn('[ViralClipper] AI Content Director gặp sự cố hoặc hết quota, chuyển sang Heuristic Engine:', err.message);
  }

  if (!highlights || highlights.length === 0) {
    highlights = heuristicHighlightDetection(segments, duration);
  }

  return {
    duration,
    segments,
    detectedLanguage: transcribeResult?.language || 'auto',
    highlights
  };
}

/**
 * 2. Render một clip ngắn 9:16 (Vertical Shorts) với nền mờ và ép phụ đề nhảy động
 */
async function renderViralShort(videoPath, clip, allSegments = [], options = {}) {
  const {
    subtitleStyle = 'tiktok',
    burnSub = true,
    blurBackground = true,
    aspectRatio = '9:16'
  } = options;

  const startSec = Math.max(0, parseFloat(clip.start) || 0);
  const endSec = parseFloat(clip.end) || (startSec + 30);
  const clipDuration = Math.max(1, endSec - startSec);

  const outFilename = `viral_short_${uuidv4()}.mp4`;
  const outputPath = path.join(OUT_DIR, outFilename);

  // 1. Lọc các segment phụ đề thuộc khoảng thời gian của clip và chỉnh lại mốc bắt đầu về 0
  let srtPath = null;
  const clipCues = [];
  if (Array.isArray(allSegments) && allSegments.length > 0) {
    for (const seg of allSegments) {
      if (seg.end > startSec && seg.start < endSec) {
        clipCues.push({
          id: clipCues.length + 1,
          start: Math.max(0, seg.start - startSec),
          end: Math.min(clipDuration, seg.end - startSec),
          text: seg.text
        });
      }
    }
  }

  if (clipCues.length > 0 && burnSub) {
    const srtContent = stringifySrt(clipCues);
    srtPath = path.join(OUT_DIR, `temp_sub_${uuidv4()}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
  }

  try {
    const encoder = await videoSvc.getBestH264Encoder();

    // 2. Xây dựng Filtergraph:
    // Nền: Scale nhỏ (270x480) để làm mờ cực nhanh (tăng tốc 11x), sau đó phóng lên 1080x1920
    // Tiền cảnh: Scale sắc nét chiều rộng 1080, căn giữa màn hình
    let filterComplex = '';
    const styleStr = VIRAL_SUBTITLE_STYLES[subtitleStyle] || VIRAL_SUBTITLE_STYLES.tiktok;

    if (blurBackground) {
      filterComplex = `[0:v]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=6:6,scale=1080:1920[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`;
    } else {
      filterComplex = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[base]`;
    }

    if (srtPath && fs.existsSync(srtPath)) {
      const escapedSrt = escapeFilterPath(srtPath);
      filterComplex += `;[base]subtitles='${escapedSrt}':force_style='${styleStr}'[vout]`;
    } else {
      filterComplex += `;[base]null[vout]`;
    }

    const args = [
      '-y',
      '-ss', startSec.toString(),
      '-t', clipDuration.toString(),
      '-i', videoPath,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '0:a?',
      ...encoder.args,
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      outputPath
    ];

    await runFfmpeg(args, 300000);

    return {
      filename: outFilename,
      outputPath,
      downloadUrl: `/outputs/${outFilename}`,
      viewUrl: `/outputs/${outFilename}`,
      duration: clipDuration,
      title: clip.title,
      hook: clip.hook,
      score: clip.viralityScore
    };
  } finally {
    if (srtPath && fs.existsSync(srtPath)) {
      try { fs.unlinkSync(srtPath); } catch (_) {}
    }
  }
}

module.exports = {
  detectHighlights,
  renderViralShort,
  VIRAL_SUBTITLE_STYLES
};
