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

    const buf = Buffer.alloc(8);
    const fd  = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);

    const mime = (declaredMime || '').toLowerCase();

    // Image files
    if (mime.startsWith('image/')) {
      const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
      const isGif  = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
      const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
      const isBmp  = buf[0] === 0x42 && buf[1] === 0x4D;
      const isSvg  = buf[0] === 0x3C; // '<' (XML or SVG tag)
      if (isPng || isJpeg || isGif || isWebp || isBmp || isSvg) return true;
    }

    // PDF
    if (mime === 'application/pdf') {
      return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
    }

    // ZIP-based formats (DOCX, XLSX, PPTX, ZIP)
    if (mime.includes('openxmlformats') || mime === 'application/zip' || mime.includes('compressed')) {
      return buf[0] === 0x50 && buf[1] === 0x4B && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
    }

    // Audio / Video
    if (mime.startsWith('audio/') || mime.startsWith('video/')) {
      const isMp3    = (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33);
      const isRiff   = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46; // WAV, AVI
      const isOgg    = buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53;
      const isFlac   = buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43;
      const isMp4    = buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70; // ftyp
      if (isMp3 || isRiff || isOgg || isFlac || isMp4) return true;
    }

    // Plain text / CSV / JSON
    if (mime.startsWith('text/') || mime === 'application/json' || mime === 'text/csv') {
      return true;
    }

    // Pass unknown MIME to avoid false positives
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

  for (const file of files) {
    // 1. Path traversal & dangerous character sanitization
    const dangerousPatterns = /\.\.(\/|\\)|<|>|&|\||;|`|\$|\{|\}/;
    if (dangerousPatterns.test(file.originalname)) {
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
      AuditLog.log({
        userId: req.user?._id,
        action: 'suspicious.filename',
        severity: 'warning',
        ip: req.ip,
        meta: { originalname: file.originalname },
      });
      return res.status(400).json({ error: 'Tên file chứa ký tự không hợp lệ hoặc nghi vấn tấn công path traversal.', code: 'INVALID_FILENAME' });
    }

    // 2. Extension whitelist
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [
      '.pdf', '.docx', '.xlsx', '.pptx', '.doc', '.xls',
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.tiff', '.bmp', '.svg',
      '.zip', '.csv', '.txt', '.md', '.json',
      '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.aac', '.flac',
    ];
    if (ext && !allowedExts.includes(ext)) {
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
      return res.status(400).json({ error: `Định dạng tệp "${ext}" không được hệ thống hỗ trợ.`, code: 'INVALID_EXTENSION' });
    }

    // 3. Magic bytes validation
    if (!checkMagicBytes(file.path, file.mimetype)) {
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
      AuditLog.log({
        userId: req.user?._id,
        action: 'file.spoofed_mime',
        severity: 'warning',
        ip: req.ip,
        meta: { originalname: file.originalname, mimetype: file.mimetype },
      });
      return res.status(400).json({
        error: `Tệp "${file.originalname}" không hợp lệ. Nội dung nhị phân thực tế không khớp với định dạng tệp khai báo.`,
        code:  'INVALID_FILE_CONTENT',
      });
    }
  }

  next();
}

// ── NoSQL Injection Prevention ────────────────────────────────────────────────
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      const cleaned = {};
      for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) continue; // Strip operators
        cleaned[key] = sanitize(obj[key]);
      }
      return cleaned;
    };
    req.body = sanitize(req.body);
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
