'use strict';

/**
 * server/queue/jobQueue.js
 * Quản trị hàng đợi phân tán BullMQ với cơ chế chịu lỗi và dự phòng kép (Dual-Engine Queue).
 * Kết nối với Redis/Valkey khi có sẵn; tự động kích hoạt Resilient In-Memory Dispatcher khi chạy local.
 */

const { Queue } = require('bullmq');
const { getRedisClient, isRedisReady } = require('./connection');
const JobRecord = require('../models/JobRecord');
const { commitQuota, refundQuota } = require('../services/quota.service');
const { emitProgress, emitComplete, emitError, registerJob } = require('../services/jobEmitter');
const { executeJob } = require('./jobProcessors');

const QUEUE_NAME = 'filetools-jobs';
let bullQueue = null;

function getBullQueue() {
  if (bullQueue) return bullQueue;
  const client = getRedisClient();
  if (!client) return null;

  try {
    bullQueue = new Queue(QUEUE_NAME, {
      connection: client,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { age: 3600 * 24 }, // Giữ lịch sử 24h
        removeOnFail:     { age: 3600 * 48 }, // Giữ log lỗi 48h
      },
    });
    return bullQueue;
  } catch (err) {
    console.warn(`⚠️ [BullMQ] Không thể khởi tạo BullMQ queue: ${err.message}`);
    return null;
  }
}

// ── In-Memory Resilient Queue Fallback ─────────────────────────────────────────
// Dùng khi REDIS_URL chưa cấu hình để app và test suite luôn hoạt động thông suốt
const inMemoryActiveJobs = new Map();

async function processJobDirectly(jobRecord) {
  const jobId = jobRecord.jobId;

  try {
    // 1. Chuyển trạng thái sang PROCESSING
    jobRecord.status = 'PROCESSING';
    jobRecord.startedAt = new Date();
    jobRecord.progress = 10;
    jobRecord.currentStep = 'Bắt đầu xử lý';
    await jobRecord.save();

    emitProgress(jobId, { progress: 10, currentStep: jobRecord.currentStep });

    // 2. Thực thi nghiệp vụ
    const outputResult = await executeJob(jobRecord, async (percent, step) => {
      jobRecord.progress = percent;
      jobRecord.currentStep = step;
      await jobRecord.save().catch(() => {});
      emitProgress(jobId, { progress: percent, currentStep: step });
    });

    // 3. Hoàn tất thành công (COMPLETED) & Commit Quota
    jobRecord.status = 'COMPLETED';
    jobRecord.progress = 100;
    jobRecord.currentStep = 'Đã hoàn tất';
    jobRecord.completedAt = new Date();
    jobRecord.outputFile = outputResult;
    await commitQuota(jobRecord);
    await jobRecord.save();

    emitComplete(jobId, {
      outputFile: outputResult,
      completedAt: jobRecord.completedAt,
    });
  } catch (err) {
    // 4. Xử lý lỗi (FAILED) & Hoàn trả Quota
    console.error(`❌ [JobQueue] Job ${jobId} thất bại:`, err.message);
    jobRecord.status = 'FAILED';
    jobRecord.failedAt = new Date();
    jobRecord.errors.push({ message: err.message, timestamp: new Date() });

    await refundQuota(jobRecord);
    await jobRecord.save();

    emitError(jobId, err);
  } finally {
    inMemoryActiveJobs.delete(jobId);
  }
}

/**
 * Đưa tác vụ vào hàng đợi (Enqueue Job)
 */
async function enqueueJob(jobRecord, options = {}) {
  const { priority = 5 } = options;
  const jobId = jobRecord.jobId;

  // Đăng ký quyền truy cập cho jobEmitter / Socket.io
  registerJob(jobId, {
    ownerId: jobRecord.user ? String(jobRecord.user) : null,
    secret:  jobRecord.sessionSecret || null,
    action:  jobRecord.operation,
  });

  jobRecord.status = 'QUEUED';
  await jobRecord.save();

  const queue = getBullQueue();

  if (queue && isRedisReady()) {
    // Chế độ Production: BullMQ + Redis
    await queue.add(jobRecord.operation, {
      jobRecordId: jobRecord._id,
      jobId: jobRecord.jobId,
      operation: jobRecord.operation,
    }, {
      jobId,
      priority, // Priority 1 (Cao) cho Pro/Business, 5 (Bình thường) cho Free
    });
    return { queued: true, engine: 'bullmq-redis' };
  }

  // Trong môi trường Production, hàng đợi bắt buộc phải có tính bền vững (Durable Queue via Redis).
  // Tuyệt đối không để job bất đồng bộ âm thầm rơi vào bộ nhớ RAM dễ biến mất khi restart/deploy.
  const ALL_HEAVY_OPERATIONS = [
    'video-translate',
    'audio-extract',
    'libreoffice-convert',
    'ocr-pdf',
    'pdf-ocr',
    'bulk-compress',
    'batch-process',
    'workflow-dag',
    'pdf-to-word',
    'word-to-pdf',
    'html-to-pdf',
    'pdf-redact',
    'pdf-compress',
  ];

  if (process.env.NODE_ENV === 'production' && !isRedisReady()) {
    if (process.env.ALLOW_IN_MEMORY_FALLBACK !== 'true' || ALL_HEAVY_OPERATIONS.includes(jobRecord.operation)) {
      const err = new Error(`Durable background queue is currently unavailable for operation '${jobRecord.operation}'. Asynchronous jobs cannot execute in volatile memory in production.`);
      err.code = 'DURABLE_QUEUE_UNAVAILABLE';
      err.status = 503;
      throw err;
    }
  }

  // Chế độ Fallback: Dispatcher bất đồng bộ (chỉ dùng cho môi trường Dev/Test hoặc tác vụ nhẹ)
  inMemoryActiveJobs.set(jobId, jobRecord);
  setImmediate(() => {
    processJobDirectly(jobRecord);
  });

  return { queued: true, engine: 'in-memory-fallback' };
}

