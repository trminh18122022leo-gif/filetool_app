'use strict';

const express  = require('express');
const router   = express.Router();
const upload   = require('../middleware/upload');
const aiSvc    = require('../services/ai.service');
const { isVaultConfigured, encryptApiKey, maskApiKey } = require('../utils/aiKeyVault');
const UserByokKey = require('../models/UserByokKey');
const AiUsageLedger = require('../models/AiUsageLedger');
const { getCircuitBreaker, PROVIDER_SPECS } = require('../services/aiProviderAdapter');
const User = require('../models/User');

let optionalAuth = (req, res, next) => next();
let requireAuth = (req, res, next) => next();
try {
  const auth = require('../middleware/auth');
  optionalAuth = auth.optionalAuth;
  requireAuth = auth.requireAuth;
} catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

/**
 * Privacy Invariant: Explicit User Consent Check
 * Never transmit document content or metadata to external AI providers without consent.
 */
function requireAiConsent(req, res, next) {
  const consentGiven =
    req.body.aiConsent === true ||
    req.body.aiConsent === 'true' ||
    req.headers['x-ai-consent'] === 'true' ||
    req.user?.aiConsentGranted === true;

  if (!consentGiven) {
    return res.status(403).json({
      error: 'AI_CONSENT_REQUIRED: Bạn cần đồng ý chính sách xử lý dữ liệu AI trước khi gửi tài liệu tới mô hình.',
      code: 'AI_CONSENT_REQUIRED',
    });
  }
  next();
}

// ── 1. Record / Check AI Data Consent ─────────────────────────────────────────
router.post('/consent', optionalAuth, wrap(async (req, res) => {
  const { consent = true } = req.body;
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, { aiConsentGranted: Boolean(consent) }).catch(() => {});
  }
  res.json({
    success: true,
    aiConsent: Boolean(consent),
    message: consent
      ? 'Đã ghi nhận sự đồng thuận xử lý dữ liệu AI với ranh giới bảo mật nghiêm ngặt.'
      : 'Đã hủy sự đồng thuận xử lý dữ liệu AI.',
  });
}));

// ── 2. BYOK (Bring Your Own Key) Management Endpoints ─────────────────────────
router.get('/byok', requireAuth, wrap(async (req, res) => {
  const vaultReady = isVaultConfigured();
  if (!vaultReady) {
    return res.json({
      success: true,
      vaultConfigured: false,
      message: 'Tính năng BYOK đang tạm tắt vì hệ thống mã hóa phần cứng chưa được cấu hình an toàn.',
      keys: [],
    });
  }

  const keys = await UserByokKey.find({ user: req.user._id })
    .select('provider keyMasked isValid lastValidatedAt createdAt updatedAt')
    .lean();

  res.json({
    success: true,
    vaultConfigured: true,
    keys,
  });
}));

router.post('/byok', requireAuth, wrap(async (req, res) => {
  if (!isVaultConfigured()) {
    return res.status(503).json({
      error: 'Hệ thống kho khóa chưa được cấu hình an toàn (AI_KEY_ENCRYPTION_SECRET)',
      code: 'BYOK_KEYVAULT_UNCONFIGURED',
    });
  }

  const { provider, apiKey } = req.body;
  const allowedProviders = ['gemini', 'openai', 'groq', 'anthropic', 'cerebras', 'openrouter', 'mistral', 'github'];

  if (!provider || !allowedProviders.includes(provider)) {
    return res.status(400).json({ error: `Nhà cung cấp không hợp lệ. Cho phép: ${allowedProviders.join(', ')}` });
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return res.status(400).json({ error: 'Khóa API không hợp lệ hoặc quá ngắn' });
  }

  // Encrypt with AES-256-GCM envelope
  const encryptedPayload = encryptApiKey(apiKey.trim());

  const existing = await UserByokKey.findOne({ user: req.user._id, provider });
  if (existing) {
    existing.encryptedKey = encryptedPayload.encryptedKey;
    existing.iv = encryptedPayload.iv;
    existing.authTag = encryptedPayload.authTag;
    existing.rotationHistory.push({
      rotatedAt: new Date(),
      previousKeyMasked: existing.keyMasked,
    });
    existing.keyMasked = encryptedPayload.keyMasked;
    existing.isValid = true;
    existing.lastValidatedAt = new Date();
    await existing.save();

    return res.json({
      success: true,
      provider,
      keyMasked: existing.keyMasked,
      rotated: true,
    });
  }

  const newKey = await UserByokKey.create({
    user: req.user._id,
    provider,
    encryptedKey: encryptedPayload.encryptedKey,
    iv: encryptedPayload.iv,
    authTag: encryptedPayload.authTag,
    keyMasked: encryptedPayload.keyMasked,
    isValid: true,
  });

  res.status(201).json({
    success: true,
    provider,
    keyMasked: newKey.keyMasked,
  });
}));

