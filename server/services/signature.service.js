'use strict';

const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Nhúng chữ ký (base64 PNG) vào trang PDF được chỉ định.
 * Tọa độ x, y tính từ góc trên-trái trang (PDF gốc tính từ dưới, hàm này tự flip).
 */
async function embedSignature(pdfPath, signatureBase64, opts = {}) {
  const {
    page   = 0,    // trang (0-based)
    x      = 50,
    y      = 700,  // từ trên xuống
    width  = 200,
    height = 80,
  } = opts;

  // Bỏ phần header data URL nếu có
  const raw   = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
  const imgBuf = Buffer.from(raw, 'base64');

  const pdfBytes = fs.readFileSync(pdfPath);
  const doc      = await PDFDocument.load(pdfBytes);
  const pages    = doc.getPages();
  const target   = pages[Math.min(Number(page), pages.length - 1)];
  const { height: ph } = target.getSize();

  // pdf-lib gốc tọa độ từ dưới-trái -> flip y
  const sigImg = await doc.embedPng(imgBuf);
  target.drawImage(sigImg, {
    x:       Number(x),
    y:       ph - Number(y) - Number(height),
    width:   Number(width),
    height:  Number(height),
    opacity: 0.95,
  });

  const out = path.join(OUT, `signed_${uuidv4()}.pdf`);
  fs.writeFileSync(out, await doc.save());
  return out;
}

/**
 * Lấy thông tin trang để frontend hiển thị vị trí đặt chữ ký.
 */
async function getPageInfo(pdfPath) {
  const bytes = fs.readFileSync(pdfPath);
  const doc   = await PDFDocument.load(bytes);
  return doc.getPages().map((p, idx) => {
    const { width, height } = p.getSize();
    return { page: idx, width, height };
  });
}

module.exports = { embedSignature, getPageInfo };
