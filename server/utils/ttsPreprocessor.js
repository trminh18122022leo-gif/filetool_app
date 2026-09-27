'use strict';

/**
 * ttsPreprocessor.js — Bộ tiền xử lý văn bản chuyên sâu cho giọng nói AI
 * Học tập từ CIT Voice Studio & VieNeu-TTS:
 * 1. Làm sạch văn bản thông minh (Smart Cleaner).
 * 2. Phân tích Thẻ Nghỉ [nghỉ 500ms], [nghỉ 2s].
 * 3. Phân tích Thẻ Cảm Xúc [cười], [thở dài], [hắng giọng].
 * 4. Phân tách mốc [P1], [P2]... để tạo file hàng loạt.
 */

const { applyPronunciationDictionary } = require('./pronunciationDict');

/**
 * Làm sạch văn bản nhưng bảo toàn công thức toán và dấu câu
 */
function cleanTextForSpeech(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Chuẩn hóa xuống dòng Windows \r\n thành \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Nối các dòng ngắt ngang giữa câu (thường gặp khi copy từ PDF)
  // Nếu dòng kết thúc không phải dấu chấm, hỏi, than, hai chấm thì nối với dòng sau
  text = text.replace(/([^\n.!?:]+)\n([a-zà-ỹ0-9])/gi, '$1 $2');

  // 3. Xóa các ký tự đầu dòng như gạch đầu dòng, dấu hoa thị, chấm tròn
  text = text.replace(/^[ \t]*[-*•–—]\s*/gm, '');

  // 4. Xóa khoảng trắng thừa liên tiếp
  text = text.replace(/[ \t]+/g, ' ');

  // 5. Chuẩn hóa khoảng trống trước dấu câu
  text = text.replace(/\s+([.,!?;:])/g, '$1');

  // 6. Xóa các dòng trống liên tiếp (tối đa 2 dòng ngắt đoạn)
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Phân tích các mốc [P1], [P2]... để tạo file âm thanh hàng loạt
 * @returns {Array<{ id: string, text: string }>}
 */
function splitBatchParagraphs(text) {
  if (!text) return [];

  const pattern = /\[P(\d+)\]/gi;
  if (!pattern.test(text)) {
    return [{ id: 'P1', text: text.trim() }];
  }

  // Tách theo mốc [P1], [P2]
  const chunks = [];
  const regex = /\[P(\d+)\]([\s\S]*?)(?=\[P\d+\]|$)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const num = match[1];
    const content = match[2].trim();
    if (content.length > 0) {
      chunks.push({
        id: `P${num}`,
        text: content
      });
    }
  }

  return chunks.length > 0 ? chunks : [{ id: 'P1', text: text.trim() }];
}

/**
 * Phân tích thẻ nghỉ [nghỉ 500ms], [nghỉ 2s] và tách thành các đoạn text kèm thời gian pause
 * @returns {Array<{ type: 'text'|'pause', content: string, durationSec?: number }>}
 */
function parsePauseTags(text) {
  if (!text) return [];

  const parts = [];
  const pauseRegex = /\[nghỉ\s+(\d+(?:\.\d+)?)\s*(ms|s|giây)?\]/gi;
  let lastIndex = 0;
  let match;

  while ((match = pauseRegex.exec(text)) !== null) {
    const preText = text.slice(lastIndex, match.index).trim();
    if (preText.length > 0) {
      parts.push({ type: 'text', content: preText });
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    let sec = unit === 'ms' ? value / 1000 : value;
    sec = Math.min(10, Math.max(0.1, sec)); // Giới hạn tối đa 10s

    parts.push({ type: 'pause', content: match[0], durationSec: sec });
    lastIndex = pauseRegex.lastIndex;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining.length > 0) {
    parts.push({ type: 'text', content: remaining });
  }

  return parts;
}

/**
 * Chuẩn hóa thẻ cảm xúc tùy theo engine:
 * - VieNeu / CIT: Giữ nguyên [cười], [thở dài], [hắng giọng]
 * - Edge TTS: Chuyển thành dấu câu hoặc làm sạch để tránh đọc thô ký tự ngoặc vuông
 */
function adaptEmotionTags(text, engineType = 'vieneu') {
  if (!text) return '';

  if (engineType === 'vieneu' || engineType === 'cit') {
    // VieNeu-TTS v3 Turbo hỗ trợ trực tiếp các tag này trong tokenizer
    return text;
  }

  // Edge TTS fallback: biến tag thành khoảng lặng tự nhiên
  return text
    .replace(/\[cười\]/gi, '... ')
    .replace(/\[thở dài\]/gi, '... ')
    .replace(/\[hắng giọng\]/gi, '... ');
}

module.exports = {
  cleanTextForSpeech,
  splitBatchParagraphs,
  parsePauseTags,
  adaptEmotionTags,
  applyPronunciationDictionary
};
