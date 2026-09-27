'use strict';

/**
 * vieneuConnector.js — Bộ kết nối & Điều phối Đa Động Cơ TTS (VieNeu-TTS & CIT Voice Studio)
 * Quản lý chuẩn 25 giọng nói tiếng Việt chuyên nghiệp: Voice 1 đến Voice 25
 * Tự động phát hiện máy chủ cục bộ:
 * - VieNeu-TTS v3 Turbo (48 kHz) tại http://127.0.0.1:8000
 * - CIT Voice Studio tại http://127.0.0.1:8001
 * Tự động chuyển đổi mượt sang Edge Neural TTS khi máy chủ chưa khởi động.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT_DIR = path.resolve('outputs');
const VIENEU_LOCAL_ASSETS = 'C:\\Users\\Admin\\VieNeu-TTS\\src\\vieneu\\assets\\voices_v3_turbo.json';

// Danh sách chuẩn hóa 25 giọng đọc tuyển chọn: Voice 1 đến Voice 25
const CURATED_VIENEU_VOICES = [
  { id: 'Voice 1', name: 'Voice 1', rawName: 'Hải Đăng', alias: 'Hải Đăng', displayName: 'Voice 1 · Nam Bắc (Hải Đăng)', gender: 'male', region: 'Bắc', style: 'tu_nhien', desc: 'Nam · Miền Bắc · Phong cách tự nhiên đời thường, truyền cảm (Rất phổ biến)', featured: 1, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 2', name: 'Voice 2', rawName: 'Trúc Ly', alias: 'Trúc Ly', displayName: 'Voice 2 · Nữ Bắc (Trúc Ly)', gender: 'female', region: 'Bắc', style: 'tu_nhien', desc: 'Nữ · Miền Bắc · Giọng nói nhẹ nhàng, trong trẻo, tự nhiên', featured: 2, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 3', name: 'Voice 3', rawName: 'Thiện Minh', alias: 'Thiện Minh', displayName: 'Voice 3 · Nam Bắc (Thiện Minh)', gender: 'male', region: 'Bắc', style: 'doc_truyen', desc: 'Nam · Miền Bắc · Kể chuyện, podcast sâu lắng, truyền cảm', featured: 3, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 4', name: 'Voice 4', rawName: 'Mai Anh', alias: 'Mai Anh', displayName: 'Voice 4 · Nữ Bắc (Mai Anh)', gender: 'female', region: 'Bắc', style: 'tin_tuc', desc: 'Nữ · Miền Bắc · Bản tin thời sự truyền hình, MC chuyên nghiệp', featured: 4, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 5', name: 'Voice 5', rawName: 'Thùy Dung', alias: 'Thùy Dung', displayName: 'Voice 5 · Nữ Nam (Thùy Dung)', gender: 'female', region: 'Nam', style: 'tin_tuc', desc: 'Nữ · Miền Nam · Thuyết minh tin tức, phóng sự chính luận', featured: 5, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 6', name: 'Voice 6', rawName: 'Xuân Vĩnh', alias: 'Xuân Vĩnh', displayName: 'Voice 6 · Nam Bắc (Xuân Vĩnh)', gender: 'male', region: 'Bắc', style: 'tu_nhien', desc: 'Nam · Miền Bắc · Trầm ấm, thân thiện, quảng cáo, giới thiệu sản phẩm', featured: 6, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 7', name: 'Voice 7', rawName: 'Adam bựa', alias: 'Adam bựa', displayName: 'Voice 7 · Nam Bắc (Adam bựa)', gender: 'male', region: 'Bắc', style: 'hai_huoc', desc: 'Nam · Miền Bắc · Hài hước, review phim dí dỏm, video viral TikTok/Reels', featured: 7, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 8', name: 'Voice 8', rawName: 'Thiền Tâm Đức', alias: 'Thiền Tâm Đức', displayName: 'Voice 8 · Nam Bắc (Thiền Tâm Đức)', gender: 'male', region: 'Bắc', style: 'doc_truyen', desc: 'Nam · Miền Bắc · Giọng thiền, triết lý, sách nói chiêm nghiệm sâu sắc', featured: 8, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 9', name: 'Voice 9', rawName: 'Ngọc Huyền', alias: 'Ngọc Huyền', displayName: 'Voice 9 · Nữ Bắc (Ngọc Huyền)', gender: 'female', region: 'Bắc', style: 'tu_nhien', desc: 'Nữ · Miền Bắc · Giọng đọc tự nhiên, trong sáng, thân thiện', featured: 9, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 10', name: 'Voice 10', rawName: 'Quang Sơn', alias: 'Quang Sơn', displayName: 'Voice 10 · Nam Trung (Quang Sơn)', gender: 'male', region: 'Trung', style: 'tu_nhien', desc: 'Nam · Miền Trung · Dõng dạc, rõ ràng, đậm đà âm hưởng miền Trung', featured: 10, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 11', name: 'Voice 11', rawName: 'Ngọc Trân', alias: 'Ngọc Trân', displayName: 'Voice 11 · Nữ Trung (Ngọc Trân)', gender: 'female', region: 'Trung', style: 'tu_nhien', desc: 'Nữ · Miền Trung · Dịu dàng, đằm thắm, giới thiệu văn hóa du lịch', featured: 11, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 12', name: 'Voice 12', rawName: 'Adam', alias: 'Adam', displayName: 'Voice 12 · Nam Nam (Adam)', gender: 'male', region: 'Nam', style: 'tu_nhien', desc: 'Nam · Miền Nam · Trẻ trung, tự nhiên, gần gũi, đời thường', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 13', name: 'Voice 13', rawName: 'Đoan Trang', alias: 'Đoan Trang', displayName: 'Voice 13 · Nữ Bắc (Đoan Trang)', gender: 'female', region: 'Bắc', style: 'tu_nhien', desc: 'Nữ · Miền Bắc · Duyên dáng, trang nhã, phong thái thanh lịch', featured: null, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 14', name: 'Voice 14', rawName: 'Đức Trí', alias: 'Đức Trí', displayName: 'Voice 14 · Nam Nam (Đức Trí)', gender: 'male', region: 'Nam', style: 'doc_truyen', desc: 'Nam · Miền Nam · Đọc truyện đêm khuya, sách nói truyền cảm', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 15', name: 'Voice 15', rawName: 'Kim Thanh', alias: 'Kim Thanh', displayName: 'Voice 15 · Nữ Nam (Kim Thanh)', gender: 'female', region: 'Nam', style: 'doc_truyen', desc: 'Nữ · Miền Nam · Giọng kể chuyện tâm tình, êm ả miền Tây Nam Bộ', featured: null, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 16', name: 'Voice 16', rawName: 'Minh Đức', alias: 'Minh Đức', displayName: 'Voice 16 · Nam Bắc (Minh Đức)', gender: 'male', region: 'Bắc', style: 'tin_tuc', desc: 'Nam · Miền Bắc · Đọc bản tin thời sự, phóng sự điều tra, tài liệu', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 17', name: 'Voice 17', rawName: 'Minh Triết', alias: 'Minh Triết', displayName: 'Voice 17 · Nam Nam (Minh Triết)', gender: 'male', region: 'Nam', style: 'tin_tuc', desc: 'Nam · Miền Nam · Tin tức dõng dạc, phóng sự thực tế, bình luận thể thao', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 18', name: 'Voice 18', rawName: 'Mỹ Duyên', alias: 'Mỹ Duyên', displayName: 'Voice 18 · Nữ Nam (Mỹ Duyên)', gender: 'female', region: 'Nam', style: 'doc_truyen', desc: 'Nữ · Miền Nam · Đọc truyện ngọt ngào, giọng tâm sự nhẹ nhàng', featured: null, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 19', name: 'Voice 19', rawName: 'Ngọc Linh', alias: 'Ngọc Linh', displayName: 'Voice 19 · Nữ Bắc (Ngọc Linh)', gender: 'female', region: 'Bắc', style: 'doc_truyen', desc: 'Nữ · Miền Bắc · Kể chuyện sâu lắng, cảm xúc, đọc truyện ngắn', featured: null, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 20', name: 'Voice 20', rawName: 'Phạm Tuyên', alias: 'Phạm Tuyên', displayName: 'Voice 20 · Nam Bắc (Phạm Tuyên)', gender: 'male', region: 'Bắc', style: 'tu_nhien', desc: 'Nam · Miền Bắc · Rõ ràng, đĩnh đạc, đọc hướng dẫn và thuyết minh học tập', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 21', name: 'Voice 21', rawName: 'Quốc Tuấn', alias: 'Quốc Tuấn', displayName: 'Voice 21 · Nam Bắc (Quốc Tuấn)', gender: 'male', region: 'Bắc', style: 'tu_nhien', desc: 'Nam · Miền Bắc · Trầm hùng, tự nhiên, video giải trí & vlog trải nghiệm', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 22', name: 'Voice 22', rawName: 'Quỳnh Anh', alias: 'Quỳnh Anh', displayName: 'Voice 22 · Nữ Bắc (Quỳnh Anh)', gender: 'female', region: 'Bắc', style: 'doc_truyen', desc: 'Nữ · Miền Bắc · Truyện ngắn, ấm áp, lời tâm sự thủ thỉ về đêm', featured: null, edgeFallback: 'vi-VN-HoaiMyNeural' },
  { id: 'Voice 23', name: 'Voice 23', rawName: 'Thái Sơn', alias: 'Thái Sơn', displayName: 'Voice 23 · Nam Nam (Thái Sơn)', gender: 'male', region: 'Nam', style: 'doc_truyen', desc: 'Nam · Miền Nam · Kể chuyện hào sảng, truyện dã sử, kiếm hiệp', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 24', name: 'Voice 24', rawName: 'Thanh Bình', alias: 'Thanh Bình', displayName: 'Voice 24 · Nam Bắc (Thanh Bình)', gender: 'male', region: 'Bắc', style: 'doc_truyen', desc: 'Nam · Miền Bắc · Kể chuyện hoài niệm, cổ tích, hồi ký xưa', featured: null, edgeFallback: 'vi-VN-NamMinhNeural' },
  { id: 'Voice 25', name: 'Voice 25', rawName: 'Thục Đoan', alias: 'Thục Đoan', displayName: 'Voice 25 · Nữ Nam (Thục Đoan)', gender: 'female', region: 'Nam', style: 'doc_truyen', desc: 'Nữ · Miền Nam · Êm dịu, ru ngủ, truyện thiếu nhi, tình cảm gia đình', featured: null, edgeFallback: 'vi-VN-HoaiMyNeural' }
];

let cachedEngine = null;
let lastProbeTime = 0;
const PROBE_TTL_MS = 15000; // Kiểm tra lại trạng thái sau mỗi 15 giây

/**
 * Phân giải mã giọng hoặc tên giọng thành đối tượng giọng hoàn chỉnh
 */
