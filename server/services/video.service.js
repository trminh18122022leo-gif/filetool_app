'use strict';

/**
 * video.service.js — Dịch vụ xử lý Video và Phụ đề đa năng bằng FFmpeg
 * 
 * Tích hợp:
 * 1. Các tính năng cốt lõi cho Video Translate (Whisper extraction, burn subtitles, dubbing, audio ducking, single-pass render).
 * 2. 20 tính năng sáng tạo chuẩn CapCut + Adobe Premiere + DaVinci Resolve (Trim, Merge, Compress, Convert, Speed, Color Grading, Split Screen, Frames, Stabilize, GIF, Text Overlay, AI Background Removal, Reverse, Scenes, LUT...).
 * 3. BotocIT Studio: Gỡ Watermark Google Flow / Veo 3 / Omini (delogo inpainting) cho Video & Ảnh hàng loạt.
 * 4. BotocIT Studio: Trình tạo Video Kể Chuyện Nhất Quán (2D Stickman / Storyteller Video Creator) với TTS 25 giọng đọc.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const ttsSvc = require('./tts.service');
const { stringifySrt } = require('../utils/subtitleCleanup');

const OUT_DIR = path.resolve('outputs');
const UPLOAD_DIR = path.resolve('uploads');

[OUT_DIR, UPLOAD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function outPath(suffix = 'mp4') {
  return path.join(OUT_DIR, `video_${uuidv4()}.${suffix}`);
}

/**
 * Helper thực thi lệnh FFmpeg an toàn
 */
