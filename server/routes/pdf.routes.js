'use strict';

const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const pdfSvc  = require('../services/pdf.service');
const { respondFile, respondFiles } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Gộp PDF (nhiều file)
router.post('/merge', optionalAuth, upload.array('files', 20), wrap(async (req, res) => {
  if (!req.files || req.files.length < 2) {
    return res.status(400).json({ error: 'Cần ít nhất 2 file PDF để gộp' });
  }
  const paths   = req.files.map(f => f.path);
  const outPath = await pdfSvc.mergePDFs(paths);
  await respondFile(req, res, outPath, 'pdf-merge');
}));

// Tách PDF
router.post('/split', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const outputs = await pdfSvc.splitPDF(req.file.path);
  await respondFiles(req, res, outputs, 'pdf-split');
}));

// Nén PDF
router.post('/compress', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { quality = 'ebook' } = req.body;
  const outPath = await pdfSvc.compressPDF(req.file.path, quality);
  await respondFile(req, res, outPath, 'pdf-compress', { quality });
}));

// PDF -> Word
router.post('/to-word', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const outPath = await pdfSvc.pdfToWord(req.file.path);
  await respondFile(req, res, outPath, 'pdf-to-word');
}));

// Word -> PDF
router.post('/from-word', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const outPath = await pdfSvc.wordToPdf(req.file.path);
  await respondFile(req, res, outPath, 'word-to-pdf');
}));

// Trích xuất trang
router.post('/extract', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { pages } = req.body;
  if (!pages) return res.status(400).json({ error: 'Chưa chỉ định trang cần trích xuất (vd: 1,3,5-8)' });
  const outPath = await pdfSvc.extractPages(req.file.path, pages);
  await respondFile(req, res, outPath, 'pdf-extract', { pages });
}));

// Xoay PDF
router.post('/rotate', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { angle = 90 } = req.body;
  const outPath = await pdfSvc.rotatePDF(req.file.path, Number(angle));
  await respondFile(req, res, outPath, 'pdf-rotate', { angle });
}));

// Watermark
router.post('/watermark', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { text = 'CONFIDENTIAL', opacity = 0.3, size = 48 } = req.body;
  const outPath = await pdfSvc.addWatermark(req.file.path, text, {
    opacity: Number(opacity),
    size:    Number(size),
  });
  await respondFile(req, res, outPath, 'pdf-watermark');
}));

// Khóa mật khẩu PDF
router.post('/protect', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { userPassword, ownerPassword } = req.body;
  if (!userPassword) return res.status(400).json({ error: 'Chưa nhập mật khẩu' });
  const outPath = await pdfSvc.protectPDF(req.file.path, userPassword, ownerPassword);
  await respondFile(req, res, outPath, 'pdf-protect');
}));

// Mở khóa mật khẩu PDF
router.post('/unlock', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Chưa nhập mật khẩu để mở khóa' });
  const outPath = await pdfSvc.unlockPDF(req.file.path, password);
  await respondFile(req, res, outPath, 'pdf-unlock');
}));

// Dark Mode PDF
router.post('/dark-mode', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { bg = 'dark' } = req.body;
  const darkSvc = require('../services/darkpdf.service');
  const out = await darkSvc.convertToDarkMode(req.file.path, { bg });
  await respondFile(req, res, out, 'dark-mode');
}));

// Auto TOC
router.post('/auto-toc', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { title = 'MỤC LỤC', useAI = false } = req.body;
  const tocSvc = require('../services/toc.service');
  const { outPath, headingCount } = await tocSvc.generateTOC(req.file.path, {
    title,
    useAI: useAI === 'true' || useAI === true,
  });
  await respondFile(req, res, outPath, 'auto-toc', { headingCount });
}));

module.exports = router;
