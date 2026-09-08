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

// Rate limit nghiêm ngặt cho auth (chống brute force đăng nhập)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Quá nhiều lần thử. Vui lòng đợi 15 phút và thử lại' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit cực chặt cho đăng nhập (chống password brute-force)
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng đợi 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Không đếm request đăng nhập thành công
});

// Rate limit cho đăng ký (chống tạo tài khoản spam)
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5,
  message: { error: 'Quá nhiều tài khoản được tạo từ IP này. Vui lòng thử lại sau 1 giờ' },
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
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit cho forgot-password (chống spam email)
const forgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3,
  message: { error: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiRateLimit,
  authRateLimit,
  loginRateLimit,
  registerRateLimit,
  toolRateLimit,
  uploadRateLimit,
  forgotPasswordRateLimit,
};