function runFfmpeg(args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const proc = spawn(ffmpegPath, args, { windowsHide: true });

    let stderr = '';
    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`FFmpeg xử lý quá thời gian quy định (${timeoutMs / 1000}s)`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg kết thúc với mã lỗi ${code}: ${stderr.slice(-400)}`));
      }
    });

    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Lấy thông tin video đầy đủ (ffprobe)
 */
function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    execFile(ffprobePath, args, (err, stdout, stderr) => {
      if (err) {
        // Fallback đơn giản nếu ffprobe json fail
        return getVideoDuration(filePath).then(dur => {
          resolve({ duration: dur, size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0, width: 1280, height: 720, hasAudio: true });
        }).catch(reject);
      }

      try {
        const meta = JSON.parse(stdout || '{}');
        const video = meta.streams?.find(s => s.codec_type === 'video');
        const audio = meta.streams?.find(s => s.codec_type === 'audio');

        let fps = 30;
        if (video?.r_frame_rate) {
          const parts = video.r_frame_rate.split('/');
          if (parts.length === 2 && Number(parts[1]) > 0) {
            fps = Math.round(Number(parts[0]) / Number(parts[1]));
          } else if (!isNaN(Number(video.r_frame_rate))) {
            fps = Math.round(Number(video.r_frame_rate));
          }
        }

        resolve({
          duration:   parseFloat(meta.format?.duration || video?.duration || 0),
          size:       parseInt(meta.format?.size || 0, 10),
          bitrate:    parseInt(meta.format?.bit_rate || 0, 10),
          format:     meta.format?.format_name || 'mp4',
          width:      video?.width || 1280,
          height:     video?.height || 720,
          fps:        fps || 30,
          videoCodec: video?.codec_name || 'h264',
          audioCodec: audio?.codec_name || null,
          hasAudio:   !!audio,
        });
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

const getInfo = getVideoInfo;

/**
 * Lấy thời lượng video (giây) bằng FFmpeg
 */
function getVideoDuration(videoPath) {
  return new Promise(resolve => {
    const args = ['-i', videoPath];
    const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    execFile(ffmpegPath, args, (err, stdout, stderr) => {
      const output = (stderr || '') + (stdout || '');
      const match = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        const hours = parseFloat(match[1]);
        const mins = parseFloat(match[2]);
        const secs = parseFloat(match[3]);
        resolve(hours * 3600 + mins * 60 + secs);
      } else {
        resolve(0);
      }
    });
  });
}

/**
 * Kiểm tra xem video có luồng âm thanh hay không
 */
function hasAudioStream(videoPath) {
  return new Promise(resolve => {
    const args = ['-i', videoPath];
    const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    execFile(ffmpegPath, args, (err, stdout, stderr) => {
      const output = (stderr || '') + (stdout || '');
      resolve(/Stream #\d+:\d+.*Audio:/.test(output));
    });
  });
}

/**
 * Trích xuất âm thanh từ video sang định dạng WAV 16kHz mono (Chuẩn tối ưu nhất cho Whisper)
 */
async function extractAudio16k(videoPath, outputWavPath = null) {
  const targetPath = outputWavPath || path.join(OUT_DIR, `audio_16k_${uuidv4()}.wav`);
  const args = [
    '-y',
    '-i', videoPath,
    '-vn',
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    targetPath
  ];

  await runFfmpeg(args, 300000);
  return targetPath;
}

/**
 * Format chuỗi đường dẫn file trên Windows để dùng an toàn tuyệt đối trong FFmpeg filtergraph
 */
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

/**
 * Tự động phát hiện bộ mã hóa H.264 phần cứng tốt nhất
 */
let cachedEncoder = null;
async function getBestH264Encoder() {
  if (cachedEncoder) return cachedEncoder;

  const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [
    { name: 'h264_nvenc', args: ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23'] },
    { name: 'h264_qsv',   args: ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-global_quality', '23'] },
    { name: 'h264_amf',   args: ['-c:v', 'h264_amf', '-quality', 'speed'] },
  ];

  for (const cand of candidates) {
    try {
      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, ['-f', 'lavfi', '-i', 'testsrc=duration=0.1:size=64x64:rate=30', ...cand.args, '-f', 'null', '-'], err => {
          if (err) reject(err);
          else resolve();
        });
      });
      cachedEncoder = cand;
      return cand;
    } catch (_) {}
  }

  cachedEncoder = {
    name: 'libx264',
    args: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22']
  };
  return cachedEncoder;
}

/**
 * Các mẫu phong cách phụ đề
 */
const SUBTITLE_STYLES = {
  tiktok: 'Fontname=Arial,FontSize=20,Bold=1,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=35',
  classic: 'Fontname=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.8,Shadow=0.5,Alignment=2,MarginV=25',
  boxed: 'Fontname=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=0,Shadow=0,Alignment=2,MarginV=25',
  neon: 'Fontname=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFF00,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=30'
};

const ALLOWED_STYLES = ['tiktok', 'classic', 'boxed', 'neon'];

/**
 * Ép phụ đề cứng (burn-in hardsub) vào video
 */
async function burnSubtitles(videoPath, srtPath, outputPath = null, options = {}) {
  const safeStyle = ALLOWED_STYLES.includes(options.style) ? options.style : 'classic';
  const styleStr = SUBTITLE_STYLES[safeStyle];
  const escapedSrt = escapeFilterPath(srtPath);
  const encoder = await getBestH264Encoder();
  const out = outputPath || outPath('mp4');

  const filterArg = `subtitles='${escapedSrt}':force_style='${styleStr}'`;

  const args = [
    '-y',
    '-i', videoPath,
    '-vf', filterArg,
    '-c:a', 'copy',
    ...encoder.args,
    '-movflags', '+faststart',
    out
  ];

  await runFfmpeg(args, 600000);
  return { path: out };
}

/**
 * Tạo track âm thanh thuyết minh đồng bộ với xử lý song song
 */
async function buildSynchronizedDubTrack(cues, voiceOptions = {}) {
  const validCues = cues.filter(c => c.text && c.text.trim().length > 0);
  if (validCues.length === 0) {
    throw new Error('Không có nội dung câu phụ đề nào để tạo giọng đọc');
  }

  const tempClips = new Array(validCues.length);
  const CONCURRENCY = 5;

  try {
    for (let i = 0; i < validCues.length; i += CONCURRENCY) {
      const chunk = validCues.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (cue, offset) => {
        const idx = i + offset;
        try {
          const audioResult = await ttsSvc.synthesizeSentence(cue.text, voiceOptions);
          tempClips[idx] = {
            filePath: audioResult.filePath,
            startMs: Math.max(0, Math.round(cue.start * 1000))
          };
        } catch (err) {
          console.warn(`[VideoDub] Bỏ qua câu ${idx + 1} do lỗi TTS (${err.message}). Tạo âm thanh im lặng.`);
          const silenceDuration = Math.max(0.5, (cue.end - cue.start) || 1).toFixed(2);
          const silentPath = path.join(OUT_DIR, `silent_${uuidv4()}.mp3`);
          try {
            await runFfmpeg([
              '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
              '-t', silenceDuration.toString(),
              '-c:a', 'libmp3lame', '-b:a', '64k',
              silentPath
            ], 15000);
            tempClips[idx] = {
              filePath: silentPath,
              startMs: Math.max(0, Math.round(cue.start * 1000))
            };
          } catch (_) {}
        }
      }));
    }

    const validClips = tempClips.filter(c => c && c.filePath);
    if (validClips.length === 0) {
      throw new Error('Không thể tạo file âm thanh lồng tiếng do lỗi kết nối dịch vụ TTS.');
    }

    const outputTrackPath = path.join(OUT_DIR, `dub_track_${uuidv4()}.mp3`);
    const inputs = [];
    const filterParts = [];
    const mixInputs = [];

    validClips.forEach((clip, idx) => {
      inputs.push('-i', clip.filePath);
      filterParts.push(`[${idx}:a]adelay=${clip.startMs}|${clip.startMs}[a${idx}]`);
      mixInputs.push(`[a${idx}]`);
    });

    const filterComplex = `${filterParts.join(';')};${mixInputs.join('')}amix=inputs=${validClips.length}:dropout_transition=0:normalize=0[aout]`;

    const args = [
      '-y',
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[aout]',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      outputTrackPath
    ];

    await runFfmpeg(args, 300000);
    return outputTrackPath;
  } finally {
    for (const clip of tempClips) {
      if (clip?.filePath && fs.existsSync(clip.filePath)) {
        try { fs.unlinkSync(clip.filePath); } catch (_) {}
      }
    }
  }
}

/**
 * Trộn audio thuyết minh mới vào video
 */
async function mergeDubbedAudio(videoPath, dubTrackPath, outputPath, options = {}) {
  const {
    ducking = true,
    origVolume = 0.15,
    muteOriginal = false
  } = options;

  const hasAudio = await hasAudioStream(videoPath);
  const safeVolume = Math.min(Math.max(Number(origVolume) || 0.15, 0), 2.0);
  let args = [];

  if (!hasAudio || muteOriginal) {
    args = [
      '-y',
      '-i', videoPath,
      '-i', dubTrackPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      outputPath
    ];
  } else if (ducking) {
    const filterComplex = `[0:a]volume=${safeVolume}[orig];[orig][1:a]amix=inputs=2:duration=first:dropout_transition=1[aout]`;
    args = [
      '-y',
      '-i', videoPath,
      '-i', dubTrackPath,
      '-filter_complex', filterComplex,
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      outputPath
    ];
  } else {
    const filterComplex = `[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=1[aout]`;
    args = [
      '-y',
      '-i', videoPath,
      '-i', dubTrackPath,
      '-filter_complex', filterComplex,
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      outputPath
    ];
  }

  await runFfmpeg(args, 600000);
  return outputPath;
}

/**
 * Luồng Render tổng hợp siêu tốc (Single-Pass Combined Render)
 */
async function renderFullVideo(videoPath, cues, options = {}) {
  const {
    burnSub = true,
    dubbing = false,
    subtitleStyle = 'tiktok',
    voiceOptions = {},
    ducking = true,
    origVolume = 0.15,
    muteOriginal = false
  } = options;

  const tempFilesToClean = [];

  try {
    const hasAudio = await hasAudioStream(videoPath);
    const safeStyle = ALLOWED_STYLES.includes(subtitleStyle) ? subtitleStyle : 'tiktok';
    const styleStr = SUBTITLE_STYLES[safeStyle];
    const encoder = await getBestH264Encoder();
    const finalVideoPath = path.join(OUT_DIR, `final_processed_${uuidv4()}.mp4`);

    let srtPath = null;
    if (burnSub && cues?.length > 0) {
      const srtContent = stringifySrt(cues);
      srtPath = path.join(OUT_DIR, `temp_sub_${uuidv4()}.srt`);
      fs.writeFileSync(srtPath, srtContent, 'utf-8');
      tempFilesToClean.push(srtPath);
    }

    let dubTrackPath = null;
    if (dubbing && cues?.length > 0) {
      dubTrackPath = await buildSynchronizedDubTrack(cues, voiceOptions);
      tempFilesToClean.push(dubTrackPath);
    }

    if (srtPath && dubTrackPath) {
      const escapedSrt = escapeFilterPath(srtPath);
      const safeVolume = Math.min(Math.max(Number(origVolume) || 0.15, 0), 2.0);

      let audioFilter = '';
      if (!hasAudio || muteOriginal) {
        audioFilter = `[1:a]aformat=sample_rates=44100:channel_layouts=stereo[aout]`;
      } else if (ducking) {
        audioFilter = `[0:a]volume=${safeVolume}[orig];[orig][1:a]amix=inputs=2:duration=first:dropout_transition=1[aout]`;
      } else {
        audioFilter = `[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=1[aout]`;
      }

      const filterComplex = `[0:v]subtitles='${escapedSrt}':force_style='${styleStr}'[vout];${audioFilter}`;

      const args = [
        '-y',
        '-i', videoPath,
        '-i', dubTrackPath,
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-map', '[aout]',
        ...encoder.args,
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-shortest',
        finalVideoPath
      ];

      await runFfmpeg(args, 600000);
      return finalVideoPath;
    }

    if (srtPath) {
      await burnSubtitles(videoPath, srtPath, finalVideoPath, { style: safeStyle });
      return finalVideoPath;
    }

    if (dubTrackPath) {
      await mergeDubbedAudio(videoPath, dubTrackPath, finalVideoPath, {
        ducking,
        origVolume,
        muteOriginal
      });
      return finalVideoPath;
    }

    return videoPath;
  } finally {
    for (const f of tempFilesToClean) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHẦN B: 20 TÍNH NĂNG VIDEO CREATIVE (CAPCUT + ADOBE PREMIERE + DAVINCI)
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. TRIM / CẮT VIDEO ──────────────────────────────────────────────────────
async function trimVideo(filePath, opts = {}) {
  const { start = 0, end, duration } = opts;
  const dur = duration || (end ? (Number(end) - Number(start)) : null);
  const out = outPath('mp4');

  const args = ['-y', '-ss', String(start), '-i', filePath];
  if (dur) args.push('-t', String(dur));
  args.push('-c:v', 'copy', '-c:a', 'copy', out);

  await runFfmpeg(args, 180000);
  return { path: out };
}

// ── 2. GHÉP VIDEO (MERGE) ────────────────────────────────────────────────────
async function mergeVideos(filePaths, opts = {}) {
  const { transition = 'none', transitionDuration = 0.5 } = opts;
  const listFile = path.join(UPLOAD_DIR, `concat_${uuidv4()}.txt`);
  const out = outPath('mp4');

  const listContent = filePaths.map(fp => `file '${fp.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  try {
    if (transition === 'none' || filePaths.length < 2) {
      const args = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        out
      ];
      await runFfmpeg(args, 300000);
    } else {
      // Re-encode với xfade transition
      const infos = await Promise.all(filePaths.map(getVideoInfo));
      const inputs = [];
      filePaths.forEach(fp => inputs.push('-i', fp));

      let filterComplex = '';
      let prev = '[0:v]';
      let offset = 0;
      const tDur = Math.min(Number(transitionDuration) || 0.5, 2.0);

      for (let i = 1; i < filePaths.length; i++) {
        offset += Math.max(0.1, (infos[i - 1].duration || 5) - tDur);
        const curr = `[v${i}]`;
        filterComplex += `${prev}[${i}:v]xfade=transition=${transition}:duration=${tDur}:offset=${offset.toFixed(2)}${i < filePaths.length - 1 ? curr : '[vout]'};`;
        prev = curr;
      }

      // Nối audio
      const audioPointers = filePaths.map((_, i) => `[${i}:a]`).join('');
      filterComplex += `${audioPointers}concat=n=${filePaths.length}:v=0:a=1[aout]`;

      const encoder = await getBestH264Encoder();
      const args = [
        '-y',
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-map', '[aout]',
        ...encoder.args,
        '-c:a', 'aac',
        '-b:a', '192k',
        out
      ];
      await runFfmpeg(args, 600000);
    }
  } finally {
    if (fs.existsSync(listFile)) try { fs.unlinkSync(listFile); } catch (_) {}
  }

  return { path: out, clipCount: filePaths.length };
}

