'use strict';

const express  = require('express');
const router   = express.Router();
const upload   = require('../middleware/upload');
const imageSvc = require('../services/image.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Chuyển đổi định dạng
router.post('/convert', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { format = 'webp', quality = 85 } = req.body;
  const out = await imageSvc.convert(req.file.path, format, quality);
  await respondFile(req, res, out, 'image-convert', { format });
}));

// Nén ảnh
router.post('/compress', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { quality = 75 } = req.body;
  const out = await imageSvc.compress(req.file.path, quality);
  await respondFile(req, res, out, 'image-compress');
}));

// Resize ảnh
router.post('/resize', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { width, height, fit = 'inside' } = req.body;
  const out = await imageSvc.resize(req.file.path, width, height, fit);
  await respondFile(req, res, out, 'image-resize');
}));

// Crop ảnh
router.post('/crop', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { left = 0, top = 0, width, height } = req.body;
  if (!width || !height) return res.status(400).json({ error: 'Cần truyền width và height' });
  const out = await imageSvc.crop(req.file.path, left, top, width, height);
  await respondFile(req, res, out, 'image-crop');
}));

// Filter ảnh
router.post('/filter', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { filter: filterType = 'grayscale' } = req.body;
  const out = await imageSvc.filter(req.file.path, filterType);
  await respondFile(req, res, out, 'image-filter', { filter: filterType });
}));

// Remove BG
router.post('/remove-bg', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const out = await imageSvc.removeBg(req.file.path);
  await respondFile(req, res, out, 'remove-bg');
}));

module.exports = router;
