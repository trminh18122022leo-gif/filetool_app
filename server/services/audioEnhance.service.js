'use strict';

/**
 * audioEnhance.service.js — Dịch vụ lọc tạp âm và nâng cấp âm thanh chuẩn phòng thu
 * 
 * Sử dụng chuỗi bộ lọc FFmpeg chuyên nghiệp (High-pass, Low-pass, FFT De-noise, 
 * Dynamic Multiband Compressor, Treble/Bass EQ, EBU R128 Loudness Normalizer).
 * 
 * Hỗ trợ cả file Âm thanh (MP3, WAV, M4A, OGG) và Video (MP4, MKV, MOV, WEBM).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const OUT_DIR = path.resolve('outputs');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/**
 * Helper thực thi FFmpeg / FFprobe
 */
function runCommand(bin, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' ? `${bin}.exe` : bin;
    const proc = spawn(cmd, args, { windowsHide: true });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`${bin} quá thời gian xử lý (${timeoutMs / 1000}s)`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} thất bại (mã ${code}): ${stderr.slice(-400)}`));
    });

    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Kiểm tra xem file có luồng âm thanh hay không bằng ffprobe
 */
async function hasAudioStream(filePath) {
  try {
    const { stdout } = await runCommand('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    return stdout.trim().length > 0;
  } catch (err) {
    console.warn(`[audioEnhance] ffprobe check audio failed:`, err.message);
    return false;
  }
}

/**
 * Kiểm tra xem file có luồng video hay không
 */
async function hasVideoStream(filePath) {
  try {
    const { stdout } = await runCommand('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Xây dựng filterchain âm thanh theo preset
 */
function buildAudioFilter(options = {}) {
  const {
    preset = 'studio',
    denoiseIntensity = 25, // dB, 15 (nhẹ) -> 40 (mạnh)
    bassBoost = 2,         // dB (0-6)
    trebleBoost = 3,       // dB (0-6)
    normalize = true,
  } = options;

  switch (preset) {
    case 'studio':
      // Phong cách Adobe Podcast AI: ấm, rõ tiếng, lọc sạch tạp âm xung quanh
      return [
        'highpass=f=80',
        'lowpass=f=12000',
        'afftdn=nf=-26:tn=1',
        'bass=g=2.5:f=120',
        'treble=g=3.5:f=3500',
        'compand=attacks=0.02:decays=0.2:points=-80/-80|-45/-25|-20/-10|0/-3:gain=5',
        'loudnorm=I=-16:TP=-1.5:LRA=11',
      ].join(',');

    case 'noise_clean':
      // Khử ồn tối đa: quạt gió, tiếng ve, tiếng xe cộ
      return [
        'highpass=f=90',
        'lowpass=f=11000',
        'afftdn=nf=-32:tn=1:om=o',
        'compand=attacks=0.03:decays=0.25:points=-70/-70|-40/-22|-15/-8|0/-2:gain=4',
        'loudnorm=I=-16:TP=-1.5:LRA=10',
      ].join(',');

    case 'voice_boost':
      // Tăng âm lượng lời nói, làm giọng nói nổi bật và sáng
      return [
        'highpass=f=100',
        'equalizer=f=2800:width_type=h:width=1200:g=4',
        'treble=g=4:f=4000',
        'compand=attacks=0.01:decays=0.15:points=-60/-40|-30/-12|0/-1:gain=6',
        'loudnorm=I=-14:TP=-1.0:LRA=9',
      ].join(',');

    case 'broadcast':
      // Tiêu chuẩn phát thanh podcast & radio quốc tế (-16 LUFS)
      return [
        'highpass=f=75',
        'lowpass=f=13000',
        'afftdn=nf=-22',
        'compand=attacks=0.05:decays=0.25:points=-70/-70|-40/-22|-18/-9|0/-2:gain=3',
        'loudnorm=I=-16:TP=-1.5:LRA=8',
      ].join(',');

    case 'custom':
    default: {
      const nf = Math.min(Math.max(Number(denoiseIntensity) || 25, 10), 50);
      const bG = Math.min(Math.max(Number(bassBoost) || 0, 0), 10);
      const tG = Math.min(Math.max(Number(trebleBoost) || 0, 0), 10);

      const filters = [
        'highpass=f=80',
        'lowpass=f=12500',
        `afftdn=nf=-${nf}`,
      ];

      if (bG > 0) filters.push(`bass=g=${bG}:f=120`);
      if (tG > 0) filters.push(`treble=g=${tG}:f=3500`);

      filters.push('compand=attacks=0.02:decays=0.2:points=-80/-80|-45/-25|-20/-10|0/-3:gain=5');

      if (normalize) {
        filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
      }

      return filters.join(',');
    }
  }
}

/**
 * Xử lý nâng cấp âm thanh / video
 * 
 * @param {string} inputPath Đường dẫn file đầu vào
 * @param {object} options Các tùy chọn xử lý
 * @returns {Promise<{ outputPath: string, outputType: 'audio'|'video', filename: string }>}
 */
async function enhanceMedia(inputPath, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error('File đầu vào không tồn tại');
  }

  const hasAudio = await hasAudioStream(inputPath);
  if (!hasAudio) {
    throw new Error('File không chứa luồng âm thanh nào để xử lý');
  }

  const isVideo = await hasVideoStream(inputPath);
  const filterChain = buildAudioFilter(options);
  const uid = uuidv4().slice(0, 8);

  // Nếu người dùng chọn giữ nguyên video hoặc file là video và outputFormat yêu cầu video
  const wantVideoOutput = isVideo && (options.outputFormat === 'video' || options.outputFormat === 'mp4' || !options.outputFormat);

  if (wantVideoOutput) {
    const outFilename = `enhanced_video_${uid}.mp4`;
    const outputPath = path.join(OUT_DIR, outFilename);

    // Xử lý video: copy luồng hình ảnh, chỉ filter và encode lại luồng âm thanh
    const args = [
      '-y',
      '-i', inputPath,
      '-af', filterChain,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ];

    await runCommand('ffmpeg', args);
    return {
      outputPath,
      outputType: 'video',
      filename: outFilename,
    };
  }

  // Xuất file âm thanh MP3
  const outFilename = `enhanced_audio_${uid}.mp3`;
  const outputPath = path.join(OUT_DIR, outFilename);

  const args = [
    '-y',
    '-i', inputPath,
    '-vn',
    '-af', filterChain,
    '-c:a', 'libmp3lame',
    '-b:a', '256k',
    outputPath,
  ];

  await runCommand('ffmpeg', args);
  return {
    outputPath,
    outputType: 'audio',
    filename: outFilename,
  };
}

module.exports = {
  enhanceMedia,
  hasAudioStream,
  hasVideoStream,
  buildAudioFilter,
};