// ── 3. NÉN VIDEO ─────────────────────────────────────────────────────────────
async function compressVideo(filePath, opts = {}) {
  const { quality = 'medium', maxWidth = null, format = 'mp4' } = opts;
  const CRF = { low: 32, medium: 26, high: 20, ultra: 16 };
  const crfVal = CRF[quality] || CRF.medium;
  const out = outPath(format === 'webm' ? 'webm' : 'mp4');

  const args = ['-y', '-i', filePath];
  if (maxWidth) {
    args.push('-vf', `scale='min(${Number(maxWidth)},iw)':-2`);
  }

  if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', String(crfVal), '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', String(crfVal), '-c:a', 'aac', '-b:a', '128k');
  }
  args.push(out);

  await runFfmpeg(args, 400000);

  const origSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 1;
  const newSize  = fs.existsSync(out) ? fs.statSync(out).size : 1;
  return { path: out, origSize, newSize, ratio: Math.max(0, (1 - newSize / origSize) * 100) };
}

// ── 4. CHUYỂN ĐỔI ĐỊNH DẠNG ──────────────────────────────────────────────────
async function convertFormat(filePath, opts = {}) {
  const { format = 'mp4', resolution, fps } = opts;
  const FORMATS = {
    mp4:  { ext: 'mp4',  vcodec: 'libx264',   acodec: 'aac' },
    webm: { ext: 'webm', vcodec: 'libvpx-vp9',acodec: 'libopus' },
    mov:  { ext: 'mov',  vcodec: 'libx264',   acodec: 'aac' },
    avi:  { ext: 'avi',  vcodec: 'mpeg4',     acodec: 'mp3' },
    mkv:  { ext: 'mkv',  vcodec: 'libx264',   acodec: 'aac' },
    gif:  { ext: 'gif',  vcodec: null,        acodec: null },
    mp3:  { ext: 'mp3',  vcodec: null,        acodec: 'libmp3lame', audioOnly: true },
    wav:  { ext: 'wav',  vcodec: null,        acodec: 'pcm_s16le',  audioOnly: true },
  };

  const cfg = FORMATS[format.toLowerCase()] || FORMATS.mp4;
  const out = outPath(cfg.ext);
  const args = ['-y', '-i', filePath];

  if (format.toLowerCase() === 'gif') {
    args.push('-vf', 'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', out);
  } else if (cfg.audioOnly) {
    args.push('-vn', '-c:a', cfg.acodec, out);
  } else {
    const vf = [];
    if (resolution) vf.push(`scale=${resolution}`);
    if (fps) args.push('-r', String(fps));
    if (vf.length > 0) args.push('-vf', vf.join(','));
    args.push('-c:v', cfg.vcodec, '-preset', 'fast', '-crf', '23', '-c:a', cfg.acodec, out);
  }

  await runFfmpeg(args, 400000);
  return { path: out, format };
}

