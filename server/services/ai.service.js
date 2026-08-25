/**
 * AI Service — 100% Free Stack:
 *   - Google Gemini (Primary): Gemini 1.5 Flash, Gemini 1.5 Pro, Gemini 2.0 Flash
 *   - Groq Cloud (Free Backup / Ultra-Fast): Llama 3.3 70B, Llama 3.1 8B
 *   - OpenRouter (Free Fallback): Llama 3.3 / DeepSeek R1 Free
 *
 * callAI() tự động định tuyến thông minh theo độ dài văn bản và tự động fallback.
 */

'use strict';

const puppeteer  = require('puppeteer');
const pdfParse   = require('pdf-parse');
const fs         = require('fs');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

// ── Constants & Models ────────────────────────────────────────────────────────
const GEMINI_PRO_THRESHOLD = 5000; // Văn bản > 5000 ký tự tự động dùng Pro

const DEFAULT_GEMINI_FLASH = process.env.GEMINI_FLASH_MODEL || 'gemini-1.5-flash';
const DEFAULT_GEMINI_PRO   = process.env.GEMINI_PRO_MODEL   || 'gemini-1.5-pro';
const DEFAULT_GROQ_MODEL   = process.env.GROQ_MODEL         || 'llama-3.3-70b-versatile';

// ── 1. Google Gemini API (PRIMARY) ────────────────────────────────────────────
/**
 * Gọi Google Gemini API trực tiếp qua REST endpoint của Google AI Studio.
 * Docs: https://ai.google.dev/api/generate-content
 */