router.delete('/byok/:provider', requireAuth, wrap(async (req, res) => {
  await UserByokKey.deleteOne({ user: req.user._id, provider: req.params.provider });
  res.json({ success: true, message: `Đã xóa khóa ${req.params.provider}` });
}));

// ── 3. Tóm tắt tài liệu (Page-Anchored & Injection-Resistant) ─────────────────
router.post('/summarize', optionalAuth, upload.single('file'), requireAiConsent, wrap(async (req, res) => {
  const { language = 'vi', length = 'medium', provider } = req.body;
  const forceProvider = provider && provider !== 'auto' ? provider : null;
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

  const summary = await aiSvc.summarize(req.file.path, {
    language,
    length,
    forceProvider,
    user: req.user,
    idempotencyKey,
  });

  res.json({ success: true, summary });
}));

// ── 4. Dịch thuật đa ngôn ngữ ────────────────────────────────────────────────
router.post('/translate', optionalAuth, upload.single('file'), requireAiConsent, wrap(async (req, res) => {
  const { targetLang = 'en', provider } = req.body;
  const forceProvider = provider && provider !== 'auto' ? provider : null;
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

  const translated = await aiSvc.translate(req.file.path, {
    targetLang,
    forceProvider,
    user: req.user,
    idempotencyKey,
  });

  res.json({ success: true, translated });
}));

