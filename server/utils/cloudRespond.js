/**
 * Utility: Trả response sau xử lý file.
 * - User đã login + R2 đã config -> upload cloud -> signed URL
 * - Ngược lại -> file local như cũ (không crash)
 */
'use strict';

const path = require('path');

let uploadToCloud = null;
try {
  uploadToCloud = require('../services/storage.service').uploadToCloud;
} catch (_) {}

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {string}  localPath  - đường dẫn file kết quả trên disk
 * @param {string}  operation  - tên thao tác lưu vào FileRecord
 * @param {object}  extra      - thêm fields tuỳ ý vào JSON response
 */
async function respondFile(req, res, localPath, operation, extra = {}) {
  const filename = path.basename(localPath);

  if (req.user && uploadToCloud && process.env.R2_ENDPOINT) {
    try {
      const { record, downloadUrl } = await uploadToCloud(localPath, {
        userId:       req.user._id,
        originalName: req.file?.originalname || filename,
        operation,
      });
      return res.json({
        success:    true,
        file:       filename,
        downloadUrl,
        recordId:   String(record._id),
        cloud:      true,
        ...extra,
      });
    } catch (err) {
      console.error('[cloudRespond] upload failed, fallback local:', err.message);
    }
  }

  return res.json({ success: true, file: filename, cloud: false, ...extra });
}

/**
 * Dùng khi kết quả là nhiều file (vd: split PDF)
 */
async function respondFiles(req, res, localPaths, operation, extra = {}) {
  if (req.user && uploadToCloud && process.env.R2_ENDPOINT && localPaths.length > 0) {
    try {
      const records = [];
      for (const lp of localPaths) {
        const { record, downloadUrl } = await uploadToCloud(lp, {
          userId:       req.user._id,
          originalName: path.basename(lp),
          operation,
        });
        records.push({ file: path.basename(lp), downloadUrl, recordId: String(record._id) });
      }
      return res.json({
        success: true,
        files:   records.map(r => r.file),
        records,
        cloud:   true,
        ...extra,
      });
    } catch (err) {
      console.error('[cloudRespond] batch upload failed, fallback local:', err.message);
    }
  }

  return res.json({
    success: true,
    files:   localPaths.map(p => path.basename(p)),
    cloud:   false,
    ...extra,
  });
}

module.exports = { respondFile, respondFiles };
