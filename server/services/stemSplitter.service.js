'use strict';

/**
 * stemSplitter.service.js — Dịch vụ tách lời ca sĩ (Vocals) và Nhạc nền Beat Karaoke (Instrumental)
 * 
 * Sử dụng công nghệ Center-Channel Phase Cancellation & Vocal Formant Bandpass trong FFmpeg:
 * 1. Beat Karaoke: Loại bỏ giọng hát nằm ở giữa kênh stereo, bảo toàn dải trầm (Bass & Kick drum < 180Hz)
 *    và không gian âm thanh nổi stereo (Guitars, Synths, Reverbs).
 * 2. Lời Ca Sĩ: Trích xuất kênh trung tâm (Center Channel) kết hợp bộ lọc dải tần giọng nói người
 *    (200Hz - 5000Hz) và Dynamic Compander để tạo Vocal Acapella sạch.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const OUT_DIR = path.resolve('outputs');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function runFfmpeg(args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const proc = spawn(ffmpegPath, args, { windowsHide: true });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Tách stem quá thời gian (${timeoutMs / 1000}s)`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg tách stem thất bại (mã ${code}): ${stderr.slice(-400)}`));
    });

    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Tách track âm thanh thành 2 stem: Vocal và Instrumental Beat
 * 
 * @param {string} inputPath Đường dẫn file âm thanh hoặc video đầu vào
 * @param {object} options Tùy chọn xử lý
 * @returns {Promise<{ vocalPath: string, beatPath: string, vocalFile: string, beatFile: string }>}
 */
async function splitStems(inputPath, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error('File âm thanh đầu vào không tồn tại');
  }

  const uid = uuidv4().slice(0, 8);
  const vocalFile = `vocal_${uid}.mp3`;
  const beatFile = `beat_karaoke_${uid}.mp3`;
  const vocalPath = path.join(OUT_DIR, vocalFile);
  const beatPath = path.join(OUT_DIR, beatFile);

  // Validate và clamp các dải tần số âm thanh an toàn
  const bassCutoff = Math.min(Math.max(Number(options.bassCutoff) || 180, 50), 350);
  const vocalLow   = Math.min(Math.max(Number(options.vocalLow) || 200, 80), 600);
  const vocalHigh  = Math.min(Math.max(Number(options.vocalHigh) || 5000, 1500), 10000);

  // Filter tách đồng thời cả 2 luồng trong 1 lượt chạy:
  // Luồng 1 (Beat Karaoke): Giữ bass < 180Hz, khử center channel trên phần âm thanh còn lại
  // Luồng 2 (Vocal Acapella): Lấy center channel, lọc dải formant giọng người và compand
  const filterComplex = [
    `[0:a]asplit=2[orig_beat][orig_vocal]`,
    `[orig_beat]asplit=2[b_in][s_in]`,
    `[b_in]lowpass=f=${bassCutoff}[bass]`,
    `[s_in]highpass=f=${bassCutoff},pan=stereo|c0=c0-c1|c1=c1-c0[sides]`,
    `[bass][sides]amix=inputs=2:weights=1 1[beat_out]`,
    `[orig_vocal]pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,highpass=f=${vocalLow},lowpass=f=${vocalHigh},compand=attacks=0.02:decays=0.2:points=-60/-60|-35/-20|0/-1:gain=3[vocal_out]`,
  ].join(';');

  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[beat_out]',
    '-c:a', 'libmp3lame',
    '-b:a', '256k',
    beatPath,
    '-map', '[vocal_out]',
    '-c:a', 'libmp3lame',
    '-b:a', '256k',
    vocalPath,
  ];

  await runFfmpeg(args);

  return {
    vocalPath,
    beatPath,
    vocalFile,
    beatFile,
  };
}

module.exports = {
  splitStems,
};
