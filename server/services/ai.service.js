/**
 * AI Service — 100% Free Stack & Multi-Key Resilient Token Pool:
 *   - Google Gemini: Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro
 *   - Cerebras Cloud LPU (1M tokens/day free, 2000 t/s): Llama 3.3 70B, Llama 3.1 8B
 *   - Groq Cloud LPU (Ultra-Fast free tier): Llama 3.3 70B, Llama 3.1 8B, Qwen 2.5 32B, DeepSeek R1
 *   - OpenRouter Free Tier: Llama 3.3 Free, DeepSeek R1 Free, Gemini 2.0 Free
 *   - Mistral AI Free: Mistral Small, Open Mistral 7B
 *   - GitHub Models Free: GPT-4o Mini, Llama 3.3
 *
 * Tính năng thông minh:
 *   - Hỗ trợ Multi-Key Rotation (nhiều key ngăn cách bởi dấu phẩy trong .env)
 *   - Tự động phát hiện lỗi 429 / Rate Limit / Quota Exceeded và Cooldown 60s
 *   - Tự động Failover thông minh qua các nhà cung cấp miễn phí tiếp theo
 */

'use strict';

const puppeteer  = require('puppeteer');
const pdfParse   = require('pdf-parse');
const fs         = require('fs');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

// ── Multi-Key & Cooldown Management ───────────────────────────────────────────
const cooldownMap = new Map(); // key -> cooldownExpiryTimestamp

function parseKeyPool(envVar) {
  if (!envVar) return [];
  return envVar.split(',').map(k => k.trim()).filter(Boolean);
}

const keyPointers = {
  gemini: 0,
  groq: 0,
  cerebras: 0,
  openrouter: 0,
  mistral: 0,
  github: 0,
};

function getNextKey(provider, envVar) {
  const keys = parseKeyPool(envVar);
  if (!keys.length) return null;

  const now = Date.now();
  const validKeys = keys.filter(k => {
    const expiry = cooldownMap.get(`${provider}:${k}`);
    return !expiry || expiry < now;
  });

  const pool = validKeys.length > 0 ? validKeys : keys;
  const idx = keyPointers[provider] % pool.length;
  keyPointers[provider] = (keyPointers[provider] + 1) % pool.length;
  return pool[idx];
}

function markKeyCooldown(provider, key, durationMs = 60000) {
  if (!key) return;
  console.warn(`[AI Key Pool] Rate Limit/Cooldown kích hoạt cho ${provider} key: ...${key.slice(-6)} trong ${durationMs / 1000}s`);
  cooldownMap.set(`${provider}:${key}`, Date.now() + durationMs);
}

// ── Models & Constants ────────────────────────────────────────────────────────
const GEMINI_PRO_THRESHOLD = 5000;
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-1.5-flash';
const DEFAULT_GROQ_MODEL   = process.env.GROQ_MODEL         || 'llama-3.3-70b-versatile';

// ── 1. Google Gemini API ──────────────────────────────────────────────────────
async function callGemini(userPrompt, opts = {}) {
  const key = getNextKey('gemini', process.env.GOOGLE_AI_API_KEY);
  if (!key) throw new Error('GOOGLE_AI_API_KEY chưa được cấu hình');

  const model     = opts.model || DEFAULT_GEMINI_MODEL;
  const maxTokens = opts.maxTokens || 2048;

  const body = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      topP: 0.9,
    },
  };

  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      markKeyCooldown('gemini', key);
    }
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

