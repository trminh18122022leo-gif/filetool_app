'use strict';

const express   = require('express');
const router    = express.Router();
const upload    = require('../middleware/upload');
const officeSvc = require('../services/office.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

const requireFile = (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file cần xử lý' });
  next();
};

router.post('/docx-to-pdf', optionalAuth, upload.single('file'), requireFile, wrap(async (req, res) => {
  const out = await officeSvc.docToPdf(req.file.path);
  await respondFile(req, res, out, 'docx-to-pdf');
}));

router.post('/xlsx-to-pdf', optionalAuth, upload.single('file'), requireFile, wrap(async (req, res) => {
  const out = await officeSvc.xlsxToPdf(req.file.path);
  await respondFile(req, res, out, 'xlsx-to-pdf');
}));

router.post('/pptx-to-pdf', optionalAuth, upload.single('file'), requireFile, wrap(async (req, res) => {
  const out = await officeSvc.pptxToPdf(req.file.path);
  await respondFile(req, res, out, 'pptx-to-pdf');
}));

router.post('/xlsx-to-csv', optionalAuth, upload.single('file'), requireFile, wrap(async (req, res) => {
  const out = await officeSvc.xlsxToCsv(req.file.path);
  await respondFile(req, res, out, 'xlsx-to-csv');
}));

router.post('/csv-to-xlsx', optionalAuth, upload.single('file'), requireFile, wrap(async (req, res) => {
  const out = await officeSvc.csvToXlsx(req.file.path);
  await respondFile(req, res, out, 'csv-to-xlsx');
}));

router.post('/pdf-to-docx', optionalAuth, upload.single('file'), requireFile, wrap(async (req, res) => {
  const out = await officeSvc.pdfToDocx(req.file.path);
  await respondFile(req, res, out, 'pdf-to-docx');
}));

module.exports = router;
