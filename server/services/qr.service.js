'use strict';

const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Tạo file ảnh QR Code độc lập (PNG / SVG).
 */
async function generateQR(data, opts = {}) {
  const { format = 'png', size = 300, color = '#000000', bg = '#ffffff' } = opts;
  const outPath = path.join(OUT, `qr_${uuidv4()}.${format}`);

  if (format === 'svg') {
    const svgStr = await QRCode.toString(data, {
      type: 'svg',
      width: Number(size),
      color: { dark: color, light: bg },
    });
    fs.writeFileSync(outPath, svgStr);
  } else {
    await QRCode.toFile(outPath, data, {
      width: Number(size),
      color: { dark: color, light: bg },
    });
  }
  return outPath;
}

/**
 * Nhúng QR Code vào trang PDF.
 */
async function embedQRToPdf(pdfPath, qrData, opts = {}) {
  const { page = 0, x = 50, y = 50, size = 100 } = opts;

  // Tạo QR dạng PNG buffer trong bộ nhớ
  const qrBuf = await QRCode.toBuffer(qrData, { width: Number(size) * 2 });

  const pdfBytes = fs.readFileSync(pdfPath);
  const doc      = await PDFDocument.load(pdfBytes);
  const pages    = doc.getPages();
  const target   = pages[Math.min(Number(page), pages.length - 1)];
  const { height: ph } = target.getSize();

  const qrImg = await doc.embedPng(qrBuf);
  target.drawImage(qrImg, {
    x:      Number(x),
    y:      ph - Number(y) - Number(size), // flip y
    width:  Number(size),
    height: Number(size),
  });

  const out = path.join(OUT, `qr_embedded_${uuidv4()}.pdf`);
  fs.writeFileSync(out, await doc.save());
  return out;
}

/**
 * Nhúng QR Code vào ảnh (góc dưới-phải hoặc tọa độ tùy ý).
 */
async function embedQRToImage(imagePath, qrData, opts = {}) {
  const { size = 120, position = 'bottom-right' } = opts;

  const qrBuf = await QRCode.toBuffer(qrData, { width: Number(size) });
  const img   = sharp(imagePath);
  const meta  = await img.metadata();

  let left = 20, top = 20;
  if (position === 'bottom-right') {
    left = meta.width  - Number(size) - 20;
    top  = meta.height - Number(size) - 20;
  } else if (position === 'bottom-left') {
    left = 20;
    top  = meta.height - Number(size) - 20;
  } else if (position === 'top-right') {
    left = meta.width - Number(size) - 20;
    top  = 20;
  }

  const out = path.join(OUT, `qr_img_${uuidv4()}.png`);
  await img
    .composite([{ input: qrBuf, left: Math.max(0, left), top: Math.max(0, top) }])
    .toFile(out);

  return out;
}

module.exports = { generateQR, embedQRToPdf, embedQRToImage };
