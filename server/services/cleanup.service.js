'use strict';

const fs = require('fs');
const path = require('path');
const FileRecord = require('../models/FileRecord');
const storageSvc = require('./storage.service');

const MAX_TEMP_AGE_MS = 60 * 60 * 1000; // 1 giờ

/**
 * Xóa các file cũ hơn maxAgeMs trong thư mục chỉ định.
 */
function cleanDirectory(dirPath, maxAgeMs = MAX_TEMP_AGE_MS) {
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
        } else if (stat.isDirectory() && now - stat.mtimeMs > maxAgeMs) {
          fs.rmSync(fullPath, { recursive: true, force: true });
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
function cleanupTempFiles(maxAgeMs = MAX_TEMP_AGE_MS) {
  const uploadsDeleted = cleanDirectory(path.resolve('uploads'), maxAgeMs);
  const outputsDeleted = cleanDirectory(path.resolve('outputs'), maxAgeMs);
  return { uploadsDeleted, outputsDeleted };
}

/**
 * Đối soát và xóa các tệp lưu trữ cloud đã hết hạn (Retention Policy Reconciliation)
 */
async function reconcileExpiredCloudFiles() {
  let cloudDeleted = 0;
  try {
    const now = new Date();
    const expiredRecords = await FileRecord.find({
      expiresAt: { $lte: now },
      status:    { $ne: 'DELETED' },
    }).limit(100);

    for (const record of expiredRecords) {
      try {
        await storageSvc.deleteFromCloud(record._id, record.user);
        cloudDeleted++;
      } catch (err) {
        console.error(`[cleanup] Lỗi xóa cloud file hết hạn (ID: ${record._id}):`, err.message);
      }
    }
  } catch (err) {
    console.error('[cleanup] Lỗi truy vấn cloud records hết hạn:', err.message);
  }

  return cloudDeleted;
}

/**
 * Thực thi chu kỳ dọn dẹp đối soát toàn diện
 */
async function reconcileStorage(maxAgeMs = MAX_TEMP_AGE_MS) {
  const localStats = cleanupTempFiles(maxAgeMs);
  const cloudDeleted = await reconcileExpiredCloudFiles();
  return {
    ...localStats,
    cloudDeleted,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  cleanDirectory,
  cleanupTempFiles,
  reconcileExpiredCloudFiles,
  reconcileStorage,
};
