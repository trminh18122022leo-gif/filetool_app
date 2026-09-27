'use strict';

/**
 * tts.service.js — Dịch vụ Chuyển Văn Bản Thành Giọng Nói (Text-to-Speech) Toàn Diện
 * Tích hợp tinh hoa từ:
 * 1. VieNeu-TTS (v3 Turbo 48kHz, 25 giọng bản địa Bắc - Trung - Nam, Thẻ cảm xúc & Pause).
 * 2. CIT Voice Studio (Từ điển phát âm, Smart Cleaner, mốc tạo hàng loạt [P1], [P2]).
 * 3. Microsoft Edge Neural TTS (Động cơ Cloud miễn phí tốc độ cao, đa ngôn ngữ, tự động dự phòng).
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const archiver = require('archiver');

const {
  detectAvailableTtsEngine,
  getVietnameseVoices,
  synthesizeWithVieNeu,
  synthesizeWithCit,
  resolveVoice,
  CURATED_VIENEU_VOICES
} = require('./vieneuConnector');

const {
  cleanTextForSpeech,
  splitBatchParagraphs,
  parsePauseTags,
  adaptEmotionTags,
  applyPronunciationDictionary
} = require('../utils/ttsPreprocessor');

const OUT_DIR = path.resolve('outputs');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Bảng ánh xạ giọng mặc định chất lượng cao cho từng ngôn ngữ
const DEFAULT_LANGUAGE_VOICES = {
  vi: 'vi-VN-NamMinhNeural',
  en: 'en-US-JennyNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-KatjaNeural',
  es: 'es-ES-ElviraNeural',
  ru: 'ru-RU-SvetlanaNeural',
  th: 'th-TH-PremwadeeNeural'
};

function runFfmpeg(args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    execFile(ffmpegPath, args, { timeout }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`FFmpeg error: ${err.message}`));
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Chuẩn hóa mã giọng đọc (hỗ trợ cả Voice 1..25, tên tiếng Việt VieNeu/CIT và mã Edge TTS)
 */
function normalizeVoiceId(voiceId, language = 'vi') {
  if (!voiceId) {
    const langKey = (language || 'vi').toLowerCase().split('-')[0];
    return DEFAULT_LANGUAGE_VOICES[langKey] || DEFAULT_LANGUAGE_VOICES.vi;
  }

  // Nếu là Voice 1..25 hoặc tên VieNeu / CIT: ánh xạ sang Edge Voice fallback tương ứng
  const vLower = voiceId.toLowerCase();
  const isVnVoice = vLower.startsWith('voice') || CURATED_VIENEU_VOICES.some(v => v.rawName.toLowerCase() === vLower || v.id.toLowerCase() === vLower);
  if (isVnVoice) {
    const resolved = resolveVoice(voiceId);
    return resolved.edgeFallback || (resolved.gender === 'female' ? 'vi-VN-HoaiMyNeural' : 'vi-VN-NamMinhNeural');
  }

  // Tên dài Edge TTS
  const match = voiceId.match(/\(([a-zA-Z-]+),\s*([a-zA-Z0-9]+)\)/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return voiceId;
}

/**
 * Tạo một đoạn âm thanh im lặng (silent audio) với thời lượng chính xác
 */
async function generateSilentAudio(durationSec, outputPath) {
  const dur = Math.max(0.1, parseFloat(durationSec) || 0.5).toFixed(2);
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=r=48000:cl=mono',
    '-t', dur.toString(),
    '-c:a', 'pcm_s16le',
    outputPath
  ];
  await runFfmpeg(args, 15000);
  return outputPath;
}

/**
 * Sinh âm thanh bằng Microsoft Edge Neural TTS (kèm timeout và retry)
 */
