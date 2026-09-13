'use strict';

const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Nhúng chữ ký (base64 PNG/JPG) vào trang PDF được chỉ định.
 * Tọa độ x, y tính từ góc trên-trái trang (PDF gốc tính từ dưới, hàm này tự flip).
 * Hỗ trợ cả tọa độ tương đối (0-1) lẫn pixel tuyệt đối.
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
  const pageIdx  = Math.max(0, Math.min(Number(page), pages.length - 1));
  const target   = pages[pageIdx];
  const { width: pw, height: ph } = target.getSize();

  // Chuyển đổi tọa độ nếu truyền dạng tỷ lệ 0-1
  const numX = Number(x);
  const numY = Number(y);
  const numW = Number(width);
  const numH = Number(height);

  const finalW = (numW > 0 && numW <= 1) ? numW * pw : (numW || 180);
  const finalH = (numH > 0 && numH <= 1) ? numH * ph : (numH || 70);
  const finalX = (numX >= 0 && numX <= 1) ? numX * (pw - finalW) : (numX || 50);
  const finalY = (numY >= 0 && numY <= 1) ? numY * (ph - finalH) : (numY || 100);

  // Nhúng ảnh vào PDF (hỗ trợ PNG hoặc JPEG)
  let sigImg;
  try {
    sigImg = await doc.embedPng(imgBuf);
  } catch (_) {
    sigImg = await doc.embedJpg(imgBuf);
  }

  target.drawImage(sigImg, {
    x:       Math.max(0, Math.min(finalX, pw - finalW)),
    y:       Math.max(0, ph - finalY - finalH),
    width:   finalW,
    height:  finalH,
    opacity: 0.98,
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
