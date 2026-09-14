'use strict';

const express = require('express');
const path    = require('path');
const router  = express.Router();
const upload  = require('../middleware/upload');
const pdfSvc  = require('../services/pdf.service');
const { respondFile, respondFiles } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}
let freeModeUpgrade = (req,res,next)=>next();
try { freeModeUpgrade = require('../middleware/auth').freeModeUpgrade; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Gộp PDF (nhiều file hoặc sắp xếp từng trang)
router.post('/merge', optionalAuth, upload.array('files', 50), wrap(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  }
  let pageOrder = null;
  if (req.body.pageOrder) {
    try {
      pageOrder = typeof req.body.pageOrder === 'string' ? JSON.parse(req.body.pageOrder) : req.body.pageOrder;
    } catch (_) {}
  }
  if (!pageOrder && req.files.length < 2) {
    return res.status(400).json({ error: 'Cần ít nhất 2 file PDF để gộp hoặc chỉ định thứ tự trang' });
  }
  const paths   = req.files.map(f => f.path);
  const outPath = await pdfSvc.mergePDFs(paths, { pageOrder });
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


router.post('/sign', optionalAuth, freeModeUpgrade, upload.fields([{name: 'file', maxCount: 1}, {name: 'signature', maxCount: 1}]), wrap(async (req, res) => {
  const file = req.files?.['file']?.[0];
  const signatureFile = req.files?.['signature']?.[0];
  if (!file) return res.status(400).json({ error: 'Thiếu file PDF' });
  const inputPath = file.path;
  const outputPath = path.join(path.resolve('outputs'), `signed_${Date.now()}.pdf`);
  await pdfSvc.signPdf(inputPath, outputPath, {
    page: req.body.page,
    x: req.body.x,
    y: req.body.y,
    signatureText: req.body.signatureText,
    signatureImage: signatureFile ? signatureFile.path : null,
  });
  await respondFile(req, res, outputPath, 'pdf-sign');
}));


router.post('/page-numbers', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const creativeSvc = require('../services/creative.service');
  const { position = 'bottom-center', startFrom = 1, format = '{n}', fontSize = 11 } = req.body;
  const out = await creativeSvc.addPageNumbers(req.file.path, {
    position, startFrom: Number(startFrom), format, fontSize: Number(fontSize),
  });
  await respondFile(req, res, out, 'add-page-numbers');
}));

router.post('/header-footer', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const creativeSvc = require('../services/creative.service');
  const { headerText = '', footerText = '', fontSize = 10, color = '#888888' } = req.body;
  const out = await creativeSvc.addHeaderFooter(req.file.path, {
    headerText, footerText, fontSize: Number(fontSize), color,
  });
  await respondFile(req, res, out, 'header-footer');
}));

router.post('/delete-pages', optionalAuth, freeModeUpgrade, upload.single('file'), wrap(async (req, res) => {
  const creativeSvc = require('../services/creative.service');
  const { pages } = req.body;
  if (!pages) return res.status(400).json({ error: 'Thiếu danh sách trang cần xóa' });
  const deleteList = String(pages).split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
  const { path: out, removedCount, remainingPages } = await creativeSvc.deletePages(req.file.path, deleteList);
  await respondFile(req, res, out, 'delete-pages', { removedCount, remainingPages });
}));

router.post('/stats', upload.single('file'), wrap(async (req, res) => {
  const convertSvc = require('../services/convert.service');
  const stats = await convertSvc.getDocStats(req.file.path);
  res.json({ success: true, stats });
}));

// ── PDF Advanced Routes (converted.md) ─────────────────────────────────────────
const pdfAdv = require('../services/pdfAdvanced.service');

// 1. PDF → Markdown
router.post('/to-markdown', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { language = 'vi' } = req.body;
  const { path: out, wordCount } = await pdfAdv.pdfToMarkdown(req.file.path, { language });
  await respondFile(req, res, out, 'pdf-to-markdown', { wordCount });
}));

// 2. Scan ảnh → PDF
router.post('/scan-to-pdf', optionalAuth, upload.array('files', 50), wrap(async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Chưa có file ảnh' });
  const { mode = 'auto', enhance = 'true', searchable = 'true', paperSize = 'A4' } = req.body;
  const { path: out, pageCount } = await pdfAdv.scanToPdf(
    req.files.map(f => f.path),
    {
      mode,
      enhance: enhance === 'true' || enhance === true,
      searchable: searchable === 'true' || searchable === true,
      paperSize,
    }
  );
  await respondFile(req, res, out, 'scan-to-pdf', { pageCount });
}));

