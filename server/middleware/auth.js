'use strict';

const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');
const User     = require('../models/User');

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
      req.user = user;
    } else {
      req.user = { _id: decoded.id, email: decoded.email, role: 'user', plan: 'pro' };
    }

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      if (mongoose.connection.readyState === 1) {
        req.user = await User.findById(decoded.id).select('-password');
      } else {
        req.user = { _id: decoded.id, email: decoded.email, role: 'user', plan: 'pro' };
      }
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