async function synthesizeWithEdge(text, options = {}, retries = 2) {
  const {
    voiceId,
    language = 'vi',
    rate = '0%',
    pitch = '0Hz',
    volume = '0%'
  } = options;

  const targetVoice = normalizeVoiceId(voiceId, language);
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const filename = `tts_${uuidv4()}.mp3`;
    const filePath = path.join(OUT_DIR, filename);
    const tts = new MsEdgeTTS();

    try {
      await tts.setMetadata(targetVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate, pitch, volume });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Edge TTS request timeout (15s)'));
        }, 15000);

        const writeStream = fs.createWriteStream(filePath);
        audioStream.pipe(writeStream);

        audioStream.once('error', (err) => {
          clearTimeout(timeout);
          writeStream.destroy();
          reject(err);
        });

        writeStream.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        writeStream.once('close', () => {
          clearTimeout(timeout);
          if (writeStream.bytesWritten > 0) {
            resolve(filePath);
          } else {
            reject(new Error('Không nhận được dữ liệu âm thanh từ máy chủ Edge'));
          }
        });
      });

      return { filePath, filename, voiceId: targetVoice, engine: 'edge' };
    } catch (error) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      lastError = error;
      console.warn(`[TTS] Edge thử lần ${attempt}/${retries + 1} thất bại (${targetVoice}):`, error.message);
      if (attempt <= retries) {
        await new Promise(r => setTimeout(r, 600 * attempt));
      }
    }
  }

  throw new Error(`Edge TTS lỗi: ${lastError.message}`);
}

/**
 * 1. Hàm cơ bản: Tạo file âm thanh từ một câu đơn (tương thích 100% với video dubbing)
 */
async function synthesizeSentence(text, options = {}, retries = 2) {
  let cleanText = (text || '').trim();
  if (!cleanText) {
    throw new Error('Nội dung văn bản để chuyển thành giọng nói không được để trống');
  }

  // Áp dụng từ điển phát âm
  cleanText = applyPronunciationDictionary(cleanText);

  const engine = await detectAvailableTtsEngine();
  const requestedVoice = options.voiceId || 'Voice 1';
  const resolvedVoice = resolveVoice(requestedVoice);
  const vLower = requestedVoice.toLowerCase();
  const isVieneuVoice = vLower.startsWith('voice') || CURATED_VIENEU_VOICES.some(v => v.rawName.toLowerCase() === vLower || v.id.toLowerCase() === vLower);

  // 1. Thử sinh qua VieNeu-TTS hoặc CIT Voice Studio nếu khả dụng
  if (engine.type !== 'edge' && (isVieneuVoice || !options.voiceId || options.language === 'vi')) {
    const outWav = path.join(OUT_DIR, `tts_vn_${uuidv4()}.wav`);
    try {
      if (engine.type === 'vieneu') {
        await synthesizeWithVieNeu(cleanText, resolvedVoice.rawName, outWav, options);
      } else if (engine.type === 'cit') {
        await synthesizeWithCit(cleanText, resolvedVoice.rawName, outWav, options);
      }
      return {
        filePath: outWav,
        filename: path.basename(outWav),
        voiceId: resolvedVoice.id,
        voiceName: resolvedVoice.displayName,
        engine: engine.type
      };
    } catch (err) {
      console.warn(`[TTS] Lỗi động cơ ${engine.type} (${err.message}), tự động fallback sang Edge Neural TTS.`);
      if (fs.existsSync(outWav)) {
        try { fs.unlinkSync(outWav); } catch (_) {}
      }
    }
  }

  // 2. Fallback hoặc sinh qua Microsoft Edge Neural TTS
  const edgeSafeText = adaptEmotionTags(cleanText, 'edge');
  const edgeVoice = normalizeVoiceId(requestedVoice, options.language);
  return synthesizeWithEdge(edgeSafeText, { ...options, voiceId: edgeVoice }, retries);
}

/**
 * 2. Hàm nâng cao: Tạo audio hoàn chỉnh từ văn bản dài (Hỗ trợ Thẻ Nghỉ, Cảm xúc, WAV 48kHz / MP3)
 */
