'use strict';

const PLAN_LIMITS = {
  free: {
    maxFileSizeMB:   25,
    maxBatchFiles:   3,
    dailyOperations: 15,
    cloudStorage:    false,
    priorityQueue:   false,
  },
  pro: {
    maxFileSizeMB:   100,
    maxBatchFiles:   20,
    dailyOperations: 200,
    cloudStorage:    true,
    cloudRetentionDays: 7,
    priorityQueue:   true,
  },
  business: {
    maxFileSizeMB:   500,
    maxBatchFiles:   50,
    dailyOperations: Infinity,
    cloudStorage:    true,
    cloudRetentionDays: 30,
    priorityQueue:   true,
    customWatermark: true,
  },
};

const User = require('../models/User');

/**
 * Kiểm tra giới hạn số lượt xử lý trong ngày (Atomic Check & Increment).
 */
async function checkDailyLimit(req, res, next) {
  if (!req.user) return next();

  const plan   = req.user.plan || 'free';
  const limits = PLAN_LIMITS[plan];

  if (!limits || limits.dailyOperations === Infinity) {
    return next();
  }

  const today = new Date().toISOString().slice(0, 10);

  // 1. Thử tăng nguyên tử nếu đúng ngày và count chưa vượt giới hạn
  let updatedUser = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      'dailyUsage.date': today,
      'dailyUsage.count': { $lt: limits.dailyOperations },
    },
    { $inc: { 'dailyUsage.count': 1 } },
    { new: true }
  );

  // 2. Nếu không khớp, kiểm tra xem có phải do chuyển sang ngày mới hay không
  if (!updatedUser) {
    updatedUser = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        $or: [
          { 'dailyUsage.date': { $ne: today } },
          { dailyUsage: null },
          { 'dailyUsage.date': { $exists: false } },
        ],
      },
      { $set: { dailyUsage: { date: today, count: 1 } } },
      { new: true }
    );

    // 3. Nếu vẫn không khớp -> Thực sự đã hết hạn ngạch trong ngày hôm nay!
    if (!updatedUser) {
      return res.status(429).json({
        error:        `Bạn đã dùng hết ${limits.dailyOperations} lượt/ngày của gói ${plan.toUpperCase()}`,
        currentPlan:  plan,
        limit:        limits.dailyOperations,
        upgrade:      '/pricing',
      });
    }
  }

  req.user.dailyUsage = updatedUser.dailyUsage;
  next();
}

/**
 * Kiểm tra giới hạn kích thước file theo gói.
 */
function checkFileSizeLimit(req, res, next) {
  if (!req.file) return next();

  const plan     = req.user?.plan || 'free';
  const maxBytes = PLAN_LIMITS[plan].maxFileSizeMB * 1024 * 1024;

  if (req.file.size > maxBytes) {
    return res.status(413).json({
      error:    `File quá lớn (${(req.file.size/1024/1024).toFixed(1)}MB). Gói ${plan.toUpperCase()} tối đa ${PLAN_LIMITS[plan].maxFileSizeMB}MB`,
      maxMB:    PLAN_LIMITS[plan].maxFileSizeMB,
      upgrade:  '/pricing',
    });
  }

  next();
}

module.exports = { PLAN_LIMITS, checkDailyLimit, checkFileSizeLimit };
