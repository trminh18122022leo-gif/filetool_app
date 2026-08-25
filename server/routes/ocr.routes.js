'use strict';

const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const ocrSvc  = require('../services/ocr.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// OCR Ảnh -> Text
router.post('/image', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { lang = 'vie+eng' } = req.body;
  const text = await ocrSvc.ocrImage(req.file.path, lang);
  res.json({ success: true, text });
}));

// OCR PDF Scan -> Text
router.post('/pdf-scan', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { lang = 'vie+eng' } = req.body;
  const text = await ocrSvc.ocrPdfScan(req.file.path, lang);
  res.json({ success: true, text });
}));

// Tạo Searchable PDF (có downloadUrl khi đã login)
router.post('/searchable-pdf', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { lang = 'vie+eng' } = req.body;
  const outPath = await ocrSvc.createSearchablePdf(req.file.path, lang);
  await respondFile(req, res, outPath, 'ocr-searchable-pdf');
}));

module.exports = router;
