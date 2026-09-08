'use strict';

const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const User     = require('../models/User');
const emailSvc = require('./email.service');

const JWT_SECRET         = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[auth.service] CẢNH BÁO: JWT_SECRET chưa được đặt trong .env! Hãy tạo một secret key mạnh ngay lập tức.');
}

const EFFECTIVE_SECRET = JWT_SECRET || 'fallback_dev_only_DO_NOT_USE_IN_PROD_' + Date.now();

function generateTokens(userId) {
  const token = jwt.sign({ id: userId }, EFFECTIVE_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET || EFFECTIVE_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { token, refreshToken };
}

function signToken(userId) {
  return generateTokens(userId).token;
}

async function register({ email, password, name }) {
  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  if (existing) {
    throw new Error('Email đã được sử dụng');
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    email: normalized,
    password,
    name: (name || normalized.split('@')[0]).trim(),
    verifyToken,
  });

  try {
    await emailSvc.sendVerificationEmail(user.email, verifyToken);
  } catch (err) {
    console.error('[auth] Không thể gửi email xác thực:', err.message);
  }

  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return { user: formatUser(user), ...tokens };
}

async function login({ email, password }) {
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized }).select('+password');
  if (!user) {
    throw new Error('Email hoặc mật khẩu không chính xác');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Email hoặc mật khẩu không chính xác');
  }

  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return { user: formatUser(user), ...tokens };
}

async function verifyEmail(token) {
  const user = await User.findOne({ verifyToken: token });
  if (!user) throw new Error('Token xác thực không hợp lệ hoặc đã hết hạn');

  user.isVerified  = true;
  user.verifyToken = undefined;
  await user.save();
  return { success: true };
}

async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  // Luôn trả về thông báo giống nhau (không tiết lộ email có tồn tại hay không)
  if (!user) return { message: 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.' };

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken   = resetToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await user.save();

  try {
    await emailSvc.sendPasswordResetEmail(user.email, resetToken);
  } catch (err) {
    console.error('[auth] Không thể gửi email đặt lại mật khẩu:', err.message);
  }
  return { message: 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.' };
}

async function resetPassword(token, newPassword) {
  const user = await User.findOne({
    resetPasswordToken:   token,
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw new Error('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');

  user.password             = newPassword;
  user.resetPasswordToken   = undefined;
  user.resetPasswordExpires = undefined;
  user.refreshToken         = undefined; // Xóa refresh token — bắt đăng nhập lại
  user.passwordChangedAt    = new Date(); // Invalidate mọi JWT cũ
  await user.save();
  return { success: true };
}

async function refreshAccessToken(refreshToken) {
  const secret = JWT_REFRESH_SECRET || EFFECTIVE_SECRET;
  const decoded = jwt.verify(refreshToken, secret);
  const user = await User.findById(decoded.id);

  if (!user || user.refreshToken !== refreshToken) {
    throw new Error('Refresh token không hợp lệ');
  }

  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return { user: formatUser(user), ...tokens };
}

// Xóa refresh token khi logout (vô hiệu hoá phiên từ server)
async function invalidateRefreshToken(userId) {
  try {
    await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
  } catch (err) {
    console.error('[auth] Không thể xóa refresh token:', err.message);
  }
}

function formatUser(user) {
  return {
    id:               user._id,
    email:            user.email,
    name:             (user.name || (user.email ? user.email.split('@')[0] : 'User')).trim(),
    // KHÔNG trả avatar URL — client luôn dùng chữ cái đầu
    authProvider:     user.authProvider || 'local',
    role:             user.role || 'user',
    plan:             user.plan || 'free',
    isVerified:       user.isVerified,
    cloudStorageUsed: user.cloudStorageUsed || 0,
    dailyUsage:       user.dailyUsage,
  };
}

module.exports = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  invalidateRefreshToken,
  formatUser,
  generateTokens,
  signToken,
};
