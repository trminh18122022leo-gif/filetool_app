'use strict';

const authSvc = require('../services/auth.service');
const User    = require('../models/User');
const { isAuthConnected } = require('../config/database');

/**
 * Middleware bắt buộc phải đăng nhập.
 * Hỗ trợ Token trong Cookie (accessToken / token) hoặc Header (Authorization: Bearer ...)
 */
async function requireAuth(req, res, next) {
  try {
    const rawToken =
      req.cookies?.accessToken ||
      req.cookies?.token ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!rawToken) {
      return res.status(401).json({ error: 'Chưa đăng nhập', code: 'NO_TOKEN' });
    }

    let decoded;
    try {
      decoded = authSvc.verifyAccessToken(rawToken);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Token không hợp lệ', code: 'INVALID_TOKEN' });
    }

    const userId = decoded.userId || decoded.id;

    if (isAuthConnected()) {
      const user = await User.findById(userId).select('-password -verifyToken -resetPasswordToken -twoFactorSecret -twoFactorTempSecret');
      if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại', code: 'USER_NOT_FOUND' });

      // Nếu user đổi mật khẩu SAU khi token được cấp -> block token cũ
      if (user.passwordChangedAt && decoded.iat) {
        const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (decoded.iat < changedAt) {
          return res.status(401).json({ error: 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại', code: 'PASSWORD_CHANGED' });
        }
      }

      req.user = user;
    } else {
      req.user = { _id: userId, email: decoded.email, role: 'user', plan: 'pro' };
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Xác thực thất bại', code: 'AUTH_FAILED' });
  }
}

/**
 * Middleware tùy chọn: nếu có token thì gắn req.user, không có thì vẫn cho qua.
 */
async function optionalAuth(req, res, next) {
  try {
    const rawToken =
      req.cookies?.accessToken ||
      req.cookies?.token ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (rawToken) {
      const decoded = authSvc.verifyAccessToken(rawToken);
      const userId  = decoded.userId || decoded.id;
      if (isAuthConnected()) {
        const user = await User.findById(userId).select('-password -verifyToken -resetPasswordToken -twoFactorSecret');
        if (user) {
          if (user.passwordChangedAt && decoded.iat) {
            const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
            if (decoded.iat < changedAt) return next();
          }
          req.user = user;
        }
      } else {
        req.user = { _id: userId, email: decoded.email, role: 'user', plan: 'pro' };
      }
    }
  } catch (_) {}
  next();
}

/**
 * Kiểm tra quyền role (vd: requireRole('admin')).
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Không có quyền truy cập', code: 'FORBIDDEN' });
    }
    next();
  };
}

/**
 * Kiểm tra gói tối thiểu (vd: requirePlan('pro', 'business')).
 */
function requirePlan(...minPlans) {
  const ranks = { free: 0, pro: 1, business: 2 };
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Cần đăng nhập', code: 'UNAUTHENTICATED' });
    const userPlan = req.user.plan || 'free';
    const hasAccess = minPlans.some(p => (ranks[userPlan] ?? 0) >= (ranks[p] ?? 0));
    if (!hasAccess) {
      return res.status(403).json({
        error: `Tính năng yêu cầu gói ${minPlans.join(' hoặc ').toUpperCase()} trở lên`,
        code: 'INSUFFICIENT_PLAN',
        currentPlan: userPlan,
        requiredPlans: minPlans,
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

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requirePlan,
  freeModeUpgrade,
};