// ── 5. Chat & Hỏi Đáp Grounded với Neo Trang ([Page X]) ───────────────────────
router.post('/chat', optionalAuth, upload.single('file'), requireAiConsent, wrap(async (req, res) => {
  const { question, text, language = 'vi', provider } = req.body;
  const promptText = question || text;
  if (!promptText?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi / văn bản' });

  const forceProvider = provider && provider !== 'auto' ? provider : null;
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

  if (req.file) {
    const answer = await aiSvc.chat(req.file.path, promptText.trim(), {
      forceProvider,
      user: req.user,
      idempotencyKey,
    });
    return res.json({ success: true, answer });
  }

  const answer = await aiSvc.callAI(promptText.trim(), {
    forceProvider,
    system: `Bạn là trợ lý AI thông minh hỗ trợ lập trình và phân tích file của FileTools Pro. Hãy trả lời bằng ${language === 'vi' ? 'tiếng Việt' : 'English'}.`,
    maxTokens: 2500,
    user: req.user,
    operation: 'chat',
    idempotencyKey,
  });

  return res.json({ success: true, answer, text: answer });
}));

// ── 6. AI-Assisted Editing & Structured Diff (Explicit User Acceptance) ──────
router.post('/edit-diff', optionalAuth, requireAiConsent, wrap(async (req, res) => {
  const { originalText, instructions, provider } = req.body;
  if (!originalText || !originalText.trim()) {
    return res.status(400).json({ error: 'Văn bản gốc không được để trống' });
  }

  const forceProvider = provider && provider !== 'auto' ? provider : null;
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

  const prompt = `Bạn là trợ lý hiệu đính và chỉnh sửa văn bản. Hãy chỉnh sửa đoạn văn bản sau theo đúng yêu cầu:
CHỈ THỊ: ${instructions || 'Sửa lỗi chính tả, cải thiện câu từ súc tích và mạch lạc hơn'}

VĂN BẢN GỐC:
"""
${originalText.trim()}
"""

QUY TẮC BẮT BUỘC:
Chỉ trả về CHÍNH XÁC văn bản đã qua chỉnh sửa, không kèm lời mở đầu, không giải thích hay đóng khung markdown.`;

  const modifiedText = await aiSvc.callAI(prompt, {
    forceProvider,
    user: req.user,
    operation: 'edit-diff',
    idempotencyKey,
    maxTokens: 3000,
  });

  const diffResult = aiSvc.generateStructuredDiff(originalText.trim(), modifiedText.trim());

  res.json({
    success: true,
    originalText: originalText.trim(),
    modifiedText: modifiedText.trim(),
    diff: diffResult.diff,
    hasChanges: diffResult.hasChanges,
    lineCount: diffResult.modifiedLineCount,
  });
}));

// ── 7. AI Code Tools (Giải thích code, audit, test) ──────────────────────────
router.post('/explain-code', optionalAuth, requireAiConsent, wrap(async (req, res) => {
  const { code, language = 'unknown', provider } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Thiếu code' });
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const answer = await aiSvc.callAI(
    `Giải thích đoạn ${language} code sau bằng tiếng Việt, rõ ràng, ngắn gọn (tối đa 300 từ):\n\`\`\`${language}\n${code.slice(0, 5000)}\n\`\`\``,
    {
      forceProvider,
      system: 'Bạn là senior developer. Giải thích code bằng tiếng Việt dễ hiểu, nêu rõ mục đích, cấu trúc và logic chính.',
      maxTokens: 1500,
      user: req.user,
      operation: 'explain-code',
    }
  );

  res.json({ success: true, answer });
}));

router.post('/security-audit', optionalAuth, requireAiConsent, wrap(async (req, res) => {
  const { code, language = 'unknown', provider } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Thiếu code' });
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const auditResult = await aiSvc.callAI(
    `Kiểm tra bảo mật đoạn ${language} code sau. Liệt kê các lỗi theo JSON array:
[{"severity":"critical/high/medium/low","issue":"tên lỗi","line":"~số dòng","fix":"cách sửa ngắn gọn"}]
Code:
\`\`\`${language}
${code.slice(0, 5000)}
\`\`\``,
    {
      forceProvider,
      system: 'Bạn là security engineer. Chỉ trả về JSON array, không kèm markdown hay giải thích ngoài JSON.',
      maxTokens: 2000,
      user: req.user,
      operation: 'security-audit',
    }
  );

  let issues = [];
  try {
    issues = JSON.parse(auditResult.replace(/```json|```/g, '').trim());
  } catch (_) {}

  res.json({ success: true, issues, raw: auditResult });
}));

router.post('/generate-tests', optionalAuth, requireAiConsent, wrap(async (req, res) => {
  const { code, language = 'javascript', framework = 'jest', provider } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Thiếu code' });
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const tests = await aiSvc.callAI(
    `Viết unit tests đầy đủ cho đoạn ${language} code sau dùng ${framework}.
Bao gồm: happy path, edge cases, error cases.
Code:
\`\`\`${language}
${code.slice(0, 5000)}
\`\`\``,
    {
      forceProvider,
      system: `Viết ${framework} tests hoàn chỉnh, chuẩn cú pháp, có thể chạy được ngay.`,
      maxTokens: 2500,
      user: req.user,
      operation: 'generate-tests',
    }
  );

  res.json({ success: true, tests });
}));

router.post('/text-to-data', optionalAuth, requireAiConsent, wrap(async (req, res) => {
  const { text, format = 'json', provider } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Thiếu mô tả' });
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const result = await aiSvc.callAI(
    `Chuyển mô tả sau thành dữ liệu ${format.toUpperCase()} hợp lệ:
"${text}"

Trả về CHỈ ${format.toUpperCase()} thuần túy, không giải thích.`,
    {
      forceProvider,
      system: `Chuyên gia chuyển ngôn ngữ tự nhiên thành dữ liệu ${format}. Chỉ trả về data chuẩn.`,
      maxTokens: 2000,
      user: req.user,
      operation: 'text-to-data',
    }
  );

  res.json({ success: true, data: result, format });
}));

// ── 8. FinOps Usage Ledger Endpoint ──────────────────────────────────────────
router.get('/usage-ledger', requireAuth, wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [records, totalCount, stats] = await Promise.all([
    AiUsageLedger.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AiUsageLedger.countDocuments({ user: req.user._id }),
    AiUsageLedger.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalPromptTokens:     { $sum: '$promptTokens' },
          totalCompletionTokens: { $sum: '$completionTokens' },
          totalProviderCostUSD:  { $sum: '$providerCostUSD' },
          totalInfraCostUSD:     { $sum: '$infrastructureCostUSD' },
          totalCalls:            { $sum: 1 },
          byokCalls:             { $sum: { $cond: ['$isBYOK', 1, 0] } },
        },
      },
    ]),
  ]);

  const summary = stats[0] || {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalProviderCostUSD: 0,
    totalInfraCostUSD: 0,
    totalCalls: 0,
    byokCalls: 0,
  };

  res.json({
    success: true,
    summary,
    records,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
}));

