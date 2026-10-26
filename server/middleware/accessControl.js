'use strict';

const path = require('path');
const fs   = require('fs');
const authSvc = require('../services/auth.service');
const { hasJobAccess } = require('../services/jobEmitter');

/**
 * Middleware kiểm tra quyền download/view file local.
 * Yêu cầu Signed Download Token hợp lệ (JWT) hoặc phiên đăng nhập của chính chủ file.
 */
async function validateDownloadAccess(req, res, next) {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename) {
      return res.status(400).json({ error: 'Tên file không hợp lệ', code: 'INVALID_FILENAME' });
    }

    const safeName = path.basename(rawFilename);
    if (safeName !== rawFilename || safeName.includes('..') || rawFilename.includes('/') || rawFilename.includes('\\')) {
      return res.status(400).json({ error: 'Phát hiện đường dẫn không an toàn', code: 'PATH_TRAVERSAL_DETECTED' });
    }

    const outputsDir = path.resolve('outputs');
    const targetPath = path.resolve(outputsDir, safeName);
    if (!targetPath.startsWith(outputsDir)) {
      return res.status(403).json({ error: 'Truy cập đường dẫn bị từ chối', code: 'PATH_TRAVERSAL_BLOCKED' });
    }

    // 1. Kiểm tra Signed Download Token
    const token = req.query.token || req.headers['x-download-token'];
    if (token) {
      let decoded;
      try {
        decoded = authSvc.verifyDownloadToken(token);
      } catch (tokenErr) {
        return res.status(403).json({
          error: 'Token tải file không hợp lệ hoặc đã hết hạn',
          code: 'INVALID_DOWNLOAD_TOKEN',
        });
      }

      if (decoded.filename !== safeName) {
        return res.status(403).json({
          error: 'Token không khớp với file yêu cầu',
          code: 'FILE_TOKEN_MISMATCH',
        });
      }

      // Nếu token được cấp riêng cho một user cụ thể, cấm user khác sử dụng
      if (decoded.userId && decoded.userId !== 'anonymous') {
        if (req.user && String(req.user._id) !== decoded.userId) {
          return res.status(403).json({
            error: 'Bạn không có quyền truy cập file thuộc sở hữu của người dùng khác',
            code: 'CROSS_USER_FORBIDDEN',
          });
        }
      }

      req.resolvedFilePath = targetPath;
      req.safeFilename     = safeName;
      return next();
    }

    // 2. Nếu không có token: Cho phép truy cập nếu là user đã login và sở hữu file trong FileRecord
    if (req.user) {
      try {
        const FileRecord = require('../models/FileRecord');
        const record = await FileRecord.findOne({
          $or: [
            { originalName: safeName, user: req.user._id },
            { cloudKey: { $regex: safeName }, user: req.user._id },
          ],
        });
        if (record) {
          req.resolvedFilePath = targetPath;
          req.safeFilename     = safeName;
          return next();
        }
      } catch (_) {}
    }

    // Không có token và không xác thực được quyền sở hữu
    return res.status(403).json({
      error: 'Yêu cầu token xác thực hoặc phiên đăng nhập hợp lệ để tải/xem file',
      code: 'FORBIDDEN_FILE_ACCESS',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'ACCESS_CONTROL_ERROR' });
  }
}

/**
 * Middleware kiểm tra quyền sở hữu đối với FileRecord trong DB
 */
function requireFileOwner(paramName = 'id') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Yêu cầu đăng nhập', code: 'UNAUTHENTICATED' });
      }
      const fileId = req.params[paramName];
      if (!fileId) {
        return res.status(400).json({ error: 'Thiếu fileId', code: 'MISSING_FILE_ID' });
      }
      const FileRecord = require('../models/FileRecord');
      const file = await FileRecord.findOne({ _id: fileId, user: req.user._id });
      if (!file) {
        return res.status(404).json({
          error: 'File không tồn tại hoặc bạn không có quyền truy cập',
          code: 'FILE_NOT_FOUND_OR_FORBIDDEN',
        });
      }
      req.fileRecord = file;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware kiểm tra quyền truy cập Job
 */
function requireJobAccess(paramName = 'jobId') {
  return (req, res, next) => {
    const jobId = req.params[paramName] || req.body[paramName];
    const secret = req.query.secret || req.headers['x-job-secret'] || req.body.jobSecret;

    if (!jobId) {
      return res.status(400).json({ error: 'Thiếu jobId', code: 'MISSING_JOB_ID' });
    }

    const userId = req.user?._id ? String(req.user._id) : null;
    const authorized = hasJobAccess(jobId, { userId, secret });

    if (!authorized) {
      return res.status(403).json({
        error: 'Bạn không có quyền truy cập job này',
        code: 'FORBIDDEN_JOB_ACCESS',
      });
    }

    next();
  };
}

module.exports = {
  validateDownloadAccess,
  requireFileOwner,
  requireJobAccess,
};
