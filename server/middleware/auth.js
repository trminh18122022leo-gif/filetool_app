'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware bắt buộc phải đăng nhập.
 */
async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

/**
 * Middleware tùy chọn: nếu có token thì gắn req.user, không có thì vẫn cho qua.
 */
async function optionalAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user      = await User.findById(decoded.id).select('-password');
    }
  } catch (_) {}
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

module.exports = { requireAuth, optionalAuth, requireRole, requirePlan };