// ── 9. Provider Status & Circuit Breaker Health API ───────────────────────────
router.get('/provider-status', (req, res) => {
  const geminiPool = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const geminiKeys = aiSvc.parseKeyPool(geminiPool);
  const groqKeys = aiSvc.parseKeyPool(process.env.GROQ_API_KEY);
  const cerebrasKeys = aiSvc.parseKeyPool(process.env.CEREBRAS_API_KEY);
  const openrouterKeys = aiSvc.parseKeyPool(process.env.OPENROUTER_API_KEY);
  const mistralKeys = aiSvc.parseKeyPool(process.env.MISTRAL_API_KEY);
  const githubKeys = aiSvc.parseKeyPool(process.env.GITHUB_TOKEN);

  res.json({
    status: 'online',
    vaultReady: isVaultConfigured(),
    providers: {
      gemini: {
        active: geminiKeys.length > 0,
        keysCount: geminiKeys.length,
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash (legacy)'],
        circuitBreaker: getCircuitBreaker('gemini').state,
      },
      cerebras: {
        active: cerebrasKeys.length > 0,
        keysCount: cerebrasKeys.length,
        models: ['llama3.3-70b', 'llama3.1-8b'],
        circuitBreaker: getCircuitBreaker('cerebras').state,
      },
      groq: {
        active: groqKeys.length > 0,
        keysCount: groqKeys.length,
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-2.5-32b'],
        circuitBreaker: getCircuitBreaker('groq').state,
      },
      openrouter: {
        active: openrouterKeys.length > 0,
        keysCount: openrouterKeys.length,
        models: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free'],
        circuitBreaker: getCircuitBreaker('openrouter').state,
      },
      mistral: {
        active: mistralKeys.length > 0,
        keysCount: mistralKeys.length,
        models: ['mistral-small-latest', 'open-mistral-7b'],
        circuitBreaker: getCircuitBreaker('mistral').state,
      },
      github: {
        active: githubKeys.length > 0,
        keysCount: githubKeys.length,
        models: ['gpt-4o-mini', 'Meta-Llama-3.3-70B-Instruct'],
        circuitBreaker: getCircuitBreaker('github').state,
      },
    },
    strategy: {
      rotation: 'Multi-Key Round-Robin với tự động Cooldown 60s khi gặp lỗi 429',
      circuitBreaker: 'Trip to OPEN upon 3 consecutive failures, half-open probe recovery',
      failover: 'Gemini -> Cerebras LPU -> Groq LPU -> OpenRouter Free -> Mistral -> GitHub',
    },
  });
});

module.exports = router;
