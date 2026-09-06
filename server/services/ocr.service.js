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

function getAvailableLangs() {
  try {
    const out = execSync(`${getTesseractCmd()} --list-langs`, { stdio: 'pipe' }).toString();
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

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Tesseract OCR lỗi: ${err.stderr?.toString() || err.message}`);
  }
}

// 1. OCR Ảnh -> Text thuần
async function ocrImage(filePath, lang = 'vie+eng') {
  const outBase = path.join(OUT, `ocr_${uuidv4()}`);
  const tessCmd = getTesseractCmd();
  const safeLang = resolveLang(lang);
  run(`${tessCmd} "${filePath}" "${outBase}" -l ${safeLang}`);
  const textFile = `${outBase}.txt`;
  const text = fs.readFileSync(textFile, 'utf8');
  try { fs.unlinkSync(textFile); } catch (_) {}
  return text;
}

// 2. OCR PDF dạng scan -> Text thuần
async function ocrPdfScan(filePath, lang = 'vie+eng') {
  const outBase = path.join(OUT, `ocr_pdf_${uuidv4()}`);
  const tessCmd = getTesseractCmd();
  const safeLang = resolveLang(lang);
  run(`${tessCmd} "${filePath}" "${outBase}" -l ${safeLang}`);
  const textFile = `${outBase}.txt`;
  const text = fs.readFileSync(textFile, 'utf8');
  try { fs.unlinkSync(textFile); } catch (_) {}
  return text;
}

// 3. Tạo Searchable PDF
async function createSearchablePdf(filePath, lang = 'vie+eng') {
  const outBase = path.join(OUT, `searchable_${uuidv4()}`);
  const tessCmd = getTesseractCmd();
  const safeLang = resolveLang(lang);
  run(`${tessCmd} "${filePath}" "${outBase}" -l ${safeLang} pdf`);
  return `${outBase}.pdf`;
}

module.exports = {
  ocrImage,
  ocrPdfScan,
  createSearchablePdf,
};