// ── 5. ĐIỀU CHỈNH TỐC ĐỘ ───────────────────────────────────────────────────
async function changeSpeed(filePath, opts = {}) {
  const speed = Number(opts.speed) || 1.0;
  const out = outPath('mp4');

  const atempoFilters = [];
  let remaining = speed;
  while (remaining > 2) { atempoFilters.push('atempo=2.0'); remaining /= 2; }
  while (remaining < 0.5) { atempoFilters.push('atempo=0.5'); remaining *= 2; }
  atempoFilters.push(`atempo=${remaining.toFixed(4)}`);

  const ptsScale = (1 / speed).toFixed(4);
  const args = [
    '-y',
    '-i', filePath,
    '-vf', `setpts=${ptsScale}*PTS`,
    '-af', atempoFilters.join(','),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    out
  ];

  await runFfmpeg(args, 300000);
  return { path: out, speed };
}

// ── 6. THAY THẾ / XÓA ÂM THANH ──────────────────────────────────────────────
async function replaceAudio(videoPath, audioPath, opts = {}) {
  const volume = Number(opts.volume) || 1.0;
  const loop = opts.loop === 'true' || opts.loop === true;
  const out = outPath('mp4');

  let audioFilter = `[1:a]volume=${volume}`;
  if (loop) audioFilter += `,aloop=loop=-1:size=2e+09`;
  audioFilter += '[aout]';

  const args = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-filter_complex', audioFilter,
    '-map', '0:v:0',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    out
  ];

  await runFfmpeg(args, 300000);
  return { path: out };
}

async function removeAudio(filePath) {
  const out = outPath('mp4');
  const args = ['-y', '-i', filePath, '-an', '-c:v', 'copy', out];
  await runFfmpeg(args, 180000);
  return { path: out };
}

// ── 7. CHỈNH MÀU (COLOR GRADING) ────────────────────────────────────────────
async function colorGrade(filePath, opts = {}) {
  const {
    brightness = 0,
    contrast   = 1,
    saturation = 1,
    gamma      = 1,
    hue        = 0,
    vignette   = false,
    sharpen    = false,
    denoise    = false,
    lutFile    = null,
  } = opts;

  const out = outPath('mp4');
  const filters = [`eq=brightness=${Number(brightness)}:contrast=${Number(contrast)}:saturation=${Number(saturation)}:gamma=${Number(gamma)}`];

  if (Number(hue) !== 0) filters.push(`hue=h=${Number(hue)}`);
  if (vignette)  filters.push('vignette=PI/4');
  if (sharpen)   filters.push('unsharp=5:5:1.0:5:5:0.0');
  if (denoise)   filters.push('hqdn3d=4.0:3.0:6.0:4.5');
  if (lutFile && fs.existsSync(lutFile)) filters.push(`lut3d='${escapeFilterPath(lutFile)}'`);

  const encoder = await getBestH264Encoder();
  const args = [
    '-y',
    '-i', filePath,
    '-vf', filters.join(','),
    ...encoder.args,
    '-c:a', 'copy',
    out
  ];

  await runFfmpeg(args, 400000);
  return { path: out };
}

