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
  'image/gif',  'image/avif','image/tiff', 'image/bmp', 'image/svg+xml',
  'application/zip', 'application/x-zip-compressed', 'application/x-zip',
  'application/x-tar', 'application/gzip', 'application/x-gzip', 'application/x-7z-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/xml', 'application/json',
  'application/octet-stream', // rất phổ biến khi browser upload file nhị phân
]);

const allowedExtensions = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.tiff', '.bmp', '.svg',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.txt', '.csv', '.md', '.json', '.html', '.xml',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.has(file.mimetype) || allowedExtensions.has(ext) || !ext) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Định dạng file không được hỗ trợ (${file.mimetype || ext})`));
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});
