'use strict';

const rateLimit = require('express-rate-limit');

// Options chung cho tất cả rate limiters để hoạt động an toàn phía sau Render / reverse proxy
const baseConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    default: false,
  },
};

// Rate limit chung cho toàn bộ API
const apiRateLimit = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300,
  message: { error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút' },
});

// Rate limit nghiêm ngặt cho auth
const authRateLimit = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Quá nhiều lần thử. Vui lòng đợi 15 phút và thử lại' },
});

// Rate limit cực chặt cho đăng nhập (chống password brute-force)
const loginRateLimit = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng đợi 15 phút' },
  skipSuccessfulRequests: true, // Không đếm request đăng nhập thành công
});

// Rate limit cho đăng ký (chống tạo tài khoản spam)
const registerRateLimit = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5,
  message: { error: 'Quá nhiều tài khoản được tạo từ IP này. Vui lòng thử lại sau 1 giờ' },
});

// Rate limit cho các công cụ xử lý file (nặng CPU)
const toolRateLimit = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000, // 1 phút
  max: 30,
  message: { error: 'Thao tác quá nhanh, vui lòng chờ trong giây lát' },
});

// Rate limit cho upload
const uploadRateLimit = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Giới hạn upload: tối đa 20 file mỗi phút' },
});

// Rate limit cho forgot-password (chống spam email)
const forgotPasswordRateLimit = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3,
  message: { error: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ' },
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