function resolveVoice(voiceIdOrName) {
  if (!voiceIdOrName) return CURATED_VIENEU_VOICES[0];
  const query = String(voiceIdOrName).trim();
  const lower = query.toLowerCase();

  // 1. Khớp chính xác ID: "Voice 1" .. "Voice 25"
  let match = CURATED_VIENEU_VOICES.find(v => v.id.toLowerCase() === lower);
  if (match) return match;

  // 2. Khớp rawName hoặc alias: "Hải Đăng", "Trúc Ly"...
  match = CURATED_VIENEU_VOICES.find(v => v.rawName.toLowerCase() === lower || v.alias.toLowerCase() === lower);
  if (match) return match;

  // 3. Khớp tiền tố hoặc chứa tên (vd: "Voice 1 (Hải Đăng)")
  match = CURATED_VIENEU_VOICES.find(v => lower.startsWith(v.id.toLowerCase()) || lower.includes(v.rawName.toLowerCase()));
  if (match) return match;

  // 4. Khớp theo số tự nhiên (1..25)
  const num = parseInt(query.replace(/\D/g, ''), 10);
  if (num >= 1 && num <= CURATED_VIENEU_VOICES.length) {
    return CURATED_VIENEU_VOICES[num - 1];
  }

  return CURATED_VIENEU_VOICES[0];
}