// ── 8. THÊM WATERMARK LOGO LÊN VIDEO ─────────────────────────────────────────
async function addVideoWatermark(videoPath, watermarkPath, opts = {}) {
  const {
    position = 'bottomright',
    opacity  = 0.8,
    scale    = 0.15,
  } = opts;

  const POS = {
    topleft:     '10:10',
    topright:    'W-w-10:10',
    bottomleft:  '10:H-h-10',
    bottomright: 'W-w-10:H-h-10',
    center:      '(W-w)/2:(H-h)/2',
  };

  const out = outPath('mp4');
  const overlayPos = POS[position] || POS.bottomright;

  const filterComplex = `[1:v]scale=iw*${Number(scale)}:-1,format=rgba,colorchannelmixer=aa=${Number(opacity)}[wm];[0:v][wm]overlay=${overlayPos}[vout]`;

  const args = [
    '-y',
    '-i', videoPath,
    '-i', watermarkPath,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'copy',
    out
  ];

  await runFfmpeg(args, 400000);
  return { path: out };
}

// ── 9. SPLIT SCREEN (MÀN HÌNH CHIA ĐÔI / CHIA TƯ) ───────────────────────────
async function splitScreen(filePaths, opts = {}) {
  const { layout = '2x1', width = 1280, height = 720 } = opts;
  const out = outPath('mp4');
  const inputs = [];
  filePaths.forEach(fp => inputs.push('-i', fp));

  let filterComplex = '';
  const w = Number(width);
  const h = Number(height);

  if (layout === '2x1') {
    filterComplex = `[0:v]scale=${Math.round(w / 2)}:${h}[l];[1:v]scale=${Math.round(w / 2)}:${h}[r];[l][r]hstack[vout]`;
  } else if (layout === '1x2') {
    filterComplex = `[0:v]scale=${w}:${Math.round(h / 2)}[t];[1:v]scale=${w}:${Math.round(h / 2)}[b];[t][b]vstack[vout]`;
  } else if (layout === '2x2') {
    filterComplex = `[0:v]scale=${Math.round(w / 2)}:${Math.round(h / 2)}[a];[1:v]scale=${Math.round(w / 2)}:${Math.round(h / 2)}[b];[2:v]scale=${Math.round(w / 2)}:${Math.round(h / 2)}[c];[3:v]scale=${Math.round(w / 2)}:${Math.round(h / 2)}[d];[a][b]hstack[top];[c][d]hstack[bot];[top][bot]vstack[vout]`;
  } else {
    filterComplex = `[0:v]scale=${Math.round(w / 2)}:${h}[l];[1:v]scale=${Math.round(w / 2)}:${h}[r];[l][r]hstack[vout]`;
  }

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    out
  ];

  await runFfmpeg(args, 400000);
  return { path: out };
}