// ── 2. Cerebras Cloud LPU (Ultra-Fast 2000 t/s Free) ──────────────────────────
async function callCerebras(userPrompt, opts = {}) {
  const key = getNextKey('cerebras', process.env.CEREBRAS_API_KEY);
  if (!key) throw new Error('CEREBRAS_API_KEY chưa được cấu hình');

  const model     = opts.model || 'llama3.3-70b';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429) markKeyCooldown('cerebras', key);
    throw new Error(`Cerebras API lỗi (${res.status} ${model}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras trả về nội dung rỗng');
  return text.trim();
}

// ── 3. Groq Cloud LPU ─────────────────────────────────────────────────────────
async function callGroq(userPrompt, opts = {}) {
  const key = getNextKey('groq', process.env.GROQ_API_KEY);
  if (!key) throw new Error('GROQ_API_KEY chưa được cấu hình');

  const model     = opts.model || DEFAULT_GROQ_MODEL;
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429 || msg.includes('rate_limit')) {
      markKeyCooldown('groq', key);
    }
    throw new Error(`Groq API lỗi (${res.status} ${model}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq trả về nội dung rỗng');
  return text.trim();
}

// ── 4. OpenRouter Free Tier ───────────────────────────────────────────────────
async function callOpenRouter(userPrompt, opts = {}) {
  const key = getNextKey('openrouter', process.env.OPENROUTER_API_KEY);
  if (!key) throw new Error('OPENROUTER_API_KEY chưa được cấu hình');

  const model     = opts.model || 'meta-llama/llama-3.3-70b-instruct:free';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://filetools.pro',
      'X-Title': 'FileTools Pro',
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
    if (res.status === 429) markKeyCooldown('openrouter', key);
    throw new Error(`OpenRouter API lỗi (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter trả về nội dung rỗng');
  return text.trim();
}

// ── 5. Mistral AI Free ────────────────────────────────────────────────────────
async function callMistral(userPrompt, opts = {}) {
  const key = getNextKey('mistral', process.env.MISTRAL_API_KEY);
  if (!key) throw new Error('MISTRAL_API_KEY chưa được cấu hình');

  const model     = opts.model || 'mistral-small-latest';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429) markKeyCooldown('mistral', key);
    throw new Error(`Mistral API lỗi (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Mistral trả về nội dung rỗng');
  return text.trim();
}

// ── 6. GitHub Models Free ─────────────────────────────────────────────────────
async function callGitHubModels(userPrompt, opts = {}) {
  const key = getNextKey('github', process.env.GITHUB_TOKEN);
  if (!key) throw new Error('GITHUB_TOKEN chưa được cấu hình');

  const model     = opts.model || 'gpt-4o-mini';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429) markKeyCooldown('github', key);
    throw new Error(`GitHub Models API lỗi (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('GitHub Models trả về nội dung rỗng');
  return text.trim();
}

// ── Smart Multi-Provider Failover Router ───────────────────────────────────────
async function callAI(userPrompt, opts = {}) {
  const {
    system        = null,
    forceProvider = null,
    textLength    = 0,
    isHeavyTask   = false,
    maxTokens     = 2048,
  } = opts;

  // 1. Direct forced provider
  if (forceProvider === 'gemini-flash' || forceProvider === 'google-flash') {
    return callGemini(userPrompt, { system, model: 'gemini-1.5-flash', maxTokens });
  }
  if (forceProvider === 'gemini-pro' || forceProvider === 'google-pro') {
    return callGemini(userPrompt, { system, model: 'gemini-1.5-pro', maxTokens });
  }
  if (forceProvider === 'cerebras') {
    return callCerebras(userPrompt, { system, maxTokens });
  }
  if (forceProvider === 'groq') {
    return callGroq(userPrompt, { system, maxTokens });
  }
  if (forceProvider === 'openrouter') {
    return callOpenRouter(userPrompt, { system, maxTokens });
  }
  if (forceProvider === 'mistral') {
    return callMistral(userPrompt, { system, maxTokens });
  }
  if (forceProvider === 'github') {
    return callGitHubModels(userPrompt, { system, maxTokens });
  }

  // 2. Auto Failover Cascade: Gemini -> Cerebras -> Groq -> OpenRouter -> Mistral -> GitHub
  const providers = [
    { name: 'Gemini', fn: () => callGemini(userPrompt, { system, maxTokens, model: textLength > GEMINI_PRO_THRESHOLD ? 'gemini-1.5-pro' : DEFAULT_GEMINI_MODEL }), hasKey: !!process.env.GOOGLE_AI_API_KEY },
    { name: 'Cerebras', fn: () => callCerebras(userPrompt, { system, maxTokens }), hasKey: !!process.env.CEREBRAS_API_KEY },
    { name: 'Groq', fn: () => callGroq(userPrompt, { system, maxTokens }), hasKey: !!process.env.GROQ_API_KEY },
    { name: 'OpenRouter', fn: () => callOpenRouter(userPrompt, { system, maxTokens }), hasKey: !!process.env.OPENROUTER_API_KEY },
    { name: 'Mistral', fn: () => callMistral(userPrompt, { system, maxTokens }), hasKey: !!process.env.MISTRAL_API_KEY },
    { name: 'GitHub', fn: () => callGitHubModels(userPrompt, { system, maxTokens }), hasKey: !!process.env.GITHUB_TOKEN },
  ].filter(p => p.hasKey);

  if (providers.length === 0) {
    throw new Error('Chưa cấu hình API Key AI nào. Hãy thêm GOOGLE_AI_API_KEY, GROQ_API_KEY hoặc CEREBRAS_API_KEY vào .env');
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      return await provider.fn();
    } catch (err) {
      console.warn(`[AI Failover] ${provider.name} lỗi, tự động chuyển sang nhà cung cấp kế tiếp: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('Tất cả các nhà cung cấp AI trong pool đều đang bận hoặc quá tải');
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

// ── Tasks ─────────────────────────────────────────────────────────────────────
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
    textLength: text.length,
    isHeavyTask: text.length > 5000,
    maxTokens: length === 'long' ? 3000 : 1500,
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
    textLength: text.length,
    isHeavyTask: text.length > 4000,
    maxTokens: 4000,
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
    textLength: text.length,
    isHeavyTask: false,
    maxTokens: 1500,
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
  callCerebras,
  callGroq,
  callOpenRouter,
  callMistral,
  callGitHubModels,
  parseKeyPool,
};
