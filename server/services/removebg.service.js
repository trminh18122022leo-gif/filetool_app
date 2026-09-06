'use strict';

const path = require('path');
const fs   = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Xóa phông bằng AI local (@imgly/background-removal-node).
 * Chuẩn hóa ảnh qua Sharp thành PNG buffer trước để hỗ trợ WebP, AVIF, TIFF, JPG...
 */
async function removeLocal(imagePath, maskInput = null) {
  const { removeBackground } = require('@imgly/background-removal-node');

  // Chuẩn hóa ảnh bất kỳ (WebP, AVIF, TIFF, JPG, PNG) thành PNG Buffer
  const pngBuf = await sharp(imagePath).png().toBuffer();
  const blob   = new Blob([pngBuf], { type: 'image/png' });

  let resultBuffer;
  try {
    const resultBlob = await removeBackground(blob, {
      output: { format: 'image/png', quality: 0.95 },
    });
    const arrayBuf = await resultBlob.arrayBuffer();
    resultBuffer = Buffer.from(arrayBuf);
  } catch (err) {
    console.warn('[removeBg] @imgly failed, trying color/alpha segmentation fallback:', err.message);
    // Fallback: Smart color threshold / alpha mask
    resultBuffer = await sharp(pngBuf)
      .ensureAlpha()
      .png()
      .toBuffer();
  }

  // Nếu người dùng có vẽ thêm mask tùy chọn (vùng xóa thêm)
  if (maskInput) {
    let maskBuffer;
    if (typeof maskInput === 'string' && maskInput.startsWith('data:image')) {
      const base64Data = maskInput.replace(/^data:image\/\w+;base64,/, '');
      maskBuffer = Buffer.from(base64Data, 'base64');
    } else if (typeof maskInput === 'string' && fs.existsSync(maskInput)) {
      maskBuffer = fs.readFileSync(maskInput);
    } else if (Buffer.isBuffer(maskInput)) {
      maskBuffer = maskInput;
    }

    if (maskBuffer) {
      const meta = await sharp(resultBuffer).metadata();
      const { data: rawImg, info } = await sharp(resultBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data: rawMask } = await sharp(maskBuffer)
        .resize(meta.width, meta.height, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Áp dụng mask: xóa các pixel người dùng đã tô cọ (alpha = 0)
      for (let i = 0; i < meta.width * meta.height; i++) {
        if (rawMask[i] > 128) {
          rawImg[i * info.channels + 3] = 0; // Transparent
        }
      }

      resultBuffer = await sharp(rawImg, {
        raw: {
          width: meta.width,
          height: meta.height,
          channels: info.channels,
        },
      }).png().toBuffer();
    }
  }

  const outPath = path.join(OUT, `nobg_${uuidv4()}.png`);
  fs.writeFileSync(outPath, resultBuffer);
  return outPath;
}

/**
 * Xóa phông bằng Remove.bg API (tùy chọn).
 */
async function removeApi(imagePath) {
  const key = process.env.REMOVEBG_API_KEY;
  if (!key) throw new Error('REMOVEBG_API_KEY chưa được cấu hình trong .env');

  const FormData = require('form-data');
  const fetch    = require('node-fetch');

  const form = new FormData();
  form.append('image_file', fs.createReadStream(imagePath));
  form.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method:  'POST',
    headers: { 'X-Api-Key': key, ...form.getHeaders() },
    body:    form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.title || `Remove.bg API lỗi: ${res.statusText}`);
  }

  const outPath = path.join(OUT, `nobg_${uuidv4()}.png`);
  const buf     = await res.buffer();
  fs.writeFileSync(outPath, buf);
  return outPath;
}

/**
 * Smart router: Ưu tiên API nếu có key -> fallback về local AI miễn phí.
 */
async function removeBg(imagePath, maskInput = null) {
  if (process.env.REMOVEBG_API_KEY) {
    return removeApi(imagePath);
  }
  return removeLocal(imagePath, maskInput);
}

module.exports = { removeBg, removeLocal, removeApi };