async function callGemini(userPrompt, opts = {}) {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error('GOOGLE_AI_API_KEY chưa được cấu hình trong .env (Lấy miễn phí tại aistudio.google.com)');

  const model     = opts.model     || DEFAULT_GEMINI_FLASH;
  const maxTokens = opts.maxTokens || 2048;

  const body = {
    contents: [
      {
        role:  'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature:     0.7,
      topP:            0.9,
    },
  };

  if (opts.system) {
    body.systemInstruction = {
      parts: [{ text: opts.system }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    throw new Error(`Gemini API lỗi (${res.status} ${model}): ${msg}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const reason = data.promptFeedback?.blockReason;
    throw new Error(`Gemini không trả về kết quả${reason ? ` (bị chặn: ${reason})` : ''}`);
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini trả về nội dung rỗng');

  return text.trim();
}

// ── 2. Groq Cloud API (FREE BACKUP & ULTRA-FAST) ──────────────────────────────
/**
 * Gọi Groq Cloud API (LPU Inference - Tốc độ 500+ tokens/s, 100% Free).
 * Docs: https://console.groq.com/docs/api-reference
 */
async function callGroq(userPrompt, opts = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY chưa được cấu hình trong .env (Lấy miễn phí tại console.groq.com)');

  const model     = opts.model     || DEFAULT_GROQ_MODEL;
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) {
    messages.push({ role: 'system', content: opts.system });
  }
  messages.push({ role: 'user', content: userPrompt });

  const body = {
    model,
    messages,
    max_tokens:  maxTokens,
    temperature: 0.7,
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    throw new Error(`Groq API lỗi (${res.status} ${model}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq trả về nội dung rỗng');

  return text.trim();
}

// ── 3. OpenRouter API (FREE FALLBACK) ─────────────────────────────────────────
/**
 * Gọi OpenRouter Free Models (DeepSeek R1 free, Llama 3.3 free).
 */
async function callOpenRouter(userPrompt, opts = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY chưa được cấu hình trong .env (Lấy miễn phí tại openrouter.ai)');

  const model     = opts.model     || 'meta-llama/llama-3.3-70b-instruct:free';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) {
    messages.push({ role: 'system', content: opts.system });
  }
  messages.push({ role: 'user', content: userPrompt });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer':  'https://filetools.pro',
      'X-Title':       'FileTools Pro',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    throw new Error(`OpenRouter API lỗi (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter trả về nội dung rỗng');

  return text.trim();
}

// ── 4. Smart Multi-Model Router ───────────────────────────────────────────────
/**
 * Router tự động:
 *   1. Nếu user chỉ định provider cụ thể ('gemini-flash' | 'gemini-pro' | 'groq' | 'openrouter') -> dùng trực tiếp.
 *   2. Mặc định 'auto':
 *      - Thử Google Gemini (Flash cho văn bản ngắn, Pro cho văn bản dài > 5000 ký tự).
 *      - Nếu Gemini lỗi (hết quota, timeout) -> Fallback sang Groq Cloud (Llama 3.3 70B).
 *      - Nếu Groq lỗi -> Fallback sang OpenRouter Free.
 */
async function callAI(userPrompt, opts = {}) {
  const {
    system        = null,
    forceProvider = null,
    textLength    = 0,
    isHeavyTask   = false,
    maxTokens     = 2048,
  } = opts;

  const hasGoogle     = !!process.env.GOOGLE_AI_API_KEY;
  const hasGroq       = !!process.env.GROQ_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

  // 1. Force Gemini Flash
  if (forceProvider === 'gemini-flash' || forceProvider === 'google-flash') {
    if (!hasGoogle) throw new Error('GOOGLE_AI_API_KEY chưa được cấu hình');
    return callGemini(userPrompt, { system, model: DEFAULT_GEMINI_FLASH, maxTokens });
  }

  // 2. Force Gemini Pro
  if (forceProvider === 'gemini-pro' || forceProvider === 'google-pro') {
    if (!hasGoogle) throw new Error('GOOGLE_AI_API_KEY chưa được cấu hình');
    return callGemini(userPrompt, { system, model: DEFAULT_GEMINI_PRO, maxTokens });
  }

  // 3. Force Groq (Llama 3.3 70B)
  if (forceProvider === 'groq') {
    if (!hasGroq) throw new Error('GROQ_API_KEY chưa được cấu hình');
    return callGroq(userPrompt, { system, model: DEFAULT_GROQ_MODEL, maxTokens });
  }

  // 4. Force OpenRouter
  if (forceProvider === 'openrouter') {
    if (!hasOpenRouter) throw new Error('OPENROUTER_API_KEY chưa được cấu hình');
    return callOpenRouter(userPrompt, { system, maxTokens });
  }

  // 5. Tự động (Auto Mode): Ưu tiên Google Gemini
  if (hasGoogle) {
    const selectedModel = (textLength > GEMINI_PRO_THRESHOLD || isHeavyTask)
      ? DEFAULT_GEMINI_PRO
      : DEFAULT_GEMINI_FLASH;

    console.log(`[AI Router] ${textLength} chars -> Google Gemini (${selectedModel})`);

    try {
      return await callGemini(userPrompt, { system, model: selectedModel, maxTokens });
    } catch (geminiErr) {
      console.warn(`[AI Router] Gemini lỗi, thử Groq Llama 3.3: ${geminiErr.message}`);

      if (hasGroq) {
        try {
          console.log('[AI Router] Fallback -> Groq Llama 3.3 70B');
          return await callGroq(userPrompt, { system, maxTokens });
        } catch (groqErr) {
          console.warn(`[AI Router] Groq lỗi, thử OpenRouter: ${groqErr.message}`);
        }
      }

      if (hasOpenRouter) {
        console.log('[AI Router] Fallback -> OpenRouter Free');
        return await callOpenRouter(userPrompt, { system, maxTokens });
      }

      throw geminiErr; // Không có fallback khả dụng
    }
  }

  // Chỉ có Groq
  if (hasGroq) {
    console.log('[AI Router] Chỉ có Groq key -> Groq Llama 3.3 70B');
    return callGroq(userPrompt, { system, maxTokens });
  }

  // Chỉ có OpenRouter
  if (hasOpenRouter) {
    console.log('[AI Router] Chỉ có OpenRouter key -> OpenRouter Free');
    return callOpenRouter(userPrompt, { system, maxTokens });
  }

  throw new Error(
    'Chưa cấu hình AI API Key. Thêm GOOGLE_AI_API_KEY (Lấy miễn phí tại https://aistudio.google.com) ' +
    'hoặc GROQ_API_KEY (Lấy miễn phí tại https://console.groq.com) vào .env'
  );
}

// ── Trích xuất text từ PDF ────────────────────────────────────────────────────
async function extractText(filePath, maxChars = 12000) {
  const bytes  = fs.readFileSync(filePath);
  const parsed = await pdfParse(bytes);
  const text   = parsed.text.trim();
  if (!text) {
    throw new Error(
      'Không đọc được text từ file. PDF có thể là tài liệu scan — hãy dùng công cụ OCR trước.'
    );
  }
  return text.slice(0, maxChars);
}

// ── Task Functions ────────────────────────────────────────────────────────────
async function summarize(filePath, opts = {}) {
  const { language = 'vi', length = 'medium', forceProvider = null } = opts;

  const text = await extractText(filePath);
  const lenMap = {
    short:  '3–5 câu ngắn gọn, súc tích',
    medium: '2–3 đoạn văn rõ ràng, đầy đủ ý chính',
    long:   '5–7 đoạn văn chi tiết kèm danh sách gạch đầu dòng',
  };

  const lang   = language === 'vi' ? 'tiếng Việt' : 'English';
  const system = `Bạn là chuyên gia phân tích và tóm tắt tài liệu. Luôn viết phản hồi bằng ${lang}. Tóm tắt súc tích, làm nổi bật thông tin cốt lõi.`;
  const prompt = `Tóm tắt nội dung sau theo định dạng (${lenMap[length] || lenMap.medium}):\n\n${text}`;

  return callAI(prompt, {
    system,
    forceProvider,
    textLength:  text.length,
    isHeavyTask: text.length > 5000,
    maxTokens:   length === 'long' ? 3000 : 1500,
  });
}

async function translate(filePath, opts = {}) {
  const { targetLang = 'en', forceProvider = null } = opts;

  const text = await extractText(filePath, 8000);

  const LANG_NAMES = {
    vi: 'Tiếng Việt',    en: 'English',
    zh: 'Tiếng Trung',   ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',     fr: 'Tiếng Pháp',
    de: 'Tiếng Đức',     es: 'Tiếng Tây Ban Nha',
    th: 'Tiếng Thái',    ru: 'Tiếng Nga',
  };

  const targetName = LANG_NAMES[targetLang] || targetLang;
  const system     = `Bạn là chuyên gia dịch thuật đa ngôn ngữ. Dịch chính xác, giữ nguyên cấu trúc đoạn văn, số liệu, danh sách. Chỉ trả về bản dịch, không giải thích.`;
  const prompt     = `Dịch toàn bộ văn bản sau sang ${targetName}. Giữ nguyên cấu trúc xuống dòng và bảng biểu nếu có:\n\n${text}`;

  return callAI(prompt, {
    system,
    forceProvider,
    textLength:  text.length,
    isHeavyTask: text.length > 4000,
    maxTokens:   4000,
  });
}

async function chat(filePath, question, opts = {}) {
  if (!question?.trim()) throw new Error('Câu hỏi không được để trống');
  const { forceProvider = null } = opts;

  const text = await extractText(filePath);

  const system = `Bạn là trợ lý thông minh hỗ trợ hỏi đáp tài liệu. Trả lời câu hỏi DỰA TRÊN tài liệu được cung cấp.
Nếu tài liệu không đề cập đến thông tin đó, hãy nói rõ: "Tài liệu không đề cập đến vấn đề này."
Trả lời ngắn gọn, rành mạch, dùng cùng ngôn ngữ với câu hỏi.`;

  const prompt = `TÀI LIỆU:\n${text}\n\n---\nCÂU HỎI: ${question.trim()}`;

  return callAI(prompt, {
    system,
    forceProvider,
    textLength:  text.length,
    isHeavyTask: false,
    maxTokens:   1500,
  });
}

async function renderHandwriting(text, opts = {}) {
  const { style = 'casual', fontSize = 18 } = opts;

  const FONT_MAP = {
    casual:   'Caveat',
    elegant:  'Dancing+Script',
    print:    'Patrick+Hand',
    childish: 'Schoolbell',
    messy:    'Indie+Flower',
  };

  const fontName   = FONT_MAP[style] || 'Caveat';
  const fontImport = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;700&display=swap`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="${fontImport}" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: '${fontName.replace('+', ' ')}', cursive;
      font-size:   ${fontSize}px;
      line-height: 2;
      padding:     60px;
      background:  #fffef9;
      color:       #1a1a2e;
      max-width:   800px;
    }
  </style>
</head>
<body>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const outPath = path.join(OUT, `handwriting_${uuidv4()}.pdf`);
    await page.pdf({
      path:   outPath,
      format: 'A4',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    return outPath;
  } finally {
    await browser.close();
  }
}

module.exports = {
  summarize,
  translate,
  chat,
  renderHandwriting,
  callAI,
  callGemini,
  callGroq,
  callOpenRouter,
};