// ── 10. CHỤP FRAMES TỪ VIDEO VÀ NÉN ZIP ──────────────────────────────────────
async function extractFrames(filePath, opts = {}) {
  const { timestamps = [], every = null, format = 'jpg' } = opts;
  const frames = [];
  const tmpDir = path.join(UPLOAD_DIR, `frames_${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    if (every) {
      const fpsRate = 1 / Number(every);
      const outPattern = path.join(tmpDir, `frame_%04d.${format}`);
      const args = ['-y', '-i', filePath, '-vf', `fps=${fpsRate}`, outPattern];
      await runFfmpeg(args, 300000);

      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith(`.${format}`));
      files.forEach(f => frames.push(path.join(tmpDir, f)));
    } else {
      const tsArr = Array.isArray(timestamps) ? timestamps : [1, 3, 5];
      for (const ts of tsArr) {
        const framePath = path.join(tmpDir, `frame_${ts}s.${format}`);
        const args = ['-y', '-ss', String(ts), '-i', filePath, '-vframes', '1', framePath];
        try {
          await runFfmpeg(args, 30000);
          if (fs.existsSync(framePath)) frames.push(framePath);
        } catch (_) {}
      }
    }

    const zipPath = path.join(OUT_DIR, `frames_${uuidv4()}.zip`);
    const outputStream = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    await new Promise((resolve, reject) => {
      outputStream.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(outputStream);
      frames.forEach((f, i) => {
        archive.file(f, { name: `frame_${String(i + 1).padStart(4, '0')}.${format}` });
      });
      archive.finalize();
    });

    return { zipPath, frameCount: frames.length };
  } finally {
    if (fs.existsSync(tmpDir)) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

// ── 11. CHỐNG RUNG VIDEO (STABILIZATION) ──────────────────────────────────────
async function stabilizeVideo(filePath, opts = {}) {
  const { strength = 'medium' } = opts;
  const shakinessMap = { low: 3, medium: 5, high: 8 };
  const shakiness = shakinessMap[strength] || 5;
  const out = outPath('mp4');
  const dataFile = path.join(UPLOAD_DIR, `stab_${uuidv4()}.trf`);
  const escapedDataFile = escapeFilterPath(dataFile);

  try {
    // Pass 1: Phát hiện rung lắc
    const pass1Args = [
      '-y',
      '-i', filePath,
      '-vf', `vidstabdetect=shakiness=${shakiness}:accuracy=15:result='${escapedDataFile}'`,
      '-f', 'null',
      '-'
    ];
    await runFfmpeg(pass1Args, 300000);

    // Pass 2: Khử rung biến hình
    const pass2Args = [
      '-y',
      '-i', filePath,
      '-vf', `vidstabtransform=input='${escapedDataFile}':smoothing=30:crop=black`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'copy',
      out
    ];
    await runFfmpeg(pass2Args, 400000);
    return { path: out };
  } finally {
    if (fs.existsSync(dataFile)) try { fs.unlinkSync(dataFile); } catch (_) {}
  }
}

// ── 12. VIDEO SANG GIF CHẤT LƯỢNG CAO ────────────────────────────────────────
async function videoToGif(filePath, opts = {}) {
  const fps = Number(opts.fps) || 12;
  const width = Number(opts.width) || 480;
  const start = Number(opts.start) || 0;
  const duration = opts.duration ? Number(opts.duration) : null;
  const out = outPath('gif');

  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer`;

  const args = ['-y', '-ss', String(start), '-i', filePath];
  if (duration) args.push('-t', String(duration));
  args.push('-vf', vf, out);

  await runFfmpeg(args, 240000);
  return { path: out };
}

// ── 13. THÊM CHỮ (TEXT OVERLAY) ──────────────────────────────────────────────
async function addTextOverlay(filePath, opts = {}) {
  const {
    text = 'FileTools Pro',
    fontSize = 36,
    fontColor = 'white',
    x = '(w-text_w)/2',
    y = 'h-th-30',
    startTime = 0,
    endTime = null,
    bgColor = 'black@0.5',
  } = opts;

  const out = outPath('mp4');
  let enableClause = '';
  if (endTime) {
    enableClause = `:enable='between(t,${startTime},${endTime})'`;
  } else if (startTime > 0) {
    enableClause = `:enable='gte(t,${startTime})'`;
  }

  const safeText = text.replace(/'/g, "'\\\\\\''").replace(/:/g, '\\:');
  const drawFilter = `drawtext=text='${safeText}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}:box=1:boxcolor=${bgColor}:boxborderw=6${enableClause}`;

  const args = [
    '-y',
    '-i', filePath,
    '-vf', drawFilter,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'copy',
    out
  ];

  await runFfmpeg(args, 300000);
  return { path: out };
}

// ── 14. PHÁT HIỆN CẢNH (SCENE CUT DETECTION) ─────────────────────────────────
async function detectScenes(filePath, opts = {}) {
  const threshold = Number(opts.threshold) || 0.4;
  const scenes = [];

  return new Promise((resolve, reject) => {
    const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const args = [
      '-i', filePath,
      '-vf', `select='gt(scene,${threshold})',showinfo`,
      '-f', 'null',
      '-'
    ];

    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', data => {
      const line = data.toString();
      stderr += line;
      const match = line.match(/pts_time:([0-9.]+)/);
      if (match) {
        const t = parseFloat(match[1]);
        if (!scenes.includes(t)) scenes.push(t);
      }
    });

    proc.on('close', () => {
      resolve({ scenes: scenes.sort((a, b) => a - b), count: scenes.length });
    });

    proc.on('error', reject);
  });
}

// ── 15. ÁP DỤNG 3D LUT (COLOR LOOK-UP TABLE) ─────────────────────────────────
async function applyLUT(filePath, lutPath, opts = {}) {
  const strength = Math.min(Math.max(Number(opts.strength) || 1.0, 0), 1.0);
  const out = outPath('mp4');
  const escapedLut = escapeFilterPath(lutPath);

  const lutFilter = strength < 1.0
    ? `lut3d='${escapedLut}',mix=1,mix=${strength}`
    : `lut3d='${escapedLut}'`;

  const args = [
    '-y',
    '-i', filePath,
    '-vf', lutFilter,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-c:a', 'copy',
    out
  ];

  await runFfmpeg(args, 360000);
  return { path: out };
}

// ── 16. QUAY NGƯỢC VIDEO (REVERSE VIDEO) ────────────────────────────────────
async function reverseVideo(filePath) {
  const out = outPath('mp4');
  const hasAudio = await hasAudioStream(filePath);

  const args = ['-y', '-i', filePath, '-vf', 'reverse'];
  if (hasAudio) {
    args.push('-af', 'areverse');
  }
  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', out);

  await runFfmpeg(args, 400000);
  return { path: out };
}

// ── 17. XÓA BACKGROUND VIDEO (CHROMA KEY / GREEN SCREEN) ──────────────────────
async function chromaKey(filePath, opts = {}) {
  const { color = '0x00b140', similarity = 0.3, blend = 0.15 } = opts;
  const out = outPath('webm');

  const args = [
    '-y',
    '-i', filePath,
    '-vf', `colorkey=${color}:${similarity}:${blend}`,
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0',
    out
  ];

  await runFfmpeg(args, 400000);
  return { path: out };
}

const removeVideoBackground = chromaKey;