/**
 * Thăm dò cổng kết nối xem máy chủ cục bộ có phản hồi hay không
 */
function probeHttp(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.get({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        timeout: timeoutMs
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.on('error', () => resolve(false));
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Phát hiện động cơ TTS khả dụng trên máy
 */
async function detectAvailableTtsEngine() {
  const now = Date.now();
  if (cachedEngine && (now - lastProbeTime < PROBE_TTL_MS)) {
    return cachedEngine;
  }

  // 1. Thăm dò CIT Voice Studio (Port 8001)
  const isCitUp = await probeHttp('http://127.0.0.1:8001/health', 1200);
  if (isCitUp) {
    cachedEngine = {
      type: 'cit',
      name: 'CIT Voice Studio (Local Offline)',
      baseUrl: 'http://127.0.0.1:8001',
      sampleRate: 48000,
      supportsEmotions: true,
      supportsCloning: true
    };
    lastProbeTime = now;
    return cachedEngine;
  }

  // 2. Thăm dò VieNeu-TTS v3 Turbo OpenAI Server (Port 8000)
  const isVieNeuUp = await probeHttp('http://127.0.0.1:8000/v1/models', 1200);
  if (isVieNeuUp) {
    cachedEngine = {
      type: 'vieneu',
      name: 'VieNeu-TTS v3 Turbo (OpenAI API)',
      baseUrl: 'http://127.0.0.1:8000',
      sampleRate: 48000,
      supportsEmotions: true,
      supportsCloning: true
    };
    lastProbeTime = now;
    return cachedEngine;
  }

  // 3. Fallback sang Edge Neural TTS (Không cần cài đặt, luôn luôn khả dụng)
  cachedEngine = {
    type: 'edge',
    name: 'Microsoft Edge Neural TTS (Cloud Fast)',
    baseUrl: null,
    sampleRate: 24000,
    supportsEmotions: false,
    supportsCloning: false
  };
  lastProbeTime = now;
  return cachedEngine;
}

/**
 * Lấy danh sách toàn bộ 25 giọng nói tiếng Việt chuyên nghiệp
 */
async function getVietnameseVoices() {
  const engine = await detectAvailableTtsEngine();
  const voices = [...CURATED_VIENEU_VOICES];

  return {
    engine,
    total: voices.length,
    voices
  };
}

/**
 * Sinh âm thanh bằng VieNeu-TTS OpenAI API (Port 8000)
 */
async function synthesizeWithVieNeu(text, voiceName, outputPath, options = {}) {
  const resolved = resolveVoice(voiceName);
  const url = 'http://127.0.0.1:8000/v1/audio/speech';
  const payload = {
    model: 'vieneu-v3-turbo',
    input: text,
    voice: resolved.rawName,
    response_format: 'wav',
    sample_rate: options.sampleRate || 48000
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`VieNeu API lỗi (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  return outputPath;
}

/**
 * Sinh âm thanh bằng CIT Voice Studio API (Port 8001)
 */
async function synthesizeWithCit(text, voiceName, outputPath, options = {}) {
  const resolved = resolveVoice(voiceName);
  const url = 'http://127.0.0.1:8001/api/tts/generate';
  const payload = {
    text: text,
    voice_id: resolved.rawName
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`CIT Voice Studio API lỗi (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  return outputPath;
}

module.exports = {
  CURATED_VIENEU_VOICES,
  resolveVoice,
  detectAvailableTtsEngine,
  getVietnameseVoices,
  synthesizeWithVieNeu,
  synthesizeWithCit
};
