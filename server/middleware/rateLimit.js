'use strict';

const rateLimit = require('express-rate-limit');

// Rate limit chung cho toàn bộ API
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300,
  message: { error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit nghiêm ngặt cho auth (chống brute force)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Quá nhiều lần thử đăng nhập/đăng ký. Vui lòng đợi 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit cho các công cụ xử lý file (nặng CPU)
const toolRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 30,
  message: { error: 'Thao tác quá nhanh, vui lòng chờ trong giây lát' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit cho upload
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Giới hạn upload: tối đa 20 file mỗi phút' },
});

module.exports = { apiRateLimit, authRateLimit, toolRateLimit, uploadRateLimit };
