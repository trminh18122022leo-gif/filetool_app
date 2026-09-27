'use strict';

/**
 * vectorize.service.js — Dịch vụ biến ảnh Raster (PNG/JPG/WEBP) thành Vector SVG sắc nét vô hạn
 * Sử dụng thư viện Potrace kết hợp Sharp chuẩn hóa định dạng.
 */

const fs = require('fs');
const path = require('path');
const potrace = require('potrace');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const OUT_DIR = path.resolve('outputs');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/**
 * Chuyển đổi ảnh thành Vector SVG
 * @param {string} inputPath - Đường dẫn file ảnh nguồn
 * @param {object} options - Cấu hình vector hóa
 * @returns {Promise<{ svgPath: string, filename: string, svgContent: string, size: number }>}
 */
async function vectorizeImage(inputPath, options = {}) {
  const {
    mode = 'monochrome',      // 'monochrome' | 'posterize'
    color = '#000000',         // Màu vector (hoặc để mặc định)
    background = '',           // Màu nền (để rỗng nghĩa là nền trong suốt)
    threshold = 128,           // Ngưỡng bóc tách đen trắng (0 - 255)
    steps = 4,                 // Số tầng màu khi posterize (2 - 8)
    turdSize = 2,              // Lọc bỏ đốm nhiễu pixel nhỏ
    optCurve = true            // Tối ưu hóa đường cong Bezier
  } = options;

  // 1. Chuẩn hóa ảnh đầu vào bằng Sharp sang PNG buffer để tương thích 100% (WEBP, AVIF, TIFF, JPG)
  // Giới hạn max 2500px để chống cạn bộ nhớ RAM (OOM) khi người dùng upload ảnh khổng lồ
  const pngBuffer = await sharp(inputPath)
    .resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const outFilename = `vector_${uuidv4()}.svg`;
  const outPath = path.join(OUT_DIR, outFilename);

  // 2. Vector hóa bằng Potrace
  let svgContent = '';

  if (mode === 'posterize') {
    // Chế độ phân tầng nhiều màu (Color Posterization)
    svgContent = await new Promise((resolve, reject) => {
      potrace.posterize(pngBuffer, {
        steps: Math.max(2, Math.min(8, Number(steps) || 4)),
        threshold: Number(threshold) || 128,
        color: color || '#000000',
        background: background || potrace.Potrace.COLOR_AUTO,
        turdSize: Number(turdSize) || 2,
        optCurve: Boolean(optCurve),
        fillStrategy: potrace.Posterizer.FILL_SPREAD
      }, (err, svg) => {
        if (err) return reject(err);
        resolve(svg);
      });
    });
  } else {
    // Chế độ đơn sắc sắc nét (Monochrome)
    svgContent = await new Promise((resolve, reject) => {
      potrace.trace(pngBuffer, {
        threshold: Number(threshold) || 128,
        color: color || '#000000',
        background: background || potrace.Potrace.COLOR_AUTO,
        turdSize: Number(turdSize) || 2,
        optCurve: Boolean(optCurve)
      }, (err, svg) => {
        if (err) return reject(err);
        resolve(svg);
      });
    });
  }

  // 3. Ghi file SVG ra đĩa
  fs.writeFileSync(outPath, svgContent, 'utf-8');
  const size = fs.statSync(outPath).size;

  return {
    svgPath: outPath,
    filename: outFilename,
    svgContent,
    size
  };
}

module.exports = {
  vectorizeImage
};
