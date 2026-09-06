'use strict';

const express     = require('express');
const router      = express.Router();
const upload      = require('../middleware/upload');
const convertSvc  = require('../services/convert.service');
const pdfHtmlSvc  = require('../services/pdftohtml.service');
const { respondFile } = require('../utils/cloudRespond');
const path        = require('path');
const fs          = require('fs');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}
let freeModeUpgrade = (req, res, next) => next();
try { freeModeUpgrade = require('../middleware/auth').freeModeUpgrade; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

router.post('/pdf-to-html', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const { mode = 'html' } = req.body;
  const { zipName, fileCount } = await pdfHtmlSvc.convert(req.file.path, { mode });
  res.json({ success: true, file: zipName, fileCount });
}));

router.post('/images-to-pdf', optionalAuth, freeModeUpgrade, upload.array('files', 50), wrap(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Không có file ảnh nào được tải lên' });
  const { pageSize = 'A4', margin = 20 } = req.body;
  const paths  = req.files.map(f => f.path);
  const out    = await convertSvc.imagesToPdf(paths, { pageSize, margin: Number(margin) });
  await respondFile(req, res, out, 'images-to-pdf');
}));

router.post('/pdf-to-images', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const { format = 'jpg', dpi = 150 } = req.body;
  const { zipPath, pageCount } = await convertSvc.pdfToImages(req.file.path, {
    format, dpi: Number(dpi),
  });
  await respondFile(req, res, zipPath, 'pdf-to-images', { pageCount });
}));

router.post('/url-to-pdf', optionalAuth, freeModeUpgrade, wrap(async (req, res) => {
  const { url, format = 'A4' } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'Thiếu URL trang web' });
  const out = await convertSvc.urlToPdf(url.trim(), { format });
  await respondFile(req, res, out, 'url-to-pdf');
}));

router.post('/markdown-to-pdf', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const { theme = 'github' } = req.body;
  let mdContent;
  if (req.file) {
    mdContent = fs.readFileSync(req.file.path, 'utf-8');
  } else if (req.body.content) {
    mdContent = req.body.content;
  } else {
    return res.status(400).json({ error: 'Thiếu nội dung Markdown' });
  }
  const out = await convertSvc.markdownToPdf(mdContent, { theme });
  await respondFile(req, res, out, 'markdown-to-pdf');
}));

router.post('/doc-stats', upload.single('file'), wrap(async (req, res) => {
  const stats = await convertSvc.getDocStats(req.file.path);
  res.json({ success: true, stats });
}));

router.post('/json-to-excel', optionalAuth, freeModeUpgrade, wrap(async (req, res) => {
  const { data, sheetName } = req.body;
  if (!data) return res.status(400).json({ error: 'Thiếu dữ liệu JSON' });
  const out = await convertSvc.jsonToExcel(data, { sheetName });
  await respondFile(req, res, out, 'json-to-excel');
}));

router.post('/csv-to-excel', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const out = await convertSvc.csvToExcel(req.file.path);
  await respondFile(req, res, out, 'csv-to-excel');
}));

module.exports = router;
