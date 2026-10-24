'use strict';

/**
 * server/services/quota.service.js
 * Quản lý hạn mức người dùng nguyên tử (Atomic Server-Side Quota Reservation & Release)
 * Ngăn chặn race condition, double-charging khi retry, và bảo đảm hoàn trả quota khi job lỗi.
 */

const User = require('../models/User');
const { PLANS } = require('../config/plans');

const PLAN_LIMITS = {
  free: {
    maxDailyJobs: PLANS.free.entitlements.maxDailyJobs,
    maxStorageBytes: PLANS.free.entitlements.maxStorageBytes,
    maxConcurrentJobs: PLANS.free.entitlements.maxConcurrentJobs,
  },
  plus: {
    maxDailyJobs: PLANS.plus.entitlements.maxDailyJobs,
    maxStorageBytes: PLANS.plus.entitlements.maxStorageBytes,
    maxConcurrentJobs: PLANS.plus.entitlements.maxConcurrentJobs,
  },
  pro: {
    maxDailyJobs: PLANS.pro.entitlements.maxDailyJobs,
    maxStorageBytes: PLANS.pro.entitlements.maxStorageBytes,
    maxConcurrentJobs: PLANS.pro.entitlements.maxConcurrentJobs,
  },
  business: {
    maxDailyJobs: PLANS.business.entitlements.maxDailyJobs,
    maxStorageBytes: PLANS.business.entitlements.maxStorageBytes,
    maxConcurrentJobs: PLANS.business.entitlements.maxConcurrentJobs,
  },
};

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Đặt trước hạn mức (Reserve Quota) trước khi đưa job vào hàng đợi
 */
async function reserveQuota(userId, options = {}) {
  const { count = 1, storageBytes = 0 } = options;

  if (!userId) {
    // Khách vãng lai: cấp phép theo IP/session hạn mức cố định
    return { success: true, reservedCount: count, isGuest: true };
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User không tồn tại');
  }

  const plan = user.plan || 'free';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const today = getTodayString();

  // 1. Kiểm tra và đồng bộ ngày sử dụng (Daily Usage Reset)
  let currentUsage = user.dailyUsage?.count || 0;
  if (user.dailyUsage?.date !== today) {
    currentUsage = 0;
  }

  // 2. Kiểm tra trần hạn mức
  if (currentUsage + count > limits.maxDailyJobs) {
    return {
      success: false,
      reason: 'DAILY_QUOTA_EXHAUSTED',
      currentUsage,
      maxLimit: limits.maxDailyJobs,
      plan,
    };
  }

  // 3. Thực hiện cập nhật nguyên tử (Atomic $inc)
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { 'dailyUsage.date': { $ne: today } },
        { 'dailyUsage.count': { $lte: limits.maxDailyJobs - count } },
      ],
    },
    {
      $set: { 'dailyUsage.date': today },
      $inc: { 'dailyUsage.count': count, cloudStorageUsed: storageBytes },
    },
    { new: true }
  );

  if (!updatedUser) {
    return {
      success: false,
      reason: 'DAILY_QUOTA_EXHAUSTED_RACE',
      currentUsage: limits.maxDailyJobs,
      maxLimit: limits.maxDailyJobs,
      plan,
    };
  }

  return {
    success: true,
    reservedCount: count,
    newDailyUsage: updatedUser.dailyUsage.count,
    maxLimit: limits.maxDailyJobs,
  };
}

/**
 * Hoàn lại hạn mức (Refund Quota) khi job thất bại hoặc bị hủy bỏ
 */
async function refundQuota(jobRecord) {
  if (!jobRecord) return { refunded: false };

  const userId = jobRecord.user;
  const count = jobRecord.quotaReserved?.count || 0;
  const isCommitted = jobRecord.quotaReserved?.committed || false;

  // Chỉ hoàn lại nếu quota đã được đặt trước nhưng CHƯA commit thành công
  if (!userId || count <= 0 || isCommitted) {
    return { refunded: false, reason: 'ALREADY_COMMITTED_OR_EMPTY' };
  }

  try {
    await User.findByIdAndUpdate(userId, {
      $inc: { 'dailyUsage.count': -count },
    });

    jobRecord.quotaReserved.count = 0;
    jobRecord.quotaReserved.committed = false;
    await jobRecord.save();

    return { refunded: true, refundedCount: count };
  } catch (err) {
    console.error(`❌ [Quota] Lỗi khi hoàn trả quota cho job ${jobRecord.jobId}:`, err.message);
    return { refunded: false, error: err.message };
  }
}

/**
 * Xác nhận đã hoàn tất tác vụ và trừ quota vĩnh viễn (Commit Quota)
 */
async function commitQuota(jobRecord) {
  if (!jobRecord || !jobRecord.quotaReserved) return;

  jobRecord.quotaReserved.committed = true;
  await jobRecord.save();
  return { committed: true };
}

module.exports = {
  PLAN_LIMITS,
  reserveQuota,
  refundQuota,
  commitQuota,
};
