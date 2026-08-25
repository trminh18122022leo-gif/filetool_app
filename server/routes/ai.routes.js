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

// Chat với PDF
router.post('/chat', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { question, provider } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });
  const forceProvider = provider && provider !== 'auto' ? provider : null;

  const answer = await aiSvc.chat(req.file.path, question.trim(), { forceProvider });
  res.json({ success: true, answer });
}));

// Chữ viết tay
router.post('/handwriting', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { style = 'casual', fontSize = 18 } = req.body;

  const bytes  = fs.readFileSync(req.file.path);
  const parsed = await pdfParse(bytes);
  const text   = parsed.text?.trim();

  if (!text) {
    return res.status(422).json({
      error: 'Không đọc được text từ PDF. Hãy dùng OCR trước nếu đây là file scan.'
    });
  }

  const outPath = await aiSvc.renderHandwriting(text.slice(0, 3000), {
    style,
    fontSize: Number(fontSize),
  });

  await respondFile(req, res, outPath, 'handwriting');
}));

// Provider Status API
router.get('/provider-status', (req, res) => {
  res.json({
    primary: process.env.GOOGLE_AI_API_KEY ? 'Google Gemini (1.5 Flash / Pro)' : 'not configured',
    backup:  process.env.GROQ_API_KEY ? 'Groq LPU (Llama 3.3 70B)' : (process.env.OPENROUTER_API_KEY ? 'OpenRouter Free' : 'not configured'),
    models: {
      geminiFlash: process.env.GEMINI_FLASH_MODEL || 'gemini-1.5-flash',
      geminiPro:   process.env.GEMINI_PRO_MODEL   || 'gemini-1.5-pro',
      groq:        process.env.GROQ_MODEL         || 'llama-3.3-70b-versatile',
    },
    strategy: {
      default:        'Google Gemini 1.5 Flash (Free & Nhanh)',
      longDoc:        'Google Gemini 1.5 Pro (Doc > 5000 ký tự)',
      googleFails:    'Tự động Fallback sang Groq (Llama 3.3 70B) hoặc OpenRouter Free',
      userSelection:  'Có thể chọn trực tiếp: Gemini Flash, Gemini Pro, hoặc Groq Llama 3.3',
    },
  });
});

module.exports = router;
