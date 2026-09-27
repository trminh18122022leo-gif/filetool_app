'use strict';

const express      = require('express');
const router       = express.Router();
const upload       = require('../middleware/upload');
const creativeSvc  = require('../services/creative.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}
let freeModeUpgrade = (req, res, next) => next();
try { freeModeUpgrade = require('../middleware/auth').freeModeUpgrade; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

router.post('/palette', upload.single('file'), wrap(async (req, res) => {
  const colors = await creativeSvc.extractPalette(req.file.path);
  res.json({ success: true, colors });
}));

router.post('/image-watermark', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const { text = 'WATERMARK', opacity = 0.4, color = 'white', fontSize = 48 } = req.body;
  const out = await creativeSvc.watermarkImage(req.file.path, {
    text, opacity: Number(opacity), color, fontSize: Number(fontSize),
  });
  await respondFile(req, res, out, 'image-watermark');
}));

router.post('/collage', optionalAuth, freeModeUpgrade, upload.array('files', 20), wrap(async (req, res) => {
  if (req.files?.length < 2) return res.status(400).json({ error: 'Cần ít nhất 2 ảnh để ghép' });
  const { cols = 2, gap = 10 } = req.body;
  const out = await creativeSvc.makeCollage(
    req.files.map(f => f.path),
    { cols: Number(cols), gap: Number(gap) }
  );
  await respondFile(req, res, out, 'collage');
}));

router.post('/barcode', optionalAuth, freeModeUpgrade, wrap(async (req, res) => {
  const { text, bcid = 'code128', scale = 3, height = 10 } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Thiếu nội dung mã vạch' });
  const out = await creativeSvc.generateBarcode(text.trim(), {
    bcid, scale: Number(scale), height: Number(height),
  });
  await respondFile(req, res, out, 'barcode');
}));

const stemSvc = require('../services/stemSplitter.service');
const viralClipperSvc = require('../services/viralClipper.service');
const path = require('path');
const fs = require('fs');
const UPLOAD_DIR = path.resolve('uploads');

// ── Tách lời ca sĩ & Beat Karaoke (AI Stem Splitter) ─────────────────────────
router.post('/stem-split', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Chưa tải lên file âm thanh hoặc video' });
  }

  const { bassCutoff, vocalLow, vocalHigh } = req.body;
  const result = await stemSvc.splitStems(req.file.path, {
    bassCutoff: bassCutoff ? Number(bassCutoff) : undefined,
    vocalLow: vocalLow ? Number(vocalLow) : undefined,
    vocalHigh: vocalHigh ? Number(vocalHigh) : undefined,
  });

  res.json({
    success: true,
    vocal: {
      file: result.vocalFile,
      downloadUrl: `/outputs/${result.vocalFile}`,
      viewUrl: `/outputs/${result.vocalFile}`,
    },
    beat: {
      file: result.beatFile,
      downloadUrl: `/outputs/${result.beatFile}`,
      viewUrl: `/outputs/${result.beatFile}`,
    },
  });
}));

// ── AI Viral Shorts & TikTok Clipper: Quét Highlight ────────────────────────
router.post('/viral-shorts/detect', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  let videoPath = null;
  let videoFilename = null;

  if (req.file) {
    videoPath = req.file.path;
    videoFilename = req.file.filename;
  } else if (req.body.videoFilename) {
    const safeName = path.basename(req.body.videoFilename);
    videoPath = path.join(UPLOAD_DIR, safeName);
    videoFilename = safeName;
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video gốc không tồn tại trong hệ thống' });
    }
  } else {
    return res.status(400).json({ error: 'Vui lòng tải lên một file video (.mp4, .mov, .webm)' });
  }

  const { language = 'auto' } = req.body;
  const scanResult = await viralClipperSvc.detectHighlights(videoPath, { language });

  res.json({
    success: true,
    videoFilename,
    videoUrl: `/uploads/${videoFilename}`,
    duration: scanResult.duration,
    detectedLanguage: scanResult.detectedLanguage,
    highlights: scanResult.highlights,
    segments: scanResult.segments
  });
}));

// ── AI Viral Shorts & TikTok Clipper: Render Clip Dọc 9:16 ────────────────────
router.post('/viral-shorts/render', optionalAuth, freeModeUpgrade, wrap(async (req, res) => {
  const {
    videoFilename,
    clip,
    allSegments = [],
    subtitleStyle = 'tiktok',
    burnSub = true,
    blurBackground = true
  } = req.body;

  if (!videoFilename || !clip) {
    return res.status(400).json({ error: 'Thiếu thông tin videoFilename hoặc dữ liệu clip cần cắt' });
  }

  const safeName = path.basename(videoFilename);
  const videoPath = path.join(UPLOAD_DIR, safeName);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'File video gốc không tồn tại' });
  }

  const renderResult = await viralClipperSvc.renderViralShort(videoPath, clip, allSegments, {
    subtitleStyle,
    burnSub: burnSub === true || burnSub === 'true',
    blurBackground: blurBackground === true || blurBackground === 'true'
  });

  res.json({
    success: true,
    clip: renderResult
  });
}));

module.exports = router;

