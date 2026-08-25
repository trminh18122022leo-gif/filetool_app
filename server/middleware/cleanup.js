'use strict';

const fs   = require('fs');
const path = require('path');

const MAX_AGE_MS = 60 * 60 * 1000; // 1 giờ

/**
 * Xóa các file cũ hơn maxAgeMs trong thư mục chỉ định.
 */
function cleanDirectory(dirPath, maxAgeMs = MAX_AGE_MS) {
  if (!fs.existsSync(dirPath)) return 0;

  const now = Date.now();
  let deletedCount = 0;

  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      const fullPath = path.join(dirPath, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          deletedCount++;
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error(`[cleanup] Lỗi dọn dẹp thư mục ${dirPath}:`, err.message);
  }

  return deletedCount;
}

/**
 * Dọn dẹp cả thư mục uploads và outputs.
 */
function cleanupTempFiles(maxAgeMs = MAX_AGE_MS) {
  const uploadsDeleted = cleanDirectory(path.resolve('uploads'), maxAgeMs);
  const outputsDeleted = cleanDirectory(path.resolve('outputs'), maxAgeMs);
  return { uploadsDeleted, outputsDeleted };
}

module.exports = { cleanDirectory, cleanupTempFiles };
