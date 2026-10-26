/**
 * Security Middleware Suite:
 * - Magic bytes file content verification
 * - Dangerous filename & path traversal sanitization
 * - Extension whitelist enforcement
 * - NoSQL injection prevention
 * - Suspicious payload detection & Audit logging
 */
'use strict';

const path     = require('path');
const fs       = require('fs');
const AuditLog = require('../models/AuditLog');

// ── Magic Bytes File Validation ───────────────────────────────────────────────
function checkMagicBytes(filePath, declaredMime) {
  try {
    if (!fs.existsSync(filePath)) return true;

    const stats = fs.statSync(filePath);
    if (stats.size < 4) return false; // File quá nhỏ không thể có header hợp lệ

    const buf = Buffer.alloc(Math.min(1024, stats.size));
    const fd  = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);

    // 1. Chặn đứng các binary nguy hiểm bất kể MIME type khai báo là gì
    // Windows PE Executable (MZ)
    if (buf[0] === 0x4D && buf[1] === 0x5A) return false;
    // Linux ELF binary (\x7fELF)
    if (buf[0] === 0x7F && buf[1] === 0x45 && buf[2] === 0x4C && buf[3] === 0x46) return false;
    // Java bytecode (CAFEBABE)
    if (buf[0] === 0xCA && buf[1] === 0xFE && buf[2] === 0xBA && buf[3] === 0xBE) return false;

    const mime = (declaredMime || '').toLowerCase();

    // 2. Kiểm tra PDF
    if (mime === 'application/pdf') {
      const isPdfHeader = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF-
      if (!isPdfHeader || stats.size < 32) return false;

      // PDF Complexity & Malicious payload guard
      const headerStr = buf.toString('latin1');
      if (headerStr.includes('/Launch') || headerStr.includes('/EmbeddedFiles/')) {
        return false;
      }
      return true;
    }

    // 3. Image files
    if (mime.startsWith('image/')) {
      const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
      const isGif  = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
      const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
      const isBmp  = buf[0] === 0x42 && buf[1] === 0x4D;
      const isAvif = buf.length >= 12 && buf.toString('latin1', 4, 12).includes('ftypavif');
      if (isPng || isJpeg || isGif || isWebp || isBmp || isAvif) return true;
      return false;
    }

    // 4. ZIP-based formats (DOCX, XLSX, PPTX, ZIP)
    if (mime.includes('openxmlformats') || mime === 'application/zip' || mime.includes('compressed')) {
      return buf[0] === 0x50 && buf[1] === 0x4B && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
    }

    // 5. Audio / Video
    if (mime.startsWith('audio/') || mime.startsWith('video/')) {
      const isMp3  = (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33);
      const isRiff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46; // WAV, AVI
      const isOgg  = buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53;
      const isFlac = buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43;
      const isMp4  = buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70; // ftyp (MP4, MOV, M4A)
      const isEbml = buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3; // MKV, WEBM
      if (isMp3 || isRiff || isOgg || isFlac || isMp4 || isEbml) return true;
      return false;
    }

    // 6. Plain text / CSV / JSON
    if (mime.startsWith('text/') || mime === 'application/json' || mime === 'text/csv') {
      // Chặn nếu text chứa PHP code hoặc executable tags
      const sample = buf.toString('utf-8');
      if (sample.includes('<?php') || sample.includes('<%@') || sample.includes('<script')) {
        return false;
      }
      return true;
    }

    return true;
  } catch (err) {
    console.error('[MagicBytes] Error checking file:', err.message);
    return false;
  }
}

