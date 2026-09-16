'use strict';

const express  = require('express');
const router   = express.Router();
const upload   = require('../middleware/upload');
const aiSvc    = require('../services/ai.service');
const pdfParse = require('pdf-parse');
const fs       = require('fs');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Tóm tắt tài liệu
router.post('/summarize', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { language = 'vi', length = 'medium', provider } = req.body;
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const summary = await aiSvc.summarize(req.file.path, { language, length, forceProvider });
  res.json({ success: true, summary });
}));

// Dịch thuật
router.post('/translate', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { targetLang = 'en', provider } = req.body;
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const translated = await aiSvc.translate(req.file.path, { targetLang, forceProvider });
  res.json({ success: true, translated });
}));

// Chat với PDF hoặc Prompt trực tiếp
router.post('/chat', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { question, text, language = 'vi', provider } = req.body;
  const promptText = question || text;
  if (!promptText?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi / văn bản' });
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  if (req.file) {
    const answer = await aiSvc.chat(req.file.path, promptText.trim(), { forceProvider });
    return res.json({ success: true, answer });
  }

  const answer = await aiSvc.callAI(promptText.trim(), {
    forceProvider,
    system: `Bạn là trợ lý AI thông minh hỗ trợ lập trình và phân tích file của FileTools Pro. Hãy trả lời bằng ${language === 'vi' ? 'tiếng Việt' : 'English'}.`,
    maxTokens: 2500,
  });
  return res.json({ success: true, answer, text: answer });
}));

// AI Code Tools: Giải thích code
router.post('/explain-code', optionalAuth, wrap(async (req, res) => {
  const { code, language = 'unknown', provider } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Thiếu code' });
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const answer = await aiSvc.callAI(
    `Giải thích đoạn ${language} code sau bằng tiếng Việt, rõ ràng, ngắn gọn (tối đa 300 từ):\n\`\`\`${language}\n${code.slice(0, 5000)}\n\`\`\``,
    {
      forceProvider,
      system: 'Bạn là senior developer. Giải thích code bằng tiếng Việt dễ hiểu, nêu rõ mục đích, cấu trúc và logic chính.',
      maxTokens: 1500,
    }
  );

  res.json({ success: true, answer });
}));

// AI Code Tools: Kiểm tra bảo mật
router.post('/security-audit', optionalAuth, wrap(async (req, res) => {
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
    }
  );

  let issues = [];
  try {
    issues = JSON.parse(auditResult.replace(/```json|```/g, '').trim());
  } catch (_) {}

  res.json({ success: true, issues, raw: auditResult });
}));

// AI Code Tools: Tự động sinh Unit Test
router.post('/generate-tests', optionalAuth, wrap(async (req, res) => {
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
    }
  );

  res.json({ success: true, tests });
}));

// AI Code Tools: Ngôn ngữ tự nhiên -> JSON/YAML
router.post('/text-to-data', optionalAuth, wrap(async (req, res) => {
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
    }
  );

  res.json({ success: true, data: result, format });
}));

// Provider Status API
router.get('/provider-status', (req, res) => {
  const geminiKeys = aiSvc.parseKeyPool(process.env.GOOGLE_AI_API_KEY);
  const groqKeys = aiSvc.parseKeyPool(process.env.GROQ_API_KEY);
  const cerebrasKeys = aiSvc.parseKeyPool(process.env.CEREBRAS_API_KEY);
  const openrouterKeys = aiSvc.parseKeyPool(process.env.OPENROUTER_API_KEY);
  const mistralKeys = aiSvc.parseKeyPool(process.env.MISTRAL_API_KEY);
  const githubKeys = aiSvc.parseKeyPool(process.env.GITHUB_TOKEN);

  res.json({
    status: 'online',
    providers: {
      gemini: { active: geminiKeys.length > 0, keysCount: geminiKeys.length, models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'] },
      cerebras: { active: cerebrasKeys.length > 0, keysCount: cerebrasKeys.length, models: ['llama3.3-70b', 'llama3.1-8b'] },
      groq: { active: groqKeys.length > 0, keysCount: groqKeys.length, models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-2.5-32b', 'deepseek-r1-distill-llama-70b'] },
      openrouter: { active: openrouterKeys.length > 0, keysCount: openrouterKeys.length, models: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free'] },
      mistral: { active: mistralKeys.length > 0, keysCount: mistralKeys.length, models: ['mistral-small-latest', 'open-mistral-7b'] },
      github: { active: githubKeys.length > 0, keysCount: githubKeys.length, models: ['gpt-4o-mini', 'Meta-Llama-3.3-70B-Instruct'] },
    },
    strategy: {
      rotation: 'Multi-Key Round-Robin với tự động Cooldown 60s khi gặp lỗi 429 / Rate Limit',
      failover: 'Gemini -> Cerebras LPU -> Groq LPU -> OpenRouter Free -> Mistral -> GitHub',
    },
  });
});

module.exports = router;
