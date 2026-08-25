'use strict';

const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const allowedMimes = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'image/gif',  'image/avif','image/tiff', 'image/bmp',
  'application/zip', 'application/x-zip-compressed',
  'application/x-tar', 'application/gzip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'text/plain', 'text/csv',
]);

const fileFilter = (req, file, cb) => {
  if (allowedMimes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Định dạng không hỗ trợ: ${file.mimetype}`));
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});
