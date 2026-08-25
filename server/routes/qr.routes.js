'use strict';

const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const qrSvc   = require('../services/qr.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Tạo QR độc lập
router.post('/generate', optionalAuth, wrap(async (req, res) => {
  const { data, format = 'png', size = 300, color = '#000000', bg = '#ffffff' } = req.body;
  if (!data?.trim()) return res.status(400).json({ error: 'Nội dung QR không được để trống' });

  const out = await qrSvc.generateQR(data.trim(), { format, size, color, bg });
  await respondFile(req, res, out, 'qr-generate', { format });
}));

// Nhúng QR vào PDF
router.post('/embed-pdf', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { qrData, page = 0, x = 50, y = 50, size = 100 } = req.body;
  if (!qrData?.trim()) return res.status(400).json({ error: 'Nội dung QR không được để trống' });

  const out = await qrSvc.embedQRToPdf(req.file.path, qrData.trim(), {
    page: Number(page),
    x:    Number(x),
    y:    Number(y),
    size: Number(size),
  });
  await respondFile(req, res, out, 'qr-embed-pdf');
}));

// Nhúng QR vào Ảnh
router.post('/embed-image', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { qrData, size = 120, position = 'bottom-right' } = req.body;
  if (!qrData?.trim()) return res.status(400).json({ error: 'Nội dung QR không được để trống' });

  const out = await qrSvc.embedQRToImage(req.file.path, qrData.trim(), {
    size: Number(size),
    position,
  });
  await respondFile(req, res, out, 'qr-embed-image');
}));

module.exports = router;
