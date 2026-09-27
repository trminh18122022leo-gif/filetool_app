'use strict';

/**
 * subtitleTranslator.service.js — Dịch thuật phụ đề theo lô (Context-Aware Batch Translation)
 * 
 * Học tập từ WhisperSubTranslate:
 * 1. Gom nhóm câu thoại theo batch để giữ ngữ cảnh phân cảnh phim/đối thoại.
 * 2. Bảo toàn tên riêng nhân vật, địa danh, thuật ngữ kỹ thuật.
 * 3. Tự động fallback sang MyMemory miễn phí 100% khi chưa có API key hoặc bị rate limit.
 */

const axios = require('axios');
const aiSvc = require('./ai.service');

const LANG_MAP = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
  th: 'Thai'
};

/**
 * Dịch thuật miễn phí qua MyMemory API (Fallback không cần API key)
 */
async function translateWithMyMemory(text, targetLang = 'vi', sourceLang = 'auto') {
  try {
    const from = sourceLang === 'auto' ? 'en' : sourceLang;
    const to = targetLang;
    const url = 'https://api.mymemory.translated.net/get';

    const res = await axios.get(url, {
      params: {
        q: text,
        langpair: `${from}|${to}`,
        de: `filetools_${Math.floor(Math.random() * 1000)}@gmail.com`
      },
      timeout: 15000
    });

    if (res.data?.responseData?.translatedText) {
      const translated = res.data.responseData.translatedText;
      // Tránh trả về các câu cảnh báo quota của MyMemory
      if (!translated.toUpperCase().includes('MYMEMORY WARNING') && !translated.toUpperCase().includes('QUERY LENGTH LIMIT')) {
        return translated;
      }
    }
    return text;
  } catch (err) {
    console.warn('[MyMemory] Lỗi dịch fallback:', err.message);
    return text;
  }
}

/**
 * Dịch một mẻ phụ đề (Batch Cues) qua Gemini hoặc Groq AI
 */
async function translateBatchWithAI(batchCues, targetLang = 'vi') {
  const targetLangName = LANG_MAP[targetLang] || targetLang;

  const payload = batchCues.map(c => ({
    id: c.id,
    text: c.text
  }));

  const systemPrompt = `You are a professional subtitle translation engine specializing in natural, contextual translation to ${targetLangName}.
CRITICAL RULES:
1. Translate to natural, spoken ${targetLangName} that native speakers actually say.
2. PRESERVE proper names, character names, brand names, and place names as-is.
3. Return ONLY a valid JSON array of objects with keys "id" and "text". No markdown fences, no explanation.
Example output format:
[{"id": 1, "text": "Câu dịch 1"}, {"id": 2, "text": "Câu dịch 2"}]`;

  const userPrompt = `Translate the following subtitle items into ${targetLangName}:\n${JSON.stringify(payload, null, 2)}`;

  try {
    const aiResponse = await aiSvc.callAI(userPrompt, {
      system: systemPrompt,
      maxTokens: 2500,
      temperature: 0.2
    });

    // Bóc tách JSON an toàn từ phản hồi của AI (chống nhiễu lời mở đầu/kết luận)
    const cleaned = aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    
    let parsed = null;
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    } else {
      parsed = JSON.parse(cleaned);
    }

    if (Array.isArray(parsed)) {
      const map = new Map(parsed.map(item => [item.id, item.text]));
      return batchCues.map(c => ({
        ...c,
        translatedText: map.get(c.id) || c.text
      }));
    }
    throw new Error('Định dạng JSON trả về không phải mảng');
  } catch (err) {
    console.warn('[SubtitleTranslator] AI batch lỗi, chuyển sang fallback:', err.message);

    // Fallback: dịch từng câu qua MyMemory
    const fallbackResults = [];
    for (const cue of batchCues) {
      const translated = await translateWithMyMemory(cue.text, targetLang);
      fallbackResults.push({
        ...cue,
        translatedText: translated || cue.text
      });
    }
    return fallbackResults;
  }
}

/**
 * Dịch toàn bộ danh sách phụ đề theo từng mẻ (Chunks)
 * @param {Array<object>} cues - Danh sách cues [{ id, start, end, text }]
 * @param {string} targetLang - Ngôn ngữ đích ('vi', 'en', 'ja', 'zh'...)
 * @param {object} options - Tùy chọn batchSize
 */
async function translateSubtitles(cues, targetLang = 'vi', options = {}) {
  if (!Array.isArray(cues) || cues.length === 0) return [];

  // Clamp batchSize giữa 1 và 50 để chống Infinite Loop DoS khi options.batchSize <= 0
  const batchSize = Math.min(Math.max(parseInt(options.batchSize, 10) || 10, 1), 50);
  const safeTargetLang = LANG_MAP[targetLang] ? targetLang : (LANG_MAP[targetLang.toLowerCase()] ? targetLang.toLowerCase() : 'vi');
  const translatedCues = [];

  for (let i = 0; i < cues.length; i += batchSize) {
    const batch = cues.slice(i, i + batchSize);
    const translatedBatch = await translateBatchWithAI(batch, safeTargetLang);
    translatedCues.push(...translatedBatch);
  }

  return translatedCues.map(c => ({
    ...c,
    originalText: c.text,
    text: c.translatedText || c.text
  }));
}

module.exports = {
  LANG_MAP,
  translateWithMyMemory,
  translateSubtitles
};
