'use strict';

/**
 * pronunciationDict.js — Từ điển phát âm tiếng Việt thông minh (Học tập từ CIT Voice Studio & VieNeu-TTS)
 * Giúp chuẩn hóa các từ viết tắt, tên tổ chức, thuật ngữ công nghệ và đơn vị tiền tệ trước khi đọc
 */

const fs = require('fs');
const path = require('path');

const DICT_FILE = path.resolve('uploads', 'pronunciation_dict.json');

// Bộ từ điển phát âm mặc định phong phú
const DEFAULT_PRONUNCIATION_MAP = {
  // Đơn vị & Cơ quan phổ biến
  'KTX': 'ký túc xá',
  'SGK': 'sách giáo khoa',
  'TPHCM': 'Thành phố Hồ Chí Minh',
  'Tp.HCM': 'Thành phố Hồ Chí Minh',
  'TP.HCM': 'Thành phố Hồ Chí Minh',
  'HN': 'Hà Nội',
  'ĐH': 'Đại học',
  'THPT': 'Trung học phổ thông',
  'THCS': 'Trung học cơ sở',
  'UBND': 'Ủy ban nhân dân',
  'HĐND': 'Hội đồng nhân dân',
  'BHXH': 'Bảo hiểm xã hội',
  'BHYT': 'Bảo hiểm y tế',
  'CCCD': 'Căn cước công dân',
  'CMND': 'Chứng minh nhân dân',
  'CSGT': 'Cảnh sát giao thông',
  'PCCC': 'Phòng cháy chữa cháy',

  // Học hàm, học vị, nghề nghiệp
  'BS': 'Bác sĩ',
  'TS': 'Tiến sĩ',
  'ThS': 'Thạc sĩ',
  'PGS': 'Phó giáo sư',
  'GS': 'Giáo sư',
  'GĐ': 'Giám đốc',
  'PGĐ': 'Phó giám đốc',
  'CEO': 'xi i ô',
  'CTO': 'xi ti ô',

  // Tiền tệ & Đơn vị
  'VND': 'đồng',
  'VNĐ': 'đồng',
  'USD': 'đô la Mỹ',
  'EUR': 'ơ rô',
  'JPY': 'yên Nhật',
  'km/h': 'ki lô mét trên giờ',
  'm/s': 'mét trên giây',
  'kWh': 'ki lô oát giờ',

  // Công nghệ thông tin
  'AI': 'ây ai',
  'API': 'ây pi ai',
  'CPU': 'xê pê u',
  'GPU': 'giê pê u',
  'RAM': 'ram',
  'ROM': 'rom',
  'SSD': 'ét ét đê',
  'HDD': 'hắt đê đê',
  'URL': 'u rờ lờ',
  'UI': 'u i',
  'UX': 'u ích',
  'PDF': 'pê đê ép',
  'DOCX': 'đốc xơ',
  'HTML': 'hát tê em lờ',
  'CSS': 'xê ét ét',
  'JS': 'giê ét',
  'WAV': 'oáp',
  'MP3': 'mờ pê ba',
  'MP4': 'mờ pê bốn',
  'TTS': 'ti ti ét',
  'STT': 'ét ti ti',
  'COVID-19': 'cô vít mười chín',
  'Covid-19': 'cô vít mười chín',
  'Covid': 'cô vít'
};

let cachedDict = null;

function loadDictionary(forceReload = false) {
  if (cachedDict && !forceReload) {
    return cachedDict;
  }

  if (fs.existsSync(DICT_FILE)) {
    try {
      const content = fs.readFileSync(DICT_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      cachedDict = { ...DEFAULT_PRONUNCIATION_MAP, ...parsed };
      return cachedDict;
    } catch (err) {
      console.warn('[PronunciationDict] Lỗi đọc file từ điển tùy chỉnh, sử dụng mặc định:', err.message);
    }
  }
  cachedDict = { ...DEFAULT_PRONUNCIATION_MAP };
  return cachedDict;
}

function saveDictionary(dict) {
  try {
    const dir = path.dirname(DICT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DICT_FILE, JSON.stringify(dict, null, 2), 'utf-8');
    cachedDict = { ...DEFAULT_PRONUNCIATION_MAP, ...dict };
    return true;
  } catch (err) {
    console.error('[PronunciationDict] Lỗi lưu từ điển:', err.message);
    return false;
  }
}

/**
 * Áp dụng từ điển phát âm vào văn bản
 * Sử dụng ranh giới từ (\b) để tránh thay thế nhầm chuỗi con
 */
function applyPronunciationDictionary(text, customDict = null) {
  if (!text || typeof text !== 'string') return text;
  const dict = customDict || loadDictionary();

  let processed = text;
  for (const [key, replacement] of Object.entries(dict)) {
    if (!key || !replacement) continue;
    // Escape ký tự regex đặc biệt
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<=^|\\s|[.,!?;:"'(\\[{])${escapedKey}(?=$|\\s|[.,!?;:"')\\]}])`, 'g');
    processed = processed.replace(regex, replacement);
  }
  return processed;
}

module.exports = {
  DEFAULT_PRONUNCIATION_MAP,
  loadDictionary,
  saveDictionary,
  applyPronunciationDictionary
};