async function synthesizeFullText(rawText, options = {}) {
  const {
    voiceId = 'Voice 1',
    format = 'mp3',
    language = 'vi',
    applyDictionary = true,
    smartClean = true
  } = options;

  let text = rawText || '';
  if (smartClean) {
    text = cleanTextForSpeech(text);
  }
  if (applyDictionary) {
    text = applyPronunciationDictionary(text);
  }

  if (!text) {
    throw new Error('Văn bản sau khi xử lý không có nội dung để đọc');
  }

  // Phân tích các thẻ nghỉ [nghỉ 500ms], [nghỉ 2s]
  const parsedParts = parsePauseTags(text);
  const tempClips = [];

  try {
    for (let i = 0; i < parsedParts.length; i++) {
      const part = parsedParts[i];
      if (part.type === 'pause') {
        const pauseWav = path.join(OUT_DIR, `pause_${uuidv4()}.wav`);
        await generateSilentAudio(part.durationSec, pauseWav);
        tempClips.push(pauseWav);
      } else {
        const sentenceResult = await synthesizeSentence(part.content, {
          voiceId,
          language
        });
        tempClips.push(sentenceResult.filePath);
      }
    }

    const outExt = format === 'wav' ? 'wav' : 'mp3';
    const finalFilename = `speech_${uuidv4()}.${outExt}`;
    const finalPath = path.join(OUT_DIR, finalFilename);

    if (tempClips.length === 1 && path.extname(tempClips[0]).toLowerCase() === `.${outExt}`) {
      // Nếu chỉ có 1 file và đúng định dạng, copy trực tiếp
      fs.copyFileSync(tempClips[0], finalPath);
    } else {
      // Ghép nhiều đoạn (hoặc convert định dạng) qua FFmpeg concat filter
      const inputs = [];
      const filterInputs = [];
      tempClips.forEach((p, idx) => {
        inputs.push('-i', p);
        filterInputs.push(`[${idx}:a]`);
      });

      const filterComplex = `${filterInputs.join('')}concat=n=${tempClips.length}:v=0:a=1[aout]`;
      const codecArgs = outExt === 'wav'
        ? ['-c:a', 'pcm_s16le', '-ar', '48000']
        : ['-c:a', 'libmp3lame', '-b:a', '192k'];

      const args = [
        '-y',
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[aout]',
        ...codecArgs,
        finalPath
      ];

      await runFfmpeg(args, 180000);
    }

    return {
      filePath: finalPath,
      filename: finalFilename,
      downloadUrl: `/outputs/${finalFilename}`,
      viewUrl: `/outputs/${finalFilename}`,
      format: outExt,
      voiceId
    };
  } finally {
    for (const clip of tempClips) {
      if (fs.existsSync(clip) && !clip.includes('speech_')) {
        try { fs.unlinkSync(clip); } catch (_) {}
      }
    }
  }
}

/**
 * 3. Tạo hàng loạt file âm thanh theo các mốc [P1], [P2] và đóng gói ZIP (Học tập từ CIT Voice Studio)
 */
async function synthesizeBatchParagraphs(rawText, options = {}) {
  const chunks = splitBatchParagraphs(rawText);
  if (chunks.length === 0) {
    throw new Error('Không tìm thấy nội dung văn bản để tạo hàng loạt');
  }

  const generatedFiles = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const audioResult = await synthesizeFullText(chunk.text, options);
      generatedFiles.push({
        id: chunk.id,
        filename: `${chunk.id}_${audioResult.filename}`,
        path: audioResult.filePath,
        sampleText: chunk.text.slice(0, 80) + '...'
      });
    }

    // Đóng gói thành file ZIP
    const zipFilename = `tts_batch_${uuidv4()}.zip`;
    const zipPath = path.join(OUT_DIR, zipFilename);
    const outputStream = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    await new Promise((resolve, reject) => {
      outputStream.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(outputStream);

      for (const item of generatedFiles) {
        archive.file(item.path, { name: `${item.id}.mp3` });
      }
      archive.finalize();
    });

    return {
      zipFilename,
      downloadUrl: `/outputs/${zipFilename}`,
      totalParts: chunks.length,
      parts: generatedFiles
    };
  } finally {
    // Không xóa ngay file đơn để người dùng vẫn có thể tải riêng từng file nếu muốn
  }
}

module.exports = {
  DEFAULT_LANGUAGE_VOICES,
  normalizeVoiceId,
  synthesizeSentence,
  synthesizeFullText,
  synthesizeBatchParagraphs,
  getVietnameseVoices,
  detectAvailableTtsEngine
};
