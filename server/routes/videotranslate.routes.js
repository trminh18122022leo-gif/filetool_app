'use strict';

/**
 * videotranslate.routes.js — Tuyến đường API Dịch & Lồng tiếng Video đa ngôn ngữ
 * Kết hợp phong cách VEED.io (biên tập phụ đề) và HeyGen (lồng tiếng & ducking)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const upload = require('../middleware/upload');
const speechSvc = require('../services/speech.service');
const videoSvc = require('../services/video.service');
const ttsSvc = require('../services/tts.service');
const subtitleTranslatorSvc = require('../services/subtitleTranslator.service');
const voicesConfig = require('../config/voices.config');
const { cleanupSubtitles, stringifySrt, stringifyVtt } = require('../utils/subtitleCleanup');
const { respondFile } = require('../utils/cloudRespond');

const OUT_DIR = path.resolve('outputs');
const UPLOAD_DIR = path.resolve('uploads');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ── 1. Lấy danh sách giọng đọc khả dụng theo ngôn ngữ ─────────────────────────
router.get('/voices', wrap(async (req, res) => {
  const { lang = 'vi' } = req.query;
  const result = await voicesConfig.getVoicesForLanguage(lang);
  res.json({
    success: true,
    language: result.language,
    total: result.total,
    customVoices: result.customVoices,
    systemVoices: result.systemVoices
  });
}));

// ── 2. Tải video lên, trích xuất audio và bóc tách phụ đề (Transcribe) ─────────
router.post('/transcribe', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng tải lên một file video (.mp4, .mov, .webm)' });
  }

  const {
    language = 'auto',
    provider = 'auto',
    filterSdh = 'true',
    filterHallucinations = 'true'
  } = req.body;

  const videoPath = req.file.path;
  const duration = await videoSvc.getVideoDuration(videoPath);

  const hasAudio = await videoSvc.hasAudioStream(videoPath);
  if (!hasAudio) {
    return res.status(400).json({ error: 'Video tải lên không có luồng âm thanh để nhận diện lời thoại' });
  }

  // Trích xuất âm thanh 16kHz tối ưu cho Whisper
  let audioPath = null;
  try {
    audioPath = await videoSvc.extractAudio16k(videoPath);

    // Chuyển âm thanh thành văn bản kèm timestamp
    const transcribeResult = await speechSvc.transcribeAudio(audioPath, {
      language,
      provider,
      withTimestamps: true
    });

    let rawSegments = [];
    if (Array.isArray(transcribeResult.segments) && transcribeResult.segments.length > 0) {
      rawSegments = transcribeResult.segments.map((seg, idx) => ({
        id: idx + 1,
        start: seg.start,
        end: seg.end,
        text: (seg.text || '').trim()
      }));
    } else {
      // Nếu không có segments chi tiết, tự động phân chia câu theo dấu chấm
      const fullText = transcribeResult.text || '';
      const sentences = fullText.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
      const segDuration = sentences.length > 0 ? Math.max(2, duration / sentences.length) : 3;

      rawSegments = sentences.map((st, idx) => ({
        id: idx + 1,
        start: idx * segDuration,
        end: Math.min(duration, (idx + 1) * segDuration),
        text: st.trim()
      }));
    }

    // Làm sạch phụ đề với các thuật toán học từ WhisperSubTranslate
    const cleanedCues = cleanupSubtitles(rawSegments, {
      filterSdh: filterSdh === 'true',
      filterHallucinations: filterHallucinations === 'true',
      fixOverlaps: true
    });

    res.json({
      success: true,
      videoFilename: req.file.filename,
      videoUrl: `/uploads/${req.file.filename}`,
      duration,
      detectedLanguage: transcribeResult.language || language,
      provider: transcribeResult.provider,
      cues: cleanedCues
    });
  } finally {
    // Xóa file audio trích xuất tạm thời
    if (audioPath && fs.existsSync(audioPath)) {
      try { fs.unlinkSync(audioPath); } catch (_) {}
    }
  }
}));

// ── 3. Dịch thuật phụ đề theo lô (Translate Cues) ──────────────────────────────
router.post('/translate', optionalAuth, wrap(async (req, res) => {
  const { cues, targetLang = 'vi', sourceLang = 'auto' } = req.body;

  if (!Array.isArray(cues) || cues.length === 0) {
    return res.status(400).json({ error: 'Danh sách câu phụ đề không hợp lệ hoặc đang trống' });
  }

  const translatedCues = await subtitleTranslatorSvc.translateSubtitles(cues, targetLang);

  res.json({
    success: true,
    targetLang,
    cues: translatedCues
  });
}));

// ── 4. Nghe thử giọng đọc một câu đơn (Preview Voice) ──────────────────────────
router.post('/preview-voice', optionalAuth, wrap(async (req, res) => {
  const { text, voiceId, language = 'vi', rate = '0%', pitch = '0Hz' } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Thiếu nội dung văn bản để nghe thử' });
  }

  const result = await ttsSvc.synthesizeSentence(text, {
    voiceId,
    language,
    rate,
    pitch
  });

  res.json({
    success: true,
    filename: result.filename,
    audioUrl: `/api/view/${result.filename}`,
    voiceId: result.voiceId
  });
}));

// ── 5. Xuất bản video thành phẩm (Render: Ép phụ đề & Lồng tiếng) ───────────────
router.post('/render', optionalAuth, wrap(async (req, res) => {
  const {
    videoFilename,
    cues,
    burnSub = true,
    dubbing = false,
    subtitleStyle = 'tiktok',
    voiceOptions = {},
    ducking = true,
    origVolume = 0.15,
    muteOriginal = false,
    exportFormat = 'video' // 'video' | 'srt' | 'vtt'
  } = req.body;

  if (!Array.isArray(cues) || cues.length === 0) {
    return res.status(400).json({ error: 'Không có nội dung phụ đề để xuất bản' });
  }

  // Xuất file SRT rời
  if (exportFormat === 'srt') {
    const srtContent = stringifySrt(cues);
    const srtPath = path.join(OUT_DIR, `subtitles_${uuidv4()}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
    await respondFile(req, res, srtPath, 'video-subtitles-srt');
    return;
  }

  // Xuất file VTT rời
  if (exportFormat === 'vtt') {
    const vttContent = stringifyVtt(cues);
    const vttPath = path.join(OUT_DIR, `subtitles_${uuidv4()}.vtt`);
    fs.writeFileSync(vttPath, vttContent, 'utf-8');
    await respondFile(req, res, vttPath, 'video-subtitles-vtt');
    return;
  }

  // Render video
  if (!videoFilename) {
    return res.status(400).json({ error: 'Thiếu thông tin video cần render' });
  }

  const safeFilename = path.basename(videoFilename);
  const videoPath = path.join(UPLOAD_DIR, safeFilename);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video gốc không tồn tại hoặc đã bị xóa' });
  }

  const renderedVideoPath = await videoSvc.renderFullVideo(videoPath, cues, {
    burnSub: burnSub === true || burnSub === 'true',
    dubbing: dubbing === true || dubbing === 'true',
    subtitleStyle,
    voiceOptions,
    ducking: ducking === true || ducking === 'true',
    origVolume: parseFloat(origVolume) || 0.15,
    muteOriginal: muteOriginal === true || muteOriginal === 'true'
  });

  await respondFile(req, res, renderedVideoPath, 'translated-video', {
    hasSubtitles: burnSub,
    hasDubbing: dubbing
  });
}));

module.exports = router;
