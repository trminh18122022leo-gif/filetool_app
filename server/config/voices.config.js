'use strict';

/**
 * voices.config.js — Cấu hình và quản lý danh sách giọng đọc động.
 * 
 * NGUYÊN TẮC:
 * 1. Không chèn sẵn các file âm thanh demo / dummy data làm nặng project.
 * 2. Cung cấp mảng `customVoices` rỗng sẵn sàng để người dùng tự thu thập và tích hợp vào sau.
 * 3. Tự động truy vấn danh sách giọng đọc Neural miễn phí từ Microsoft Edge TTS theo thời gian thực (có bộ nhớ đệm).
 */

const { MsEdgeTTS } = require('msedge-tts');
const { CURATED_VIENEU_VOICES } = require('../services/vieneuConnector');

// Mảng chứa các giọng đọc do bạn tự thu thập và tích hợp sau (tùy chỉnh mô hình / voice cloning)
const customVoices = [];

// Bộ nhớ đệm danh sách giọng Edge-TTS
let cachedEdgeVoices = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 giờ

/**
 * Lấy danh sách giọng đọc của Microsoft Edge Neural TTS
 */
async function fetchEdgeVoices() {
  const now = Date.now();
  if (cachedEdgeVoices && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedEdgeVoices;
  }

  try {
    const tts = new MsEdgeTTS();
    const voices = await tts.getVoices();
    cachedEdgeVoices = voices.map(v => ({
      id: v.Name,
      name: v.FriendlyName ? v.FriendlyName.replace('Microsoft ', '').replace(' Online (Natural) - ', ' (') + ')' : v.Name,
      shortName: v.ShortName,
      locale: v.Locale,
      gender: v.Gender,
      type: 'edge-neural'
    }));
    lastFetchTime = now;
    return cachedEdgeVoices;
  } catch (error) {
    console.warn('[VoicesConfig] Không thể tải danh sách giọng từ Edge TTS:', error.message);
    return cachedEdgeVoices || [];
  }
}

/**
 * Lấy toàn bộ giọng khả dụng theo mã ngôn ngữ (ví dụ: 'vi', 'en', 'ja', 'zh', 'ko'...)
 * Kết hợp giữa giọng 25 VieNeu-TTS Voice 1..25, Edge Neural và customVoices.
 */
async function getVoicesForLanguage(langCode = 'vi') {
  const normalizedLang = langCode.toLowerCase().split('-')[0];
  const allEdgeVoices = await fetchEdgeVoices();

  // Lọc giọng Edge-TTS theo mã ngôn ngữ
  const filteredEdge = allEdgeVoices.filter(v => 
    v.locale.toLowerCase().startsWith(normalizedLang)
  );

  // Lọc giọng custom do người dùng thêm
  let filteredCustom = customVoices.filter(v => 
    (v.locale || '').toLowerCase().startsWith(normalizedLang)
  );

  // Khi ngôn ngữ là tiếng Việt, ưu tiên 25 giọng đọc tuyển chọn Voice 1..25
  if (normalizedLang === 'vi') {
    const vieneuList = CURATED_VIENEU_VOICES.map(v => ({
      id: v.id,
      name: v.displayName,
      locale: 'vi-VN',
      gender: v.gender === 'female' ? 'Female' : 'Male',
      type: 'vieneu-neural',
      style: v.style,
      region: v.region,
      desc: v.desc
    }));
    filteredCustom = [...vieneuList, ...filteredCustom];
  }

  return {
    language: langCode,
    total: filteredCustom.length + filteredEdge.length,
    customVoices: filteredCustom,
    systemVoices: filteredEdge
  };
}

/**
 * Đăng ký thêm giọng đọc mới vào danh sách tùy chỉnh khi bạn thu thập
 */
function registerCustomVoice(voiceDef) {
  if (!voiceDef || !voiceDef.id || !voiceDef.name) {
    throw new Error('Dữ liệu giọng đọc tùy chỉnh phải có ít nhất id và name');
  }
  const existingIdx = customVoices.findIndex(v => v.id === voiceDef.id);
  if (existingIdx >= 0) {
    customVoices[existingIdx] = { ...voiceDef, type: 'custom' };
  } else {
    customVoices.push({ ...voiceDef, type: 'custom' });
  }
  return customVoices;
}

module.exports = {
  customVoices,
  fetchEdgeVoices,
  getVoicesForLanguage,
  registerCustomVoice
};
