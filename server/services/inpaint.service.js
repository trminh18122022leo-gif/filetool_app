'use strict';

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Perform Fast Multi-Scale Content-Aware Inpainting on raw pixel buffers.
 * @param {Buffer} imgBuffer - Raw RGB/RGBA buffer
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} channels - Number of color channels (3 or 4)
 * @param {Uint8Array} mask - Binary mask (255 = inpaint, 0 = keep)
 */
function fastInpaint(imgBuffer, width, height, channels, mask) {
  const result = Buffer.from(imgBuffer);
  const totalPixels = width * height;

  // Find all masked pixel indices
  const maskedIndices = [];
  const isMasked = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (mask[i] > 30) {
      maskedIndices.push(i);
      isMasked[i] = 1;
    }
  }

  if (maskedIndices.length === 0) return result;

  // Step 1: Compute distance transform / boundary outward search
  // For each masked pixel, compute color from nearby unmasked boundary pixels
  const maxRadius = Math.min(Math.max(width, height), 64);

  // Iterative multi-pass diffusion from boundary inwards
  const passes = 6;
  for (let pass = 0; pass < passes; pass++) {
    for (let idx = 0; idx < maskedIndices.length; idx++) {
      const pIdx = maskedIndices[idx];
      const px = pIdx % width;
      const py = Math.floor(pIdx / width);

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      let weightSum = 0;

      const currentRadius = Math.min(maxRadius, 3 + pass * 4);

      for (let dy = -currentRadius; dy <= currentRadius; dy += 2) {
        const ny = py + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -currentRadius; dx <= currentRadius; dx += 2) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= width) continue;

          const nIdx = ny * width + nx;
          const distSq = dx * dx + dy * dy;
          if (distSq > currentRadius * currentRadius) continue;

          // Weight is higher for unmasked pixels and close pixels
          let weight = 1 / (1 + distSq);
          if (isMasked[nIdx]) {
            if (pass === 0) continue; // In pass 0 only use original unmasked pixels
            weight *= 0.2; // In later passes use partially filled pixels with low weight
          }

          const nByte = nIdx * channels;
          rSum += result[nByte] * weight;
          gSum += result[nByte + 1] * weight;
          bSum += result[nByte + 2] * weight;
          if (channels === 4) aSum += result[nByte + 3] * weight;
          weightSum += weight;
        }
      }

      if (weightSum > 0) {
        const byteIdx = pIdx * channels;
        result[byteIdx] = Math.round(rSum / weightSum);
        result[byteIdx + 1] = Math.round(gSum / weightSum);
        result[byteIdx + 2] = Math.round(bSum / weightSum);
        if (channels === 4) {
          result[byteIdx + 3] = Math.round(aSum / weightSum);
        }
      }
    }
  }

  // Step 2: Smoothing pass over masked region for seamless blending
  for (let idx = 0; idx < maskedIndices.length; idx++) {
    const pIdx = maskedIndices[idx];
    const px = pIdx % width;
    const py = Math.floor(pIdx / width);

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const ny = py + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -2; dx <= 2; dx++) {
        const nx = px + dx;
        if (nx < 0 || nx >= width) continue;
        const nByte = (ny * width + nx) * channels;
        rSum += result[nByte];
        gSum += result[nByte + 1];
        bSum += result[nByte + 2];
        count++;
      }
    }

    if (count > 0) {
      const byteIdx = pIdx * channels;
      result[byteIdx] = Math.round(rSum / count);
      result[byteIdx + 1] = Math.round(gSum / count);
      result[byteIdx + 2] = Math.round(bSum / count);
    }
  }

  return result;
}

/**
 * Remove objects / inpaint image.
 * @param {string} imagePath - Path to original image file
 * @param {string|Buffer} maskInput - Mask file path or base64 string or buffer
 * @returns {Promise<string>} Path to output inpainted image
 */
async function removeObject(imagePath, maskInput) {
  // Read original image
  const imgMeta = await sharp(imagePath).metadata();
  const width = imgMeta.width;
  const height = imgMeta.height;

  // Process mask
  let maskBuffer;
  if (typeof maskInput === 'string' && maskInput.startsWith('data:image')) {
    const base64Data = maskInput.replace(/^data:image\/\w+;base64,/, '');
    maskBuffer = Buffer.from(base64Data, 'base64');
  } else if (typeof maskInput === 'string' && fs.existsSync(maskInput)) {
    maskBuffer = fs.readFileSync(maskInput);
  } else if (Buffer.isBuffer(maskInput)) {
    maskBuffer = maskInput;
  } else {
    throw new Error('Mask không hợp lệ hoặc thiếu dữ liệu vùng chọn.');
  }

  // Resize mask to exact image dimensions and extract grayscale 1-channel
  const { data: rawMask } = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Get raw image pixels (RGBA)
  const { data: rawImage, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Run inpainting
  const inpaintedRaw = fastInpaint(rawImage, width, height, info.channels, rawMask);

  // Save result
  const outPath = path.join(OUT, `inpainted_${uuidv4()}.png`);
  await sharp(inpaintedRaw, {
    raw: {
      width,
      height,
      channels: info.channels,
    },
  })
    .png({ quality: 95, compressionLevel: 6 })
    .toFile(outPath);

  return outPath;
}

module.exports = { removeObject };
