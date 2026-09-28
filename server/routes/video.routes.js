'use strict';

/**
 * video.routes.js — Tuyến đường API Video Studio & BotocIT Creative Tools
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const upload  = require('../middleware/upload');
const video   = require('../services/video.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}
let freeModeUpgrade = (req, res, next) => next();
try { freeModeUpgrade = require('../middleware/auth').freeModeUpgrade; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ── 1. Video Info ─────────────────────────────────────────────────────────────
router.post('/info', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const info = await video.getInfo(req.file.path);
  res.json({ success: true, info });
}));

// ── 2. Trim / Cắt Video ───────────────────────────────────────────────────────
router.post('/trim', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { start = 0, end, duration } = req.body;
  const { path: out } = await video.trimVideo(req.file.path, { start, end, duration });
  await respondFile(req, res, out, 'video-trim');
}));

// ── 3. Merge / Ghép Video ─────────────────────────────────────────────────────
router.post('/merge', optionalAuth, freeModeUpgrade, upload.array('files', 20), wrap(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Cần ít nhất 2 file video để ghép' });
  const { transition = 'none', transitionDuration = 0.5 } = req.body;
  const { path: out, clipCount } = await video.mergeVideos(
    req.files.map(f => f.path),
    { transition, transitionDuration: Number(transitionDuration) }
  );
  await respondFile(req, res, out, 'video-merge', { clipCount });
}));

// ── 4. Compress / Nén Video ───────────────────────────────────────────────────
router.post('/compress', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { quality = 'medium', maxWidth, format = 'mp4' } = req.body;
  const result = await video.compressVideo(req.file.path, { quality, maxWidth, format });
  await respondFile(req, res, result.path, 'video-compress', {
    origSize: result.origSize,
    newSize:  result.newSize,
    ratio:    result.ratio?.toFixed(1) + '%',
  });
}));

// ── 5. Convert / Chuyển Đổi Định Dạng ─────────────────────────────────────────
router.post('/convert', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { format = 'mp4', resolution, fps } = req.body;
  const { path: out } = await video.convertFormat(req.file.path, { format, resolution, fps });
  await respondFile(req, res, out, 'video-convert');
}));

// ── 6. Speed / Tốc Độ ────────────────────────────────────────────────────────
router.post('/speed', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { speed = 2.0 } = req.body;
  const { path: out } = await video.changeSpeed(req.file.path, { speed: Number(speed) });
  await respondFile(req, res, out, 'video-speed');
}));

// ── 7. Thay Thế / Xóa Âm Thanh ────────────────────────────────────────────────
router.post('/replace-audio', optionalAuth, freeModeUpgrade, upload.fields([{ name: 'video' }, { name: 'audio' }]), wrap(async (req, res) => {
  if (!req.files?.video?.[0] || !req.files?.audio?.[0]) {
    return res.status(400).json({ error: 'Cần tải lên cả file video và file audio' });
  }
  const { volume = 1.0, loop = false } = req.body;
  const { path: out } = await video.replaceAudio(
    req.files.video[0].path,
    req.files.audio[0].path,
    { volume: Number(volume), loop }
  );
  await respondFile(req, res, out, 'video-audio');
}));

router.post('/remove-audio', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { path: out } = await video.removeAudio(req.file.path);
  await respondFile(req, res, out, 'video-mute');
}));

// ── 8. Chỉnh Màu (Color Grade) ────────────────────────────────────────────────
router.post('/color', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { brightness, contrast, saturation, gamma, hue, vignette, sharpen, denoise } = req.body;
  const { path: out } = await video.colorGrade(req.file.path, {
    brightness: Number(brightness || 0),
    contrast:   Number(contrast   || 1),
    saturation: Number(saturation || 1),
    gamma:      Number(gamma      || 1),
    hue:        Number(hue        || 0),
    vignette:   vignette === 'true' || vignette === true,
    sharpen:    sharpen  === 'true' || sharpen === true,
    denoise:    denoise  === 'true' || denoise === true,
  });
  await respondFile(req, res, out, 'video-color');
}));

// ── 9. Subtitle / Phụ Đề ──────────────────────────────────────────────────────
router.post('/subtitle', optionalAuth, freeModeUpgrade, upload.fields([{ name: 'video' }, { name: 'srt' }]), wrap(async (req, res) => {
  if (!req.files?.video?.[0] || !req.files?.srt?.[0]) {
    return res.status(400).json({ error: 'Cần tải lên cả file video và file phụ đề SRT' });
  }
  const { style = 'tiktok' } = req.body;
  const { path: out } = await video.burnSubtitles(
    req.files.video[0].path,
    req.files.srt[0].path,
    null,
    { style }
  );
  await respondFile(req, res, out, 'video-subtitle');
}));

// ── 10. Watermark ─────────────────────────────────────────────────────────────
router.post('/watermark', optionalAuth, freeModeUpgrade, upload.fields([{ name: 'video' }, { name: 'watermark' }]), wrap(async (req, res) => {
  if (!req.files?.video?.[0] || !req.files?.watermark?.[0]) {
    return res.status(400).json({ error: 'Cần tải lên cả video và ảnh watermark' });
  }
  const { position = 'bottomright', opacity = 0.8, scale = 0.15 } = req.body;
  const { path: out } = await video.addVideoWatermark(
    req.files.video[0].path,
    req.files.watermark[0].path,
    { position, opacity: Number(opacity), scale: Number(scale) }
  );
  await respondFile(req, res, out, 'video-watermark');
}));

// ── 11. Split Screen ──────────────────────────────────────────────────────────
router.post('/split-screen', optionalAuth, freeModeUpgrade, upload.array('files', 4), wrap(async (req, res) => {
  if (!req.files?.length || req.files.length < 2) {
    return res.status(400).json({ error: 'Cần từ 2 đến 4 video để làm split screen' });
  }
  const { layout = '2x1', width, height } = req.body;
  const { path: out } = await video.splitScreen(
    req.files.map(f => f.path),
    { layout, width: width ? Number(width) : 1280, height: height ? Number(height) : 720 }
  );
  await respondFile(req, res, out, 'video-split-screen');
}));

// ── 12. Trích Xuất Frame & Nén ZIP ───────────────────────────────────────────
router.post('/frames', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { timestamps, every, format = 'jpg' } = req.body;
  const tsArr = timestamps ? JSON.parse(timestamps) : [];
  const { zipPath, frameCount } = await video.extractFrames(req.file.path, {
    timestamps: tsArr,
    every: every ? Number(every) : null,
    format
  });
  await respondFile(req, res, zipPath, 'video-frames', { frameCount });
}));

// ── 13. Chống Rung (Stabilize) ────────────────────────────────────────────────
router.post('/stabilize', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { strength = 'medium' } = req.body;
  const { path: out } = await video.stabilizeVideo(req.file.path, { strength });
  await respondFile(req, res, out, 'video-stabilize');
}));

// ── 14. Video sang GIF ────────────────────────────────────────────────────────
router.post('/to-gif', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { fps = 12, width = 480, start = 0, duration } = req.body;
  const { path: out } = await video.videoToGif(req.file.path, {
    fps: Number(fps),
    width: Number(width),
    start: Number(start),
    duration: duration ? Number(duration) : null,
  });
  await respondFile(req, res, out, 'video-to-gif');
}));

// ── 15. Thêm Chữ (Text Overlay) ───────────────────────────────────────────────
router.post('/text', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const opts = { ...req.body };
  if (opts.fontSize)  opts.fontSize  = Number(opts.fontSize);
  if (opts.startTime) opts.startTime = Number(opts.startTime);
  if (opts.endTime)   opts.endTime   = Number(opts.endTime);
  const { path: out } = await video.addTextOverlay(req.file.path, opts);
  await respondFile(req, res, out, 'video-text');
}));

// ── 16. Xóa Nền Video (Chroma Key) ────────────────────────────────────────────
router.post('/remove-bg', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { color = '0x00b140', similarity = 0.3, blend = 0.15 } = req.body;
  const { path: out } = await video.chromaKey(req.file.path, {
    color,
    similarity: Number(similarity),
    blend: Number(blend)
  });
  await respondFile(req, res, out, 'video-rembg');
}));

// ── 17. Phát Hiện Cảnh (Scene Cut Detection) ──────────────────────────────────
router.post('/scenes', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { threshold = 0.4 } = req.body;
  const result = await video.detectScenes(req.file.path, { threshold: Number(threshold) });
  res.json({ success: true, ...result });
}));

// ── 18. Quay Ngược Video (Reverse) ────────────────────────────────────────────
router.post('/reverse', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file video' });
  const { path: out } = await video.reverseVideo(req.file.path);
  await respondFile(req, res, out, 'video-reverse');
}));

// ── 19. Xử Lý Hàng Loạt (Batch) ───────────────────────────────────────────────
router.post('/batch', optionalAuth, freeModeUpgrade, upload.array('files', 20), wrap(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Chưa tải lên danh sách file' });
  const { operation = 'compress', ...operationOpts } = req.body;
  const results = await video.batchProcess(req.files.map(f => f.path), operation, operationOpts);
  res.json({ success: true, results });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PHẦN C: BOTOCIT FEATURES — GỠ WATERMARK GOOGLE FLOW & STORYTELLER CREATOR
// ─────────────────────────────────────────────────────────────────────────────

// ── 20. Xóa Watermark Google Flow / Veo 3 / Omini (Đơn Lẻ) ────────────────────
router.post('/watermark-remove', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên video hoặc ảnh cần gỡ watermark' });
  const { preset = 'google-flow', x, y, w, h } = req.body;

  const result = await video.removeWatermark(req.file.path, {
    preset,
    x: x ? Number(x) : undefined,
    y: y ? Number(y) : undefined,
    w: w ? Number(w) : undefined,
    h: h ? Number(h) : undefined,
  });

  await respondFile(req, res, result.path, 'video-watermark-remove', {
    detectedBox: result.detectedBox,
    preset:      result.preset,
    isImage:     result.isImage,
  });
}));

// ── 21. Xóa Watermark Hàng Loạt (Batch Watermark Removal) ────────────────────
router.post('/batch-watermark-remove', optionalAuth, freeModeUpgrade, upload.array('files', 30), wrap(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Chưa tải lên danh sách tệp cần xóa watermark' });
  const { preset = 'google-flow' } = req.body;

  const processed = await video.batchRemoveWatermark(req.files.map(f => f.path), { preset });
  const formattedResults = processed.map(item => {
    if (!item.success) return item;
    const filename = path.basename(item.outPath);
    return {
      file: item.file,
      success: true,
      downloadUrl: `/outputs/${filename}`,
      viewUrl: `/outputs/${filename}`,
      detectedBox: item.detectedBox,
    };
  });

  res.json({ success: true, results: formattedResults, count: formattedResults.length });
}));

// ── 22. Tạo Video Kể Chuyện Nhất Quán 2D Stickman (Story Creator) ────────────
router.post('/story-creator', optionalAuth, freeModeUpgrade, upload.array('sceneImages', 10), wrap(async (req, res) => {
  const { title = 'Câu Chuyện 2D', voice = 'Voice 1', style = 'stickman_2d' } = req.body;
  let rawScenes = [];

  try {
    rawScenes = typeof req.body.scenes === 'string' ? JSON.parse(req.body.scenes) : (req.body.scenes || []);
  } catch (_) {
    return res.status(400).json({ error: 'Định dạng kịch bản phân cảnh (scenes) không hợp lệ.' });
  }

  if (!rawScenes.length) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ít nhất 1 phân cảnh nội dung' });
  }

  // Gắn các file ảnh upload kèm theo vào từng cảnh nếu có
  const uploadedFiles = req.files || [];
  const scenesWithImages = rawScenes.map((sc, idx) => ({
    text: sc.text || sc,
    imagePath: uploadedFiles[idx]?.path || null
  }));

  const result = await video.generateConsistentStory(scenesWithImages, {
    title,
    voice,
    style
  });

  await respondFile(req, res, result.path, 'video-story-creator', {
    sceneCount: result.sceneCount,
    title: result.title,
  });
}));

module.exports = router;
