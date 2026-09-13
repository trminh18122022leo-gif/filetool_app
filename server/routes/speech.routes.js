'use strict';

const express    = require('express');
const router     = express.Router();
const upload     = require('../middleware/upload');
const speechSvc  = require('../services/speech.service');
const { respondFile } = require('../utils/cloudRespond');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ── Transcribe file âm thanh / video ─────────────────────────────────────────
router.post('/transcribe', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file âm thanh/video nào được upload' });
  }

  const {
    language        = 'vi',
    provider        = 'auto',
    outputFormat    = 'text',   // 'text' | 'srt' | 'pdf'
    withTimestamps  = 'false',
  } = req.body;

  const useTimestamps = withTimestamps === 'true' || outputFormat === 'srt';

  const result = await speechSvc.transcribeAudio(req.file.path, {
    language,
    provider,
    withTimestamps: useTimestamps,
  });

  // Trả về theo format yêu cầu
  if (outputFormat === 'srt') {
    const srt     = speechSvc.toSRT(result.text, result.segments);
    const srtPath = path.join(OUT, `transcript_${uuidv4()}.srt`);
    fs.writeFileSync(srtPath, srt, 'utf-8');
    await respondFile(req, res, srtPath, 'speech-to-text-srt', {
      provider: result.provider,
      language: result.language,
    });
    return;
  }

  if (outputFormat === 'pdf') {
    const pdfPath = await speechSvc.exportAsPdf(result.text, { language });
    await respondFile(req, res, pdfPath, 'speech-to-text-pdf', {
      provider: result.provider,
      language: result.language,
    });
    return;
  }

  // Plain text — trả về JSON
  res.json({
    success:   true,
    text:      result.text,
    plain:     result.plain || result.text,
    provider:  result.provider,
    language:  result.language,
    duration:  result.duration || null,
    wordCount: (result.text || '').split(/\s+/).filter(Boolean).length,
  });
}));

// ── Export text có sẵn thành PDF ──────────────────────────────────────────────
router.post('/export-pdf', optionalAuth, wrap(async (req, res) => {
  const { text, language = 'vi', title = 'Bản Ghi Âm' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Thiếu nội dung text' });
  const pdfPath = await speechSvc.exportAsPdf(text, { language, title });
  await respondFile(req, res, pdfPath, 'transcript-to-pdf');
}));

// ── Export text có sẵn thành SRT ─────────────────────────────────────────────
router.post('/export-srt', optionalAuth, wrap(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Thiếu nội dung text' });
  const srt     = speechSvc.toSRT(text);
  const srtPath = path.join(OUT, `transcript_${uuidv4()}.srt`);
  fs.writeFileSync(srtPath, srt, 'utf-8');
  await respondFile(req, res, srtPath, 'transcript-to-srt');
}));

// ── Kiểm tra provider có sẵn ─────────────────────────────────────────────────
router.get('/providers', (req, res) => {
  res.json({
    providers: {
      groq:    { available: !!process.env.GROQ_API_KEY, label: 'Groq Whisper (Llama v3)', maxSizeMB: 25, quality: 'Siêu tốc (Khuyên dùng)' },
      gemini:  { available: !!(process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY), label: 'Google Gemini', maxSizeMB: 20, quality: 'Tốt' },
      whisper: { available: !!process.env.OPENAI_API_KEY, label: 'OpenAI Whisper', maxSizeMB: 25, quality: 'Chính xác cao' },
    },
    webSpeechAPI: true, // Luôn hỗ trợ trên trình duyệt
  });
});

module.exports = router;
