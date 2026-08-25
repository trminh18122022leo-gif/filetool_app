'use strict';

const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Xóa phông bằng AI local (@imgly/background-removal-node).
 * Hoàn toàn miễn phí, chạy trên CPU/GPU của máy, không cần API key.
 */
async function removeLocal(imagePath) {
  const { removeBackground } = require('@imgly/background-removal-node');

  // Đọc file ảnh thành Blob/Buffer
  const imgBuf = fs.readFileSync(imagePath);
  const blob   = new Blob([imgBuf]);

  const resultBlob = await removeBackground(blob, {
    output: { format: 'image/png', quality: 0.9 },
  });

  const arrayBuf = await resultBlob.arrayBuffer();
  const outPath  = path.join(OUT, `nobg_${uuidv4()}.png`);
  fs.writeFileSync(outPath, Buffer.from(arrayBuf));
  return outPath;
}

/**
 * Xóa phông bằng Remove.bg API (tùy chọn).
 * Nhanh hơn, chất lượng cao hơn, cần key trong .env.
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
async function removeBg(imagePath) {
  if (process.env.REMOVEBG_API_KEY) {
    return removeApi(imagePath);
  }
  return removeLocal(imagePath);
}

module.exports = { removeBg, removeLocal, removeApi };
