'use strict';

const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const dangerousExtensions = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.com',
  '.scr', '.pif', '.hta', '.cpl', '.msc', '.jar',
  '.php', '.phtml', '.php3', '.php4', '.php5', '.phps',
  '.jsp', '.jspx', '.asp', '.aspx', '.cer', '.asa',
  '.cgi', '.pl',
]);

const allowedMimes = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'image/gif',  'image/avif', 'image/tiff', 'image/bmp',
  'application/zip', 'application/x-zip-compressed', 'application/x-zip',
  'application/x-tar', 'application/gzip', 'application/x-gzip', 'application/x-7z-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'text/plain', 'text/csv', 'text/markdown', 'text/xml', 'application/json',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm',
  'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-flac',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/octet-stream', // Cho phép khi đi kèm extension nhị phân an toàn
]);

const allowedExtensions = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.tiff', '.bmp',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.txt', '.csv', '.md', '.json', '.xml',
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.mp4', '.mov',
]);

const octetStreamAllowedExts = new Set([
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // 1. Chặn các file nguy hiểm hoặc không có phần mở rộng
  if (!ext || dangerousExtensions.has(ext)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Định dạng tệp không được phép hoặc có rủi ro thực thi (${ext || 'không đuôi'})`));
  }

  // 2. Phải nằm trong danh sách extension hợp lệ
  if (!allowedExtensions.has(ext)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Định dạng phần mở rộng "${ext}" không được hỗ trợ.`));
  }

  // 3. Nếu là application/octet-stream, bắt buộc phải là tệp tài liệu/nén hợp lệ
  if (file.mimetype === 'application/octet-stream' && !octetStreamAllowedExts.has(ext)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Định dạng nhị phân không tương thích với phần mở rộng "${ext}".`));
  }

  // 4. MIME type phải hợp lệ
  if (allowedMimes.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `MIME type không được hỗ trợ (${file.mimetype})`));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
