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

const audioEnhanceSvc = require('../services/audioEnhance.service');

// ── Lọc tạp âm & Nâng cấp âm thanh phòng thu (Adobe Podcast style) ────────────
router.post('/enhance-audio', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng tải lên file âm thanh hoặc video' });
  }

  const {
    preset = 'studio',
    denoiseIntensity,
    bassBoost,
    trebleBoost,
    outputFormat,
  } = req.body;

  const result = await audioEnhanceSvc.enhanceMedia(req.file.path, {
    preset,
    denoiseIntensity: denoiseIntensity ? Number(denoiseIntensity) : undefined,
    bassBoost: bassBoost ? Number(bassBoost) : undefined,
    trebleBoost: trebleBoost ? Number(trebleBoost) : undefined,
    outputFormat,
  });

  await respondFile(req, res, result.outputPath, 'audio-enhance', {
    outputType: result.outputType,
    preset,
  });
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

const ttsSvc = require('../services/tts.service');
const { loadDictionary, saveDictionary } = require('../utils/pronunciationDict');
const { cleanTextForSpeech } = require('../utils/ttsPreprocessor');

// ── AI Voice Studio: Kiểm tra trạng thái động cơ TTS (VieNeu / CIT / Edge) ────
router.get('/tts/status', wrap(async (req, res) => {
  const engine = await ttsSvc.detectAvailableTtsEngine();
  res.json({
    success: true,
    engine
  });
}));

// ── AI Voice Studio: Lấy danh sách giọng đọc tiếng Việt & Quốc tế ────────────
router.get('/tts/voices', wrap(async (req, res) => {
  const result = await ttsSvc.getVietnameseVoices();
  res.json({
    success: true,
    ...result
  });
}));

// ── AI Voice Studio: Quản lý từ điển phát âm ──────────────────────────────────
router.get('/tts/dictionary', wrap(async (req, res) => {
  const dict = loadDictionary();
  res.json({ success: true, dictionary: dict });
}));

router.post('/tts/dictionary', optionalAuth, wrap(async (req, res) => {
  const { dictionary } = req.body;
  if (!dictionary || typeof dictionary !== 'object') {
    return res.status(400).json({ error: 'Dữ liệu từ điển không hợp lệ' });
  }
  const saved = saveDictionary(dictionary);
  res.json({ success: saved, dictionary });
}));

// ── AI Voice Studio: Làm sạch văn bản thông minh (Smart Clean) ────────────────
router.post('/tts/clean-text', wrap(async (req, res) => {
  const { text } = req.body;
  const cleaned = cleanTextForSpeech(text || '');
  res.json({ success: true, cleaned });
}));

// ── AI Voice Studio: Tạo giọng nói AI chất lượng cao ─────────────────────────
router.post('/tts/generate', optionalAuth, wrap(async (req, res) => {
  const {
    text,
    voiceId = 'Voice 1',
    format = 'mp3',
    language = 'vi',
    applyDictionary = true,
    smartClean = true
  } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Nội dung văn bản không được để trống' });
  }

  const result = await ttsSvc.synthesizeFullText(text, {
    voiceId,
    format,
    language,
    applyDictionary: applyDictionary === true || applyDictionary === 'true',
    smartClean: smartClean === true || smartClean === 'true'
  });

  res.json({
    success: true,
    ...result
  });
}));

// ── AI Voice Studio: Tạo hàng loạt theo mốc [P1], [P2]... xuất ZIP ───────────
router.post('/tts/batch', optionalAuth, wrap(async (req, res) => {
  const {
    text,
    voiceId = 'Voice 1',
    format = 'mp3',
    language = 'vi'
  } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Nội dung văn bản không được để trống' });
  }

  const result = await ttsSvc.synthesizeBatchParagraphs(text, {
    voiceId,
    format,
    language
  });

  res.json({
    success: true,
    ...result
  });
}));

module.exports = router;

