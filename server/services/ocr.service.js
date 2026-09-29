'use strict';

/**
 * ocr.service.js — Dịch vụ Nhận dạng ký tự quang học (OCR) đa năng với Tesseract
 * 
 * Hỗ trợ:
 * 1. OCR Ảnh -> Text thuần (JPG, PNG, WebP, TIFF).
 * 2. OCR PDF Scan -> Text thuần: Tự động trích xuất các trang PDF thành ảnh độ nét cao qua pdftoppm / Ghostscript rồi tiến hành OCR từng trang.
 * 3. Tạo Searchable PDF: Tạo file PDF có lớp văn bản ẩn có thể tìm kiếm, bôi đen và sao chép được cho cả Ảnh và file PDF Scan nhiều trang.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');
const UPLOADS = path.resolve('uploads');

[OUT, UPLOADS].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const { getTesseractExecutable, pdfToImages, runSafe } = require('../utils/binaries');

function runOcrSafe(executable, args = []) {
  try {
    return runSafe(executable, args);
  } catch (err) {
    throw new Error(`Tesseract OCR lỗi: ${err.message}`);
  }
}

function getAvailableLangs() {
  try {
    const out = runOcrSafe(getTesseractExecutable(), ['--list-langs']).toString();
    return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(1);
  } catch (_) {
    return ['eng'];
  }
}

function resolveLang(requestedLang = 'vie+eng') {
  const available = getAvailableLangs();
  const parts = requestedLang.split('+').map(l => l.trim()).filter(Boolean);
  const matched = parts.filter(p => available.includes(p));
  if (matched.length > 0) return matched.join('+');
  if (available.includes('eng')) return 'eng';
  return available[0] || 'eng';
}

// ── 1. OCR Ảnh -> Text thuần ──────────────────────────────────────────────────
async function ocrImage(filePath, lang = 'vie+eng') {
  // Nếu người dùng vô tình tải lên file PDF vào tab OCR Ảnh -> tự động chuyển sang ocrPdfScan
  if (/\.pdf$/i.test(filePath)) {
    return ocrPdfScan(filePath, lang);
  }

  const outBase = path.join(OUT, `ocr_${uuidv4()}`);
  const tessExe = getTesseractExecutable();
  const safeLang = resolveLang(lang);
  runSafe(tessExe, [filePath, outBase, '-l', safeLang]);
  const textFile = `${outBase}.txt`;
  const text = fs.readFileSync(textFile, 'utf8');
  try { fs.unlinkSync(textFile); } catch (_) {}
  return text.trim();
}

// ── 2. OCR PDF Scan -> Text thuần ─────────────────────────────────────────────
async function ocrPdfScan(filePath, lang = 'vie+eng') {
  // Nếu là file ảnh -> gọi ocrImage
  if (!/\.pdf$/i.test(filePath)) {
    return ocrImage(filePath, lang);
  }

  const tmpDir = path.join(UPLOADS, `ocr_pdf_${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. Chuyển đổi các trang PDF thành ảnh PNG chất lượng 200 DPI
    const pageImages = await pdfToImages(filePath, tmpDir, 200);
    const tessExe = getTesseractExecutable();
    const safeLang = resolveLang(lang);
    const results = [];

    // 2. OCR từng trang ảnh
    for (let i = 0; i < pageImages.length; i++) {
      const imgPath = pageImages[i];
      const pageBase = path.join(tmpDir, `ocr_page_${i + 1}`);
      try {
        runSafe(tessExe, [imgPath, pageBase, '-l', safeLang]);
        const textFile = `${pageBase}.txt`;
        if (fs.existsSync(textFile)) {
          const pageText = fs.readFileSync(textFile, 'utf8').trim();
          if (pageText) {
            results.push(`--- Trang ${i + 1} ---\n${pageText}`);
          }
        }
      } catch (pageErr) {
        console.warn(`[OCR] Lỗi nhận diện trang ${i + 1}:`, pageErr.message);
      }
    }

    // 3. Fallback an toàn: nếu ảnh scan quá mờ hoặc trống, kiểm tra xem PDF có text kỹ thuật số không
    if (results.length === 0) {
      try {
        const pdfBytes = fs.readFileSync(filePath);
        const parsed = await pdfParse(pdfBytes);
        if (parsed.text && parsed.text.trim()) {
          return parsed.text.trim();
        }
      } catch (_) {}
      return 'Không tìm thấy nội dung văn bản rõ ràng trong file PDF scan này.';
    }

    return results.join('\n\n');
  } finally {
    if (fs.existsSync(tmpDir)) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

// ── 3. Tạo Searchable PDF (Có lớp chữ để bôi đen, copy và tìm kiếm) ───────────
async function createSearchablePdf(filePath, lang = 'vie+eng') {
  const outBase = path.join(OUT, `searchable_${uuidv4()}`);
  const finalPdf = `${outBase}.pdf`;
  const tessExe = getTesseractExecutable();
  const safeLang = resolveLang(lang);

  // Trường hợp 1: Nếu đầu vào là file ảnh
  if (!/\.pdf$/i.test(filePath)) {
    runSafe(tessExe, [filePath, outBase, '-l', safeLang, 'pdf']);
    return finalPdf;
  }

  // Trường hợp 2: Đầu vào là file PDF (Tách các trang -> OCR từng trang thành PDF -> Hợp nhất)
  const tmpDir = path.join(UPLOADS, `searchable_tmp_${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const pageImages = await pdfToImages(filePath, tmpDir, 200);
    const pagePdfs = [];

    for (let i = 0; i < pageImages.length; i++) {
      const imgPath = pageImages[i];
      const pageOutBase = path.join(tmpDir, `page_pdf_${i + 1}`);
      runSafe(tessExe, [imgPath, pageOutBase, '-l', safeLang, 'pdf']);
      const generatedPdf = `${pageOutBase}.pdf`;
      if (fs.existsSync(generatedPdf)) {
        pagePdfs.push(generatedPdf);
      }
    }

    if (pagePdfs.length === 0) {
      throw new Error('Quá trình OCR không tạo được trang Searchable PDF nào.');
    }

    // Ghép tất cả các trang PDF có lớp chữ lại thành một tài liệu duy nhất
    const mergedDoc = await PDFDocument.create();
    for (const pagePdfPath of pagePdfs) {
      const pBytes = fs.readFileSync(pagePdfPath);
      const pDoc = await PDFDocument.load(pBytes);
      const copiedPages = await mergedDoc.copyPages(pDoc, pDoc.getPageIndices());
      copiedPages.forEach(p => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save();
    fs.writeFileSync(finalPdf, mergedBytes);
    return finalPdf;
  } finally {
    if (fs.existsSync(tmpDir)) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

module.exports = {
  ocrImage,
  ocrPdfScan,
  createSearchablePdf,
};
