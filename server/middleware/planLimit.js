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

/**
 * Kiểm tra giới hạn số lượt xử lý trong ngày.
 */
async function checkDailyLimit(req, res, next) {
  if (!req.user) return next();

  const plan   = req.user.plan || 'free';
  const limits = PLAN_LIMITS[plan];

  const today = new Date().toISOString().slice(0, 10);
  if (req.user.dailyUsage?.date !== today) {
    req.user.dailyUsage = { date: today, count: 0 };
  }

  if (req.user.dailyUsage.count >= limits.dailyOperations) {
    return res.status(429).json({
      error:        `Bạn đã dùng hết ${limits.dailyOperations} lượt/ngày của gói ${plan.toUpperCase()}`,
      currentPlan:  plan,
      limit:        limits.dailyOperations,
      upgrade:      '/pricing',
    });
  }

  req.user.dailyUsage.count += 1;
  await req.user.save();
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
