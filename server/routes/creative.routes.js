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

module.exports = router;