// ── 18. XỬ LÝ HÀNG LOẠT (BATCH PROCESSING) ──────────────────────────────────
async function batchProcess(filePaths, operation, operationOpts = {}) {
  const results = [];
  for (const fp of filePaths) {
    try {
      let res;
      switch (operation) {
        case 'compress':   res = await compressVideo(fp, operationOpts); break;
        case 'convert':    res = await convertFormat(fp, operationOpts); break;
        case 'color':      res = await colorGrade(fp, operationOpts); break;
        case 'reverse':    res = await reverseVideo(fp); break;
        case 'speed':      res = await changeSpeed(fp, operationOpts); break;
        case 'watermark':  res = await addVideoWatermark(fp, operationOpts.watermarkPath, operationOpts); break;
        default: throw new Error(`Thao tác không được hỗ trợ: ${operation}`);
      }
      results.push({ file: path.basename(fp), ...res, success: true });
    } catch (err) {
      results.push({ file: path.basename(fp), success: false, error: err.message });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHẦN C: BOTOCIT FEATURES — GỠ WATERMARK GOOGLE FLOW / VEO 3 & STORYTELLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Xóa Watermark Google Flow / Veo 3 / Omini bằng thuật toán FFmpeg delogo inpainting
 * Hỗ trợ tự động tính toán toạ độ mặc định của Google Flow/Veo hoặc toạ độ tuỳ chỉnh.
 */
async function removeWatermark(filePath, opts = {}) {
  const {
    preset = 'google-flow', // 'google-flow' | 'veo3' | 'omini' | 'bottomright' | 'topright' | 'custom'
    x: customX,
    y: customY,
    w: customW,
    h: customH,
  } = opts;

  const info = await getVideoInfo(filePath);
  const vidW = info.width || 1280;
  const vidH = info.height || 720;
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(filePath);
  const out = outPath(isImage ? 'png' : 'mp4');

  let boxW, boxH, boxX, boxY;

  if (preset === 'custom' && customW && customH) {
    boxW = Math.max(10, Math.min(vidW, Number(customW)));
    boxH = Math.max(10, Math.min(vidH, Number(customH)));
    boxX = Math.max(0, Math.min(vidW - boxW, Number(customX || 0)));
    boxY = Math.max(0, Math.min(vidH - boxH, Number(customY || 0)));
  } else if (preset === 'google-flow' || preset === 'veo3') {
    // Logo Google Flow / Veo 3: Thường nằm ở góc dưới bên phải
    boxW = Math.round(vidW * 0.16); // 16% bề ngang
    boxH = Math.round(vidH * 0.075); // 7.5% bề dọc
    boxX = Math.round(vidW - boxW - (vidW * 0.015)); // Cách lề phải 1.5%
    boxY = Math.round(vidH - boxH - (vidH * 0.025)); // Cách lề đáy 2.5%
  } else if (preset === 'omini') {
    // Watermark Omini: Thường nằm ở góc trên bên phải hoặc dưới phải
    boxW = Math.round(vidW * 0.18);
    boxH = Math.round(vidH * 0.08);
    boxX = Math.round(vidW - boxW - (vidW * 0.02));
    boxY = Math.round(vidH - boxH - (vidH * 0.03));
  } else if (preset === 'topright') {
    boxW = Math.round(vidW * 0.16);
    boxH = Math.round(vidH * 0.07);
    boxX = Math.round(vidW - boxW - 15);
    boxY = 15;
  } else if (preset === 'bottomleft') {
    boxW = Math.round(vidW * 0.16);
    boxH = Math.round(vidH * 0.07);
    boxX = 15;
    boxY = Math.round(vidH - boxH - 15);
  } else {
    // Mặc định góc dưới phải
    boxW = Math.round(vidW * 0.16);
    boxH = Math.round(vidH * 0.07);
    boxX = Math.round(vidW - boxW - 15);
    boxY = Math.round(vidH - boxH - 15);
  }

  // Đảm bảo toạ độ chẵn (even) cho bộ codec h264
  boxX = Math.floor(boxX / 2) * 2;
  boxY = Math.floor(boxY / 2) * 2;
  boxW = Math.floor(boxW / 2) * 2;
  boxH = Math.floor(boxH / 2) * 2;

  const delogoFilter = `delogo=x=${boxX}:y=${boxY}:w=${boxW}:h=${boxH}:show=0`;

  if (isImage) {
    const args = ['-y', '-i', filePath, '-vf', delogoFilter, out];
    await runFfmpeg(args, 60000);
  } else {
    const encoder = await getBestH264Encoder();
    const args = [
      '-y',
      '-i', filePath,
      '-vf', delogoFilter,
      ...encoder.args,
      '-c:a', 'copy',
      '-movflags', '+faststart',
      out
    ];
    await runFfmpeg(args, 600000);
  }

  return {
    path: out,
    detectedBox: { x: boxX, y: boxY, w: boxW, h: boxH },
    preset,
    isImage,
  };
}

/**
 * Xử lý gỡ watermark hàng loạt (Batch Watermark Removal)
 */
async function batchRemoveWatermark(filePaths, opts = {}) {
  const results = [];
  for (const fp of filePaths) {
    try {
      const res = await removeWatermark(fp, opts);
      results.push({
        file: path.basename(fp),
        outPath: res.path,
        detectedBox: res.detectedBox,
        success: true,
      });
    } catch (err) {
      results.push({
        file: path.basename(fp),
        success: false,
        error: err.message,
      });
    }
  }
  return results;
}

/**
 * Tạo ảnh nhân vật người que 2D hoặc phong cách truyện tranh dưới dạng SVG / PNG
 */
function createStickmanSvg(sceneText, sceneNumber) {
  // Tạo hình người que 2D hoạt họa tối giản với hành động dựa trên số thứ tự cảnh
  const poses = [
    // Pose 1: Đứng chào
    `<circle cx="640" cy="240" r="60" fill="none" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="300" x2="640" y2="500" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="360" x2="520" y2="440" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="360" x2="740" y2="280" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="500" x2="560" y2="650" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="500" x2="720" y2="650" stroke="#000000" stroke-width="14"/>`,
    // Pose 2: Chạy / di chuyển
    `<circle cx="660" cy="230" r="60" fill="none" stroke="#000000" stroke-width="14"/>
     <line x1="660" y1="290" x2="600" y2="480" stroke="#000000" stroke-width="14"/>
     <line x1="630" y1="350" x2="510" y2="390" stroke="#000000" stroke-width="14"/>
     <line x1="630" y1="350" x2="740" y2="320" stroke="#000000" stroke-width="14"/>
     <line x1="600" y1="480" x2="490" y2="590" stroke="#000000" stroke-width="14"/>
     <line x1="600" y1="480" x2="730" y2="580" stroke="#000000" stroke-width="14"/>`,
    // Pose 3: Đưa tay suy nghĩ
    `<circle cx="640" cy="240" r="60" fill="none" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="300" x2="640" y2="500" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="360" x2="580" y2="270" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="360" x2="720" y2="430" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="500" x2="590" y2="660" stroke="#000000" stroke-width="14"/>
     <line x1="640" y1="500" x2="690" y2="660" stroke="#000000" stroke-width="14"/>
     <circle cx="700" cy="190" r="8" fill="#F59E0B"/>
     <circle cx="725" cy="165" r="14" fill="#F59E0B"/>
     <circle cx="765" cy="135" r="24" fill="#F59E0B"/>`
  ];

  const pose = poses[(sceneNumber - 1) % poses.length];

  return `
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#F3F4F6"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <line x1="100" y1="650" x2="1180" y2="650" stroke="#E5E7EB" stroke-width="6" stroke-linecap="round"/>
      <g>
        ${pose}
      </g>
      <rect x="180" y="40" width="920" height="80" rx="20" fill="#111827" fill-opacity="0.06"/>
      <text x="640" y="90" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1F2937" text-anchor="middle">
        Cảnh ${sceneNumber}
      </text>
    </svg>
  `;
}

/**
 * Trình tạo Video Kể Chuyện Nhất Quán (2D Stickman / Storyteller Video Creator)
 * Tự động tạo kịch bản, giọng đọc tiếng Việt (Voice 1 -> Voice 25), ghép cảnh và xuất video hoàn chỉnh!
 */
async function generateConsistentStory(scenes, opts = {}) {
  const {
    title = 'Câu Chuyện 2D',
    voice = 'Voice 1',
    style = 'stickman_2d',
    musicLoop = false,
  } = opts;

  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('Cần ít nhất một phân cảnh (scene) để tạo video kể chuyện');
  }

  const tempClips = [];
  const sceneVideoPaths = [];

  try {
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const text = sc.text || `Phân cảnh số ${i + 1}`;

      // 1. Tạo audio thuyết minh cho cảnh qua TTS
      const audioRes = await ttsSvc.synthesizeSentence(text, { voice });
      tempClips.push(audioRes.filePath);
      const audioDuration = Math.max(2.5, await getVideoDuration(audioRes.filePath) + 0.5);

      // 2. Tạo hình ảnh cho cảnh (dùng file upload hoặc vẽ 2D stickman SVG)
      let sceneImgPath = sc.imagePath;
      if (!sceneImgPath || !fs.existsSync(sceneImgPath)) {
        const svgContent = createStickmanSvg(text, i + 1);
        const svgPath = path.join(UPLOAD_DIR, `stickman_${i}_${uuidv4()}.svg`);
        fs.writeFileSync(svgPath, svgContent, 'utf-8');
        tempClips.push(svgPath);

        // Render SVG sang PNG bằng FFmpeg
        const pngPath = path.join(UPLOAD_DIR, `stickman_${i}_${uuidv4()}.png`);
        await runFfmpeg(['-y', '-i', svgPath, pngPath], 30000);
        tempClips.push(pngPath);
        sceneImgPath = pngPath;
      }

      // 3. Tạo video clip cho cảnh kèm hiệu ứng phóng to nhẹ (Ken Burns zoom) + Audio + Subtitle
      const clipOut = path.join(OUT_DIR, `scene_${i}_${uuidv4()}.mp4`);
      const escapedImg = escapeFilterPath(sceneImgPath);
      const safeText = text.replace(/'/g, "'\\\\\\''").replace(/:/g, '\\:');

      // Zoom filter nhẹ nhàng
      const vf = `scale=1280:720,zoompan=z='min(zoom+0.0015,1.15)':d=${Math.round(audioDuration * 25)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=25,drawtext=text='${safeText}':fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-text_w)/2:y=h-th-40`;

      const clipArgs = [
        '-y',
        '-loop', '1',
        '-i', sceneImgPath,
        '-i', audioRes.filePath,
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', audioDuration.toFixed(2),
        '-pix_fmt', 'yuv420p',
        clipOut
      ];

      await runFfmpeg(clipArgs, 120000);
      sceneVideoPaths.push(clipOut);
      tempClips.push(clipOut);
    }

    // 4. Ghép toàn bộ các cảnh thành video hoàn chỉnh
    const finalMergeResult = await mergeVideos(sceneVideoPaths, { transition: 'fade', transitionDuration: 0.5 });
    return {
      path: finalMergeResult.path,
      sceneCount: scenes.length,
      title,
    };
  } finally {
    for (const f of tempClips) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  }
}

module.exports = {
  // Existing Video Translate exports
  SUBTITLE_STYLES,
  getVideoDuration,
  hasAudioStream,
  extractAudio16k,
  escapeFilterPath,
  getBestH264Encoder,
  burnSubtitles,
  buildSynchronizedDubTrack,
  mergeDubbedAudio,
  renderFullVideo,

  // 20 Creative Video Tools (CapCut + Adobe + DaVinci)
  getInfo,
  trimVideo,
  mergeVideos,
  compressVideo,
  convertFormat,
  changeSpeed,
  replaceAudio,
  removeAudio,
  colorGrade,
  addVideoWatermark,
  splitScreen,
  extractFrames,
  stabilizeVideo,
  videoToGif,
  addTextOverlay,
  detectScenes,
  applyLUT,
  reverseVideo,
  chromaKey,
  removeVideoBackground,
  batchProcess,

  // BotocIT Features
  removeWatermark,
  batchRemoveWatermark,
  generateConsistentStory,
};
