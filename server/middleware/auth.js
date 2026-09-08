'use strict';

const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const { isAuthConnected } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_only_DO_NOT_USE_IN_PROD';

/**
 * Middleware bắt buộc phải đăng nhập.
 */
async function requireAuth(req, res, next) {
  try {
    const rawToken =
      req.cookies?.token ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!rawToken) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    let decoded;
    try {
      decoded = jwt.verify(rawToken, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    if (isAuthConnected()) {
      const user = await User.findById(decoded.id).select('-password -refreshToken -verifyToken -resetPasswordToken');
      if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' });

      // Nếu user đổi mật khẩu SAU khi token được cấp → block token cũ
      if (user.passwordChangedAt && decoded.iat) {
        const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (decoded.iat < changedAt) {
          return res.status(401).json({ error: 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại' });
        }
      }

      req.user = user;
    } else {
      // DB chưa kết nối — chỉ cho qua với info từ token (dev fallback)
      req.user = { _id: decoded.id, email: decoded.email, role: 'user', plan: 'pro' };
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Xác thực thất bại' });
  }
}

/**
 * Middleware tùy chọn: nếu có token thì gắn req.user, không có thì vẫn cho qua.
 */
async function optionalAuth(req, res, next) {
  try {
    const rawToken =
      req.cookies?.token ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (rawToken) {
      const decoded = jwt.verify(rawToken, JWT_SECRET);
      if (isAuthConnected()) {
        const user = await User.findById(decoded.id).select('-password -refreshToken');
        if (user) {
          if (user.passwordChangedAt && decoded.iat) {
            const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
            if (decoded.iat < changedAt) {
              return next(); // Token cũ → bỏ qua, không gắn user
            }
          }
          req.user = user;
        }
      } else {
        req.user = { _id: decoded.id, email: decoded.email, role: 'user', plan: 'pro' };
      }
    }
  } catch (_) {
    // Token lỗi → bỏ qua, không crash
  }
  next();
}

/**
 * Kiểm tra quyền role tối thiểu (vd: requireRole('admin')).
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    next();
  };
}

/**
 * Kiểm tra gói tối thiểu (vd: requirePlan('pro')).
 */
function requirePlan(minPlan) {
  const ranks = { free: 0, pro: 1, business: 2 };
  return (req, res, next) => {
    const userPlan = req.user?.plan || 'free';
    if ((ranks[userPlan] ?? 0) < (ranks[minPlan] ?? 0)) {
      return res.status(403).json({
        error: `Tính năng yêu cầu gói ${minPlan.toUpperCase()} trở lên`,
        currentPlan: userPlan,
        requiredPlan: minPlan,
        upgradeUrl: '/pricing',
      });
    }
    next();
  };
}

function freeModeUpgrade(req, res, next) {
  if (process.env.FREE_MODE === 'true' && req.user) {
    const proLimits = {
      uploadsPerMonth: -1,
      maxFileSizeMB: 100,
      maxBatchFiles: 20,
      apiAccess: true,
      storageGB: 5,
    };
    req.user.plan = 'pro';
    req.user.getPlanLimits = () => proLimits;
    req.user.canUpload = () => true;
  }
  next();
}

module.exports = { freeModeUpgrade, requireAuth, optionalAuth, requireRole, requirePlan };
