/**
 * Utility: Trả response sau xử lý file.
 * - User đã login + R2 đã config -> upload cloud -> signed URL
 * - Ngược lại -> file local như cũ (không crash)
 */
'use strict';

const path = require('path');
const fs   = require('fs');

let uploadToCloud = null;
try {
  uploadToCloud = require('../services/storage.service').uploadToCloud;
} catch (_) {}

function cleanupReqFiles(req, excludePath) {
  try {
    if (req.file?.path && req.file.path !== excludePath) {
      fs.unlink(req.file.path, () => {});
    }
    if (Array.isArray(req.files)) {
      for (const f of req.files) {
        if (f.path && f.path !== excludePath) {
          fs.unlink(f.path, () => {});
        }
      }
    }
  } catch (_) {}
}

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {string}  localPath  - đường dẫn file kết quả trên disk
 * @param {string}  operation  - tên thao tác lưu vào FileRecord
 * @param {object}  extra      - thêm fields tuỳ ý vào JSON response
 */
async function respondFile(req, res, localPath, operation, extra = {}) {
  if (!localPath || typeof localPath !== 'string') {
    return res.status(500).json({ error: 'Quá trình xử lý file không tạo ra kết quả hợp lệ.' });
  }

  const filename = path.basename(localPath);

  if (req.user && uploadToCloud && process.env.R2_ENDPOINT) {
    try {
      const { record, downloadUrl } = await uploadToCloud(localPath, {
        userId:       req.user._id,
        originalName: req.file?.originalname || filename,
        operation,
      });
      cleanupReqFiles(req, localPath);
      return res.json({
        success:     true,
        file:        filename,
        downloadUrl,
        viewUrl:     downloadUrl, // Đồng nhất hợp đồng dữ liệu cho UI preview
        recordId:    String(record._id),
        cloud:       true,
        ...extra,
      });
    } catch (err) {
      console.error('[cloudRespond] upload failed, fallback local:', err.message);
    }
  }

  const fs = require('fs');
  let dataUrl = null;
  const ext = path.extname(filename).toLowerCase();
  if (['.png', '.webp', '.jpg', '.jpeg', '.svg', '.gif'].includes(ext)) {
    try {
      const stats = fs.statSync(localPath);
      if (stats.size < 8 * 1024 * 1024) {
        const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        const b64 = fs.readFileSync(localPath).toString('base64');
        dataUrl = `data:${mime};base64,${b64}`;
      }
    } catch (_) {}
  }

  cleanupReqFiles(req, localPath);

  return res.json({
    success:     true,
    file:        filename,
    downloadUrl: `/api/download/${encodeURIComponent(filename)}`,
    viewUrl:     `/outputs/${encodeURIComponent(filename)}`,
    dataUrl:     extra.dataUrl || dataUrl,
    cloud:       false,
    ...extra,
  });
}

/**
 * Dùng khi kết quả là nhiều file (vd: split PDF)
 */
async function respondFiles(req, res, localPaths, operation, extra = {}) {
  if (!Array.isArray(localPaths) || localPaths.length === 0) {
    return res.status(500).json({ error: 'Quá trình xử lý không tạo ra file nào.' });
  }

  if (req.user && uploadToCloud && process.env.R2_ENDPOINT && localPaths.length > 0) {
    try {
      const records = [];
      for (const lp of localPaths) {
        const { record, downloadUrl } = await uploadToCloud(lp, {
          userId:       req.user._id,
          originalName: path.basename(lp),
          operation,
        });
        records.push({
          file:        path.basename(lp),
          downloadUrl,
          viewUrl:     downloadUrl,
          recordId:    String(record._id),
        });
      }
      cleanupReqFiles(req);
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

  const records = localPaths.map(p => {
    const fn = path.basename(p);
    return {
      file:        fn,
      downloadUrl: `/api/download/${encodeURIComponent(fn)}`,
      viewUrl:     `/outputs/${encodeURIComponent(fn)}`,
      recordId:    null,
    };
  });

  cleanupReqFiles(req);
  return res.json({
    success: true,
    files:   records.map(r => r.file),
    records,
    cloud:   false,
    ...extra,
  });
}

module.exports = { respondFile, respondFiles };