// 3. So sánh nội dung 2 PDF
router.post('/compare-text', optionalAuth, upload.array('files', 2), wrap(async (req, res) => {
  if (!req.files || req.files.length < 2) return res.status(400).json({ error: 'Cần đúng 2 file PDF để so sánh' });
  const { outputFormat = 'pdf' } = req.body;
  const result = await pdfAdv.comparePdfText(req.files[0].path, req.files[1].path, { outputFormat });
  if (outputFormat === 'json') {
    return res.json({ success: true, ...result });
  }
  await respondFile(req, res, result.path, 'compare-pdf-text', { stats: result.stats });
}));

// 4. HTML file → PDF
router.post('/html-to-pdf', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { format = 'A4' } = req.body;
  let out;
  if (req.file) {
    out = await pdfAdv.htmlFileToPdf(req.file.path, { format });
  } else if (req.body.html) {
    const tmpPath = path.join('uploads', `html_${Date.now()}.html`);
    fs.writeFileSync(tmpPath, req.body.html, 'utf-8');
    out = await pdfAdv.htmlFileToPdf(tmpPath, { format });
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  } else {
    return res.status(400).json({ error: 'Cần upload file .html hoặc gửi raw HTML trong body.html' });
  }
  await respondFile(req, res, out, 'html-to-pdf');
}));

// 5. Sắp xếp lại trang
router.post('/reorder', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { order } = req.body;
  if (!order) return res.status(400).json({ error: 'Thiếu thứ tự trang (order)' });
  const newOrder = String(order).split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
  const { path: out, pageCount } = await pdfAdv.reorderPages(req.file.path, newOrder);
  await respondFile(req, res, out, 'reorder-pdf', { pageCount });
}));

// 6. Cắt PDF (Crop)
router.post('/crop', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { x = 0, y = 0, width = 400, height = 600, pages = 'all' } = req.body;
  const { path: out, pagesProcessed } = await pdfAdv.cropPdf(req.file.path, {
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
    pages,
  });
  await respondFile(req, res, out, 'crop-pdf', { pagesProcessed });
}));

// 7. PDF → Excel
router.post('/to-excel', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { language = 'vi' } = req.body;
  const { path: out, tableCount } = await pdfAdv.pdfToExcel(req.file.path, { language });
  await respondFile(req, res, out, 'pdf-to-excel', { tableCount });
}));

// 8. PDF → PowerPoint
router.post('/to-pptx', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { dpi = 150 } = req.body;
  const { path: out, slideCount } = await pdfAdv.pdfToPptx(req.file.path, { dpi: Number(dpi) });
  await respondFile(req, res, out, 'pdf-to-pptx', { slideCount });
}));

// 9. Thêm ảnh vào PDF
router.post('/add-image', optionalAuth, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), wrap(async (req, res) => {
  const pdfFile = req.files?.['file']?.[0];
  const imgFile = req.files?.['image']?.[0];
  if (!pdfFile || !imgFile) return res.status(400).json({ error: 'Cần cả file PDF và file hình ảnh' });
  const { page = 0, x = 50, y = 50, width = 200, height = 150, opacity = 1 } = req.body;
  const { path: out } = await pdfAdv.addImageToPdf(pdfFile.path, imgFile.path, {
    page: Number(page),
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
    opacity: Number(opacity),
  });
  await respondFile(req, res, out, 'add-image-to-pdf');
}));

// 10. Flatten PDF
router.post('/flatten', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { path: out } = pdfAdv.flattenPdf(req.file.path);
  await respondFile(req, res, out, 'flatten-pdf');
}));

// 11. Chuyển sang PDF/A
router.post('/to-pdfa', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { level = '2b' } = req.body;
  const { path: out } = pdfAdv.toPdfA(req.file.path, { level });
  await respondFile(req, res, out, 'to-pdfa', { level });
}));

// 12. Sửa chữa PDF
router.post('/repair', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa tải lên file PDF' });
  const { path: out, origSize, newSize } = pdfAdv.repairPdf(req.file.path);
  await respondFile(req, res, out, 'repair-pdf', {
    origSize,
    newSize,
    saving: origSize > 0 ? Math.round((1 - newSize / origSize) * 100) + '%' : '0%',
  });
}));

// 13. Chèn trang từ PDF khác
router.post('/insert-pages', optionalAuth, upload.fields([{ name: 'base', maxCount: 1 }, { name: 'insert', maxCount: 1 }]), wrap(async (req, res) => {
  const baseFile   = req.files?.['base']?.[0];
  const insertFile = req.files?.['insert']?.[0];
  if (!baseFile || !insertFile) {
    return res.status(400).json({ error: 'Cần cả file PDF gốc (base) và file PDF cần chèn (insert)' });
  }
  const { afterPage = 0 } = req.body;
  const result = await pdfAdv.insertPages(baseFile.path, insertFile.path, Number(afterPage));
  await respondFile(req, res, result.path, 'insert-pages', {
    totalPages: result.totalPages,
    insertedPages: result.insertedPages,
    insertedAfter: result.insertedAfter,
  });
}));

module.exports = router;

