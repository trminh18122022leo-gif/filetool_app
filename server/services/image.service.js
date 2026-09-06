'use strict';

const sharp = require('sharp');
const path  = require('path');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Chuyển đổi định dạng ảnh (jpg, png, webp, avif, tiff).
 */
async function convert(filePath, targetFormat = 'webp', quality = 85) {
  const outPath = path.join(OUT, `img_${uuidv4()}.${targetFormat}`);
  const instance = sharp(filePath);

  switch (targetFormat.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      await instance.jpeg({ quality: Number(quality) }).toFile(outPath);
      break;
    case 'png':
      await instance.png().toFile(outPath);
      break;
    case 'webp':
      await instance.webp({ quality: Number(quality) }).toFile(outPath);
      break;
    case 'avif':
      await instance.avif({ quality: Number(quality) }).toFile(outPath);
      break;
    case 'tiff':
      await instance.tiff({ quality: Number(quality) }).toFile(outPath);
      break;
    default:
      throw new Error(`Định dạng không hỗ trợ: ${targetFormat}`);
  }
  return outPath;
}

/**
 * Nén ảnh: giảm dung lượng qua quality và nén thông minh.
 */
async function compress(filePath, quality = 75) {
  const outPath = path.join(OUT, `compressed_${uuidv4()}.webp`);
  await sharp(filePath)
    .webp({ quality: Number(quality), effort: 6 })
    .toFile(outPath);
  return outPath;
}

/**
 * Thay đổi kích thước ảnh.
 */
async function resize(filePath, width, height, fit = 'inside') {
  const outPath = path.join(OUT, `resized_${uuidv4()}.webp`);
  await sharp(filePath)
    .resize({
      width:  width  ? Number(width)  : null,
      height: height ? Number(height) : null,
      fit,
      withoutEnlargement: true,
    })
    .toFile(outPath);
  return outPath;
}

/**
 * Cắt ảnh theo tọa độ (x, y, width, height).
 */
async function crop(filePath, left, top, width, height) {
  const outPath = path.join(OUT, `cropped_${uuidv4()}.webp`);
  await sharp(filePath)
    .extract({
      left:   Number(left),
      top:    Number(top),
      width:  Number(width),
      height: Number(height),
    })
    .toFile(outPath);
  return outPath;
}

/**
 * Áp dụng bộ lọc cho ảnh: grayscale, blur, sharpen, invert, sepia.
 */
async function filter(filePath, filterType = 'grayscale') {
  const outPath = path.join(OUT, `filtered_${uuidv4()}.webp`);
  let instance = sharp(filePath);

  switch (filterType) {
    case 'grayscale':
      instance = instance.grayscale();
      break;
    case 'blur':
      instance = instance.blur(5);
      break;
    case 'sharpen':
      instance = instance.sharpen();
      break;
    case 'invert':
      instance = instance.negate({ alpha: false });
      break;
    case 'sepia':
      instance = instance
        .modulate({ brightness: 1, saturation: 0.5 })
        .tint({ r: 255, g: 235, b: 190 });
      break;
    default:
      throw new Error(`Bộ lọc không hỗ trợ: ${filterType}`);
  }

  await instance.toFile(outPath);
  return outPath;
}

/**
 * Xóa phông nền ảnh (Remove Background).
 */
async function removeBg(filePath, maskInput = null) {
  const { removeBg: rb } = require('./removebg.service');
  return rb(filePath, maskInput);
}

/**
 * Xóa vật thể khỏi ảnh (AI Object Removal / Inpainting).
 */
async function removeObject(filePath, maskInput) {
  const { removeObject: ro } = require('./inpaint.service');
  return ro(filePath, maskInput);
}

module.exports = { convert, compress, resize, crop, filter, removeBg, removeObject };
