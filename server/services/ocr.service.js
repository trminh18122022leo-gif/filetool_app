'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

function getTesseractCmd() {
  if (process.platform === 'win32') {
    const winPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    return fs.existsSync(winPath) ? `"${winPath}"` : 'tesseract';
  }
  return 'tesseract';
}

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Tesseract OCR lỗi: ${err.stderr?.toString() || err.message}`);
  }
}

// 1. OCR Ảnh -> Text thuần (hỗ trợ vie+eng)
async function ocrImage(filePath, lang = 'vie+eng') {
  const outBase = path.join(OUT, `ocr_${uuidv4()}`);
  const tessCmd = getTesseractCmd();
  run(`${tessCmd} "${filePath}" "${outBase}" -l ${lang}`);
  const textFile = `${outBase}.txt`;
  const text = fs.readFileSync(textFile, 'utf8');
  fs.unlinkSync(textFile); // Xóa file txt tạm
  return text;
}

// 2. OCR PDF dạng scan -> Text thuần
async function ocrPdfScan(filePath, lang = 'vie+eng') {
  const outBase = path.join(OUT, `ocr_pdf_${uuidv4()}`);
  const tessCmd = getTesseractCmd();
  run(`${tessCmd} "${filePath}" "${outBase}" -l ${lang}`);
  const textFile = `${outBase}.txt`;
  const text = fs.readFileSync(textFile, 'utf8');
  fs.unlinkSync(textFile);
  return text;
}

// 3. Tạo PDF có thể tìm kiếm (Searchable PDF — chèn lớp text ẩn vào PDF scan)
async function createSearchablePdf(filePath, lang = 'vie+eng') {
  const outBase = path.join(OUT, `searchable_${uuidv4()}`);
  const tessCmd = getTesseractCmd();
  run(`${tessCmd} "${filePath}" "${outBase}" -l ${lang} pdf`);
  return `${outBase}.pdf`;
}

module.exports = {
  ocrImage,
  ocrPdfScan,
  createSearchablePdf,
};