// ── File Security Middleware ──────────────────────────────────────────────────
function validateUploadedFiles(req, res, next) {
  const files = req.files
    ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
    : req.file ? [req.file] : [];

  if (!files.length) return next();

  // File count guard
  if (files.length > 50) {
    for (const f of files) { try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_) {} }
    return res.status(400).json({ error: 'Số lượng tệp tải lên vượt quá giới hạn tối đa (50 tệp)', code: 'LIMIT_FILE_COUNT' });
  }

  const unlinkAll = () => {
    for (const f of files) {
      try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_) {}
    }
  };

  for (const file of files) {
    // 0. Symlink guard
    try {
      const lstat = fs.lstatSync(file.path);
      if (lstat.isSymbolicLink()) {
        unlinkAll();
        return res.status(400).json({ error: 'Không chấp nhận symbolic link.', code: 'INVALID_SYMLINK' });
      }
    } catch (_) {}

    // 1. Path traversal & dangerous character sanitization (path.resolve + startsWith)
    const rawName = file.originalname || '';
    const baseName = path.basename(rawName);
    const uploadBaseDir = path.resolve('uploads');
    const resolvedTarget = path.resolve(uploadBaseDir, baseName);

    const hasTraversal =
      rawName.includes('..') ||
      rawName.includes('/') ||
      rawName.includes('\\') ||
      baseName !== rawName ||
      !resolvedTarget.startsWith(uploadBaseDir);

    const hasDangerousChars = /[\x00-\x1F\x7F<>&|;`$"{}]/.test(rawName);

    if (hasTraversal || hasDangerousChars) {
      unlinkAll();
      AuditLog.log({
        userId: req.user?._id,
        action: 'suspicious.filename',
        severity: 'warning',
        ip: req.ip,
        meta: { originalname: file.originalname },
      });
      return res.status(400).json({ error: 'Tên file chứa ký tự không hợp lệ hoặc nghi vấn tấn công path traversal.', code: 'INVALID_FILENAME' });
    }

    // 2. Extension whitelist (loại trừ .svg để chống Stored XSS)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [
      '.pdf', '.docx', '.xlsx', '.pptx', '.doc', '.xls',
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.tiff', '.bmp',
      '.zip', '.csv', '.txt', '.md', '.json',
      '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.aac', '.flac',
    ];
    if (ext && !allowedExts.includes(ext)) {
      unlinkAll();
      return res.status(400).json({ error: `Định dạng tệp "${ext}" không được hệ thống hỗ trợ.`, code: 'INVALID_EXTENSION' });
    }

    // 3. Magic bytes validation & Complexity guard
    if (!checkMagicBytes(file.path, file.mimetype)) {
      unlinkAll();
      AuditLog.log({
        userId: req.user?._id,
        action: 'file.spoofed_mime',
        severity: 'warning',
        ip: req.ip,
        meta: { originalname: file.originalname, mimetype: file.mimetype },
      });
      return res.status(400).json({
        error: `Tệp "${file.originalname}" không hợp lệ. Nội dung nhị phân thực tế không khớp với định dạng tệp khai báo hoặc chứa mã lệnh nghi vấn.`,
        code:  'INVALID_FILE_CONTENT',
      });
    }
  }

  next();
}

// ── NoSQL Injection Prevention (chỉ sanitize query, body được xử lý bởi express-mongo-sanitize) ──
function sanitizeBody(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    const sanitize = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      const cleaned = {};
      for (const key of Object.keys(obj)) {
        if (key.startsWith('$')) continue; // Chỉ bỏ operator trên URL query
        cleaned[key] = sanitize(obj[key]);
      }
      return cleaned;
    };
    req.query = sanitize(req.query);
  }
  next();
}

// ── Detect Suspicious Request ─────────────────────────────────────────────────
function detectSuspicious(req, res, next) {
  const suspicious = [
    /\.\.(\/|\\)/,               // Path traversal
    /<script/i, /javascript:/i,  // XSS script
    /UNION.+SELECT/i,            // SQL injection in params
    /DROP.+TABLE/i,
    /[;&|`$]\s*(cat|ls|rm|curl|wget|sh|bash|powershell|cmd)/i, // Remote code execution
  ];

  const payload = (typeof req.body === 'object' ? JSON.stringify(req.body) : '') + (req.url || '');

  for (const pattern of suspicious) {
    if (pattern.test(payload)) {
      AuditLog.log({
        userId: req.user?._id,
        action: 'suspicious.request',
        severity: 'warning',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        meta: { pattern: pattern.toString() },
      });
      break;
    }
  }

  next();
}

module.exports = {
  validateUploadedFiles,
  sanitizeBody,
  detectSuspicious,
  checkMagicBytes,
};