/**
 * Hủy tác vụ (Cancel Job) và hoàn trả hạn mức
 */
async function cancelJob(jobId, requestingUser = null, guestSecret = null) {
  const jobRecord = await JobRecord.findOne({ jobId }).select('+sessionSecret');
  if (!jobRecord) {
    throw new Error('Tác vụ không tồn tại');
  }

  // Kiểm tra quyền sở hữu (Multi-tenant ACL)
  if (jobRecord.user) {
    if (!requestingUser || String(requestingUser._id) !== String(jobRecord.user)) {
      const err = new Error('Bạn không có quyền truy cập hoặc hủy tác vụ này');
      err.status = 403;
      err.code = 'FORBIDDEN_JOB_ACCESS';
      throw err;
    }
  } else if (jobRecord.sessionSecret) {
    if (guestSecret !== jobRecord.sessionSecret) {
      const err = new Error('Token xác thực tác vụ không hợp lệ');
      err.status = 403;
      err.code = 'FORBIDDEN_JOB_ACCESS';
      throw err;
    }
  }

  // Nếu job đã xong hoặc đã hủy thì không hủy lại
  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(jobRecord.status)) {
    return {
      success: false,
      message: `Tác vụ đã ở trạng thái ${jobRecord.status}, không thể hủy`,
      status: jobRecord.status,
    };
  }

  jobRecord.status = 'CANCELLED';
  jobRecord.cancelledAt = new Date();
  jobRecord.currentStep = 'Đã hủy theo yêu cầu của người dùng';

  // Hoàn trả quota ngay lập tức
  await refundQuota(jobRecord);
  await jobRecord.save();

  // Hủy trong BullMQ nếu đang chờ
  const queue = getBullQueue();
  if (queue && isRedisReady()) {
    try {
      const bullJob = await queue.getJob(jobId);
      if (bullJob) await bullJob.remove();
    } catch (_) {}
  }

  emitError(jobId, new Error('Tác vụ đã bị hủy bởi người dùng'));

  return {
    success: true,
    message: 'Tác vụ đã được hủy thành công',
    status: 'CANCELLED',
    jobId,
  };
}

/**
 * Lấy chi tiết trạng thái tác vụ có kiểm tra quyền sở hữu
 */
async function getJobStatus(jobId, requestingUser = null, guestSecret = null) {
  const jobRecord = await JobRecord.findOne({ jobId }).select('+sessionSecret');
  if (!jobRecord) {
    const err = new Error('Tác vụ không tồn tại');
    err.status = 404;
    err.code = 'JOB_NOT_FOUND';
    throw err;
  }

  // Kiểm soát ranh giới người dùng (Tenant Boundary)
  if (jobRecord.user) {
    if (!requestingUser || String(requestingUser._id) !== String(jobRecord.user)) {
      const err = new Error('Bạn không có quyền xem thông tin tác vụ này');
      err.status = 403;
      err.code = 'FORBIDDEN_JOB_ACCESS';
      throw err;
    }
  } else if (jobRecord.sessionSecret) {
    if (guestSecret !== jobRecord.sessionSecret) {
      const err = new Error('Token xác thực tác vụ không hợp lệ');
      err.status = 403;
      err.code = 'FORBIDDEN_JOB_ACCESS';
      throw err;
    }
  }

  return {
    jobId:          jobRecord.jobId,
    operation:      jobRecord.operation,
    operationClass: jobRecord.operationClass,
    status:         jobRecord.status,
    progress:       jobRecord.progress,
    currentStep:    jobRecord.currentStep,
    outputFile:     jobRecord.outputFile ? {
      fileId:       jobRecord.outputFile.fileId,
      originalName: jobRecord.outputFile.originalName,
      fileSize:     jobRecord.outputFile.fileSize,
      mimeType:     jobRecord.outputFile.mimeType,
      downloadUrl:  `/api/files/${jobRecord.outputFile.fileId}/download-intent`,
    } : null,
    errors:         jobRecord.errors,
    createdAt:      jobRecord.createdAt,
    startedAt:      jobRecord.startedAt,
    completedAt:    jobRecord.completedAt,
    cancelledAt:    jobRecord.cancelledAt,
  };
}

module.exports = {
  getBullQueue,
  enqueueJob,
  cancelJob,
  getJobStatus,
  processJobDirectly,
};
