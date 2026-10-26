// ai service: ho tro gemini, groq, cerebras, openrouter, mistral, github models
// tu dong xoay key, circuit breaker, byok, page anchoring & grounded qa
'use strict';

const { withPage } = require('../utils/browser');
const pdfParse   = require('pdf-parse');
const fs         = require('fs');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');

const {
  PROVIDER_SPECS,
  normalizeModelName,
  canExecuteProvider,
  recordCircuitSuccess,
  recordCircuitFailure,
  getNormalizedProviderKey,
  resolveExecutionKey,
  segmentDocumentWithPageAnchors,
  formatGroundedPrompt,
  generateStructuredDiff,
  recordAiUsage,
} = require('./aiProviderAdapter');

const OUT = path.resolve('outputs');

// Key pool & cooldown management
const cooldownMap = new Map();

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
  recordCircuitFailure(provider, '429 Rate Limit Cooldown');
}

// ── Models & Constants ────────────────────────────────────────────────────────
const GEMINI_PRO_THRESHOLD = 5000;
const DEFAULT_GEMINI_MODEL = normalizeModelName('gemini', process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash');
const DEFAULT_GEMINI_PRO_MODEL = normalizeModelName('gemini', process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro');
const DEFAULT_GROQ_MODEL   = process.env.GROQ_MODEL         || 'llama-3.3-70b-versatile';

// ── 1. Google Gemini API ──────────────────────────────────────────────────────
async function callGemini(userPrompt, opts = {}) {
  let key = opts.apiKey;
  let isBYOK = Boolean(opts.isBYOK);

  if (!key) {
    if (opts.user) {
      const res = await resolveExecutionKey(opts.user, 'gemini');
      key = res.key;
      isBYOK = res.isBYOK;
    }
    if (!key) {
      const pool = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
      key = getNextKey('gemini', pool);
    }
  }

  if (!key) throw new Error('GOOGLE_AI_API_KEY hoặc GOOGLE_API_KEY chưa được cấu hình');

  const model     = normalizeModelName('gemini', opts.model || DEFAULT_GEMINI_MODEL);
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

  const startTime = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      markKeyCooldown('gemini', key);
    } else {
      recordCircuitFailure('gemini', msg);
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

  recordCircuitSuccess('gemini');
  await recordAiUsage({
    user: opts.user,
    operation: opts.operation || 'chat',
    provider: 'gemini',
    model,
    isBYOK,
    promptTokens: Math.round(userPrompt.length / 4),
    completionTokens: Math.round(text.length / 4),
    latencyMs,
    idempotencyKey: opts.idempotencyKey,
  });

  return text.trim();
}

// ── 2. Cerebras Cloud LPU (Ultra-Fast 2000 t/s) ──────────────────────────────
async function callCerebras(userPrompt, opts = {}) {
  let key = opts.apiKey;
  let isBYOK = Boolean(opts.isBYOK);

  if (!key) {
    if (opts.user) {
      const res = await resolveExecutionKey(opts.user, 'cerebras');
      key = res.key;
      isBYOK = res.isBYOK;
    }
    if (!key) {
      key = getNextKey('cerebras', process.env.CEREBRAS_API_KEY);
    }
  }

  if (!key) throw new Error('CEREBRAS_API_KEY chưa được cấu hình');

  const model     = opts.model || 'llama3.3-70b';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const startTime = Date.now();
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

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429) markKeyCooldown('cerebras', key);
    else recordCircuitFailure('cerebras', msg);
    throw new Error(`Cerebras API lỗi (${res.status} ${model}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras trả về nội dung rỗng');

  recordCircuitSuccess('cerebras');
  await recordAiUsage({
    user: opts.user,
    operation: opts.operation || 'chat',
    provider: 'cerebras',
    model,
    isBYOK,
    promptTokens: Math.round(userPrompt.length / 4),
    completionTokens: Math.round(text.length / 4),
    latencyMs,
    idempotencyKey: opts.idempotencyKey,
  });

  return text.trim();
}

// ── 3. Groq Cloud LPU ─────────────────────────────────────────────────────────
async function callGroq(userPrompt, opts = {}) {
  let key = opts.apiKey;
  let isBYOK = Boolean(opts.isBYOK);

  if (!key) {
    if (opts.user) {
      const res = await resolveExecutionKey(opts.user, 'groq');
      key = res.key;
      isBYOK = res.isBYOK;
    }
    if (!key) {
      key = getNextKey('groq', process.env.GROQ_API_KEY);
    }
  }

  if (!key) throw new Error('GROQ_API_KEY chưa được cấu hình');

  const model     = opts.model || DEFAULT_GROQ_MODEL;
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const startTime = Date.now();
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

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429 || msg.includes('rate_limit')) {
      markKeyCooldown('groq', key);
    } else {
      recordCircuitFailure('groq', msg);
    }
    throw new Error(`Groq API lỗi (${res.status} ${model}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq trả về nội dung rỗng');

  recordCircuitSuccess('groq');
  await recordAiUsage({
    user: opts.user,
    operation: opts.operation || 'chat',
    provider: 'groq',
    model,
    isBYOK,
    promptTokens: Math.round(userPrompt.length / 4),
    completionTokens: Math.round(text.length / 4),
    latencyMs,
    idempotencyKey: opts.idempotencyKey,
  });

  return text.trim();
}

// ── 4. OpenRouter Free Tier ───────────────────────────────────────────────────
async function callOpenRouter(userPrompt, opts = {}) {
  let key = opts.apiKey;
  let isBYOK = Boolean(opts.isBYOK);

  if (!key) {
    if (opts.user) {
      const res = await resolveExecutionKey(opts.user, 'openrouter');
      key = res.key;
      isBYOK = res.isBYOK;
    }
    if (!key) {
      key = getNextKey('openrouter', process.env.OPENROUTER_API_KEY);
    }
  }

  if (!key) throw new Error('OPENROUTER_API_KEY chưa được cấu hình');

  const model     = opts.model || 'meta-llama/llama-3.3-70b-instruct:free';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const startTime = Date.now();
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

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429) markKeyCooldown('openrouter', key);
    else recordCircuitFailure('openrouter', msg);
    throw new Error(`OpenRouter API lỗi (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter trả về nội dung rỗng');

  recordCircuitSuccess('openrouter');
  await recordAiUsage({
    user: opts.user,
    operation: opts.operation || 'chat',
    provider: 'openrouter',
    model,
    isBYOK,
    promptTokens: Math.round(userPrompt.length / 4),
    completionTokens: Math.round(text.length / 4),
    latencyMs,
    idempotencyKey: opts.idempotencyKey,
  });

  return text.trim();
}

// ── 5. Mistral AI Free ────────────────────────────────────────────────────────
async function callMistral(userPrompt, opts = {}) {
  let key = opts.apiKey;
  let isBYOK = Boolean(opts.isBYOK);

  if (!key) {
    if (opts.user) {
      const res = await resolveExecutionKey(opts.user, 'mistral');
      key = res.key;
      isBYOK = res.isBYOK;
    }
    if (!key) {
      key = getNextKey('mistral', process.env.MISTRAL_API_KEY);
    }
  }

  if (!key) throw new Error('MISTRAL_API_KEY chưa được cấu hình');

  const model     = opts.model || 'mistral-small-latest';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const startTime = Date.now();
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

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429) markKeyCooldown('mistral', key);
    else recordCircuitFailure('mistral', msg);
    throw new Error(`Mistral API lỗi (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Mistral trả về nội dung rỗng');

  recordCircuitSuccess('mistral');
  await recordAiUsage({
    user: opts.user,
    operation: opts.operation || 'chat',
    provider: 'mistral',
    model,
    isBYOK,
    promptTokens: Math.round(userPrompt.length / 4),
    completionTokens: Math.round(text.length / 4),
    latencyMs,
    idempotencyKey: opts.idempotencyKey,
  });

  return text.trim();
}

// ── 6. GitHub Models Free ─────────────────────────────────────────────────────
async function callGitHubModels(userPrompt, opts = {}) {
  let key = opts.apiKey;
  let isBYOK = Boolean(opts.isBYOK);

  if (!key) {
    if (opts.user) {
      const res = await resolveExecutionKey(opts.user, 'github');
      key = res.key;
      isBYOK = res.isBYOK;
    }
    if (!key) {
      key = getNextKey('github', process.env.GITHUB_TOKEN);
    }
  }

  if (!key) throw new Error('GITHUB_TOKEN chưa được cấu hình');

  const model     = opts.model || 'gpt-4o-mini';
  const maxTokens = opts.maxTokens || 2048;

  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userPrompt });

  const startTime = Date.now();
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

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || res.statusText;
    if (res.status === 429) markKeyCooldown('github', key);
    else recordCircuitFailure('github', msg);
    throw new Error(`GitHub Models API lỗi (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('GitHub Models trả về nội dung rỗng');

  recordCircuitSuccess('github');
  await recordAiUsage({
    user: opts.user,
    operation: opts.operation || 'chat',
    provider: 'github',
    model,
    isBYOK,
    promptTokens: Math.round(userPrompt.length / 4),
    completionTokens: Math.round(text.length / 4),
    latencyMs,
    idempotencyKey: opts.idempotencyKey,
  });

  return text.trim();
}

// ── Smart Multi-Provider Failover Router with Circuit Breaker ──────────────────
async function callAI(userPrompt, opts = {}) {
  const {
    system        = null,
    forceProvider = null,
    textLength    = 0,
    isHeavyTask   = false,
    maxTokens     = 2048,
    user          = null,
    operation     = 'chat',
    idempotencyKey = null,
  } = opts;

  // 1. Direct forced provider
  if (forceProvider === 'gemini-flash' || forceProvider === 'google-flash') {
    return callGemini(userPrompt, { system, model: DEFAULT_GEMINI_MODEL, maxTokens, user, operation, idempotencyKey });
  }
  if (forceProvider === 'gemini-pro' || forceProvider === 'google-pro') {
    return callGemini(userPrompt, { system, model: DEFAULT_GEMINI_PRO_MODEL, maxTokens, user, operation, idempotencyKey });
  }
  if (forceProvider === 'gemini') {
    return callGemini(userPrompt, { system, maxTokens, user, operation, idempotencyKey });
  }
  if (forceProvider === 'cerebras') {
    return callCerebras(userPrompt, { system, maxTokens, user, operation, idempotencyKey });
  }
  if (forceProvider === 'groq') {
    return callGroq(userPrompt, { system, maxTokens, user, operation, idempotencyKey });
  }
  if (forceProvider === 'openrouter') {
    return callOpenRouter(userPrompt, { system, maxTokens, user, operation, idempotencyKey });
  }
  if (forceProvider === 'mistral') {
    return callMistral(userPrompt, { system, maxTokens, user, operation, idempotencyKey });
  }
  if (forceProvider === 'github') {
    return callGitHubModels(userPrompt, { system, maxTokens, user, operation, idempotencyKey });
  }

  // 2. Auto Failover Cascade: Gemini -> Cerebras -> Groq -> OpenRouter -> Mistral -> GitHub
  const poolGemini = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  const candidateProviders = [
    { id: 'gemini', name: 'Gemini', fn: () => callGemini(userPrompt, { system, maxTokens, user, operation, idempotencyKey, model: textLength > GEMINI_PRO_THRESHOLD ? DEFAULT_GEMINI_PRO_MODEL : DEFAULT_GEMINI_MODEL }), hasKey: !!poolGemini },
    { id: 'cerebras', name: 'Cerebras', fn: () => callCerebras(userPrompt, { system, maxTokens, user, operation, idempotencyKey }), hasKey: !!process.env.CEREBRAS_API_KEY },
    { id: 'groq', name: 'Groq', fn: () => callGroq(userPrompt, { system, maxTokens, user, operation, idempotencyKey }), hasKey: !!process.env.GROQ_API_KEY },
    { id: 'openrouter', name: 'OpenRouter', fn: () => callOpenRouter(userPrompt, { system, maxTokens, user, operation, idempotencyKey }), hasKey: !!process.env.OPENROUTER_API_KEY },
    { id: 'mistral', name: 'Mistral', fn: () => callMistral(userPrompt, { system, maxTokens, user, operation, idempotencyKey }), hasKey: !!process.env.MISTRAL_API_KEY },
    { id: 'github', name: 'GitHub', fn: () => callGitHubModels(userPrompt, { system, maxTokens, user, operation, idempotencyKey }), hasKey: !!process.env.GITHUB_TOKEN },
  ];

  // Filter candidates by key presence AND circuit breaker health
  const healthyProviders = candidateProviders.filter(p => p.hasKey && canExecuteProvider(p.id));

  // If all circuit breakers are open, allow fallback to any provider with key
  const activeProviders = healthyProviders.length > 0 ? healthyProviders : candidateProviders.filter(p => p.hasKey);

  if (activeProviders.length === 0) {
    throw new Error('Chưa cấu hình API Key AI nào. Hãy thêm GOOGLE_AI_API_KEY, GROQ_API_KEY hoặc CEREBRAS_API_KEY vào .env');
  }

  let lastError = null;
  for (const provider of activeProviders) {
    try {
      return await provider.fn();
    } catch (err) {
      console.warn(`[AI Failover] ${provider.name} lỗi, tự động chuyển sang nhà cung cấp kế tiếp: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('Tất cả các nhà cung cấp AI trong pool đều đang bận hoặc quá tải');
}

// ── Trích xuất text từ PDF với thông tin trang độc lập ───────────────────────
async function extractText(filePath, maxChars = 12000) {
  const bytes = fs.readFileSync(filePath);
  const pages = [];

  try {
    let pageNum = 1;
    const parsed = await pdfParse(bytes, {
      pagerender: (pageData) => {
        return pageData.getTextContent().then((textContent) => {
          const text = textContent.items.map(item => item.str).join(' ');
          pages.push({ pageNumber: pageNum++, text: text.trim() });
          return text;
        });
      },
    });

    const fullText = (parsed.text || '').trim();
    if (!fullText && pages.length === 0) {
      throw new Error('Không đọc được text từ file. PDF có thể là tài liệu scan — hãy dùng công cụ OCR trước.');
    }

    return {
      text: fullText.slice(0, maxChars),
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText.slice(0, maxChars) }],
    };
  } catch (err) {
    if (err.message && err.message.includes('scan')) throw err;
    const raw = fs.readFileSync(filePath, 'utf8').slice(0, maxChars);
    if (!raw.trim()) throw new Error('Không đọc được nội dung từ file.');
    return {
      text: raw,
      pages: [{ pageNumber: 1, text: raw }],
    };
  }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
async function summarize(filePath, opts = {}) {
  const { language = 'vi', length = 'medium', forceProvider = null, user = null } = opts;
  const { text, pages } = await extractText(filePath);
  const lenMap = {
    short:  '3–5 câu ngắn gọn, súc tích',
    medium: '2–3 đoạn văn rõ ràng, đầy đủ ý chính',
    long:   '5–7 đoạn văn chi tiết kèm danh sách gạch đầu dòng',
  };

  const lang = language === 'vi' ? 'tiếng Việt' : 'English';
  const segmentation = segmentDocumentWithPageAnchors(pages);

  const prompt = formatGroundedPrompt({
    documentChunks: segmentation.chunks,
    question: `Tóm tắt nội dung tài liệu theo định dạng (${lenMap[length] || lenMap.medium}) bằng ${lang}. Neo các ý chính vào số trang tương ứng.`,
    systemInstruction: `Bạn là chuyên gia phân tích và tóm tắt tài liệu. Luôn viết phản hồi bằng ${lang}. Tóm tắt súc tích, làm nổi bật thông tin cốt lõi kèm trích dẫn [Page X].`,
  });

  const summary = await callAI(prompt, {
    forceProvider,
    textLength: text.length,
    isHeavyTask: text.length > 5000,
    maxTokens: length === 'long' ? 3000 : 1500,
    user,
    operation: 'summarize',
  });

  return summary;
}

async function translate(filePath, opts = {}) {
  const { targetLang = 'en', forceProvider = null, user = null } = opts;
  const { text } = await extractText(filePath, 8000);
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
    user,
    operation: 'translate',
  });
}

async function chat(filePath, question, opts = {}) {
  if (!question?.trim()) throw new Error('Câu hỏi không được để trống');
  const { forceProvider = null, user = null } = opts;
  const { text, pages } = await extractText(filePath);

  const segmentation = segmentDocumentWithPageAnchors(pages);
  const groundedPrompt = formatGroundedPrompt({
    documentChunks: segmentation.chunks,
    question,
    systemInstruction: `Trả lời ngắn gọn, rành mạch, dùng cùng ngôn ngữ với câu hỏi. Trích dẫn [Page X] cho mỗi nhận định có trong tài liệu.`,
  });

  const answer = await callAI(groundedPrompt, {
    forceProvider,
    textLength: text.length,
    isHeavyTask: false,
    maxTokens: 1500,
    user,
    operation: 'chat',
  });

  return answer;
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

  return await withPage(async (page) => {
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
  });
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
  extractText,
  generateStructuredDiff,
  segmentDocumentWithPageAnchors,
  formatGroundedPrompt,
};
