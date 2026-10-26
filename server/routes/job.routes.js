'use strict';

/**
 * server/routes/job.routes.js
 * API Endpoints phân tán chuẩn:
 * - POST /api/jobs (Tạo tác vụ có Idempotency-Key & Atomic Quota Reservation)
 * - GET /api/jobs/:id (Kiểm tra tiến độ & Polling có kiểm soát Tenant Boundary)
 * - POST /api/jobs/:id/cancel (Hủy tác vụ & Hoàn trả Quota nguyên tử)
 * - GET /api/jobs/:id/download-intent (Lấy token tải kết quả sau khi xác minh ACL)
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

const JobRecord = require('../models/JobRecord');
const FileRecord = require('../models/FileRecord');
const { reserveQuota } = require('../services/quota.service');
const { enqueueJob, cancelJob, getJobStatus } = require('../queue/jobQueue');
const upload = require('../middleware/upload');
const { generateDownloadToken } = require('../services/auth.service');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

const ALLOWED_OPERATIONS = [
  'pdf-compress',
  'pdf-merge',
  'pdf-split',
  'pdf-to-word',
  'word-to-pdf',
  'pdf-redact',
  'batch-process',
  'image-convert',
  'image-compress',
  'image-resize',
  'html-to-pdf',
];

const OPERATION_CLASSES = {
  'pdf-compress':  'pdf',
  'pdf-merge':     'pdf',
  'pdf-split':     'pdf',
  'pdf-to-word':   'office',
  'word-to-pdf':   'office',
  'pdf-redact':    'pdf',
  'batch-process': 'pdf',
  'image-convert': 'media',
  'image-compress':'media',
  'image-resize':  'media',
  'html-to-pdf':   'pdf',
};

// ── 1. POST /api/jobs — Khởi tạo tác vụ không đồng bộ với Idempotency-Key ─────
router.post('/', optionalAuth, upload.array('files', 20), wrap(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;
  const userId = req.user?._id || null;
  const userPlan = req.user?.plan || 'free';

  // 1. Kiểm tra Idempotency để chống duplicate charge/duplicate job
  if (idempotencyKey) {
    const existingJob = await JobRecord.findOne({
      idempotencyKey,
      ...(userId ? { user: userId } : {}),
    });

    if (existingJob) {
      return res.status(200).json({
        success: true,
        jobId: existingJob.jobId,
        status: existingJob.status,
        operation: existingJob.operation,
        checkStatusUrl: `/api/jobs/${existingJob.jobId}`,
        cancelUrl: `/api/jobs/${existingJob.jobId}/cancel`,
        idempotentReplay: true,
        message: 'Tác vụ đã được tạo trước đó với Idempotency-Key này',
      });
    }
  }

  // 2. Validate tham số đầu vào
  const { operation, params: rawParams } = req.body;
  if (!operation || !ALLOWED_OPERATIONS.includes(operation)) {
    return res.status(400).json({
      error: `Thao tác '${operation}' không hợp lệ. Danh sách cho phép: ${ALLOWED_OPERATIONS.join(', ')}`,
      code: 'INVALID_OPERATION',
    });
  }

  let params = {};
  if (rawParams) {
    try {
      params = typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;
    } catch (_) {
      return res.status(400).json({ error: 'Tham số params phải là định dạng JSON hợp lệ', code: 'INVALID_PARAMS' });
    }
  }

  // 3. Chuẩn bị danh sách input files
  const inputFiles = [];
  if (req.files && req.files.length > 0) {
    for (const f of req.files) {
      inputFiles.push({
        fileId:       f.filename || uuidv4(),
        originalName: f.originalname,
        localPath:    f.path,
        fileSize:     f.size,
        mimeType:     f.mimetype,
      });
    }
  } else if (req.body.fileIds) {
    const fileIds = Array.isArray(req.body.fileIds) ? req.body.fileIds : String(req.body.fileIds).split(',');
    for (const fid of fileIds) {
      const trimmedId = String(fid).trim();
      const fRecord = await FileRecord.findOne({ fileId: trimmedId }).select('+localPath');
      if (!fRecord) {
        return res.status(404).json({ error: `File ID '${trimmedId}' không tồn tại trong hệ thống`, code: 'FILE_NOT_FOUND' });
      }

      // Kiểm soát quyền sở hữu file (Tenant Boundary ACL)
      if (fRecord.user && userId && String(fRecord.user) !== String(userId)) {
        return res.status(403).json({ error: `Bạn không có quyền sử dụng file '${trimmedId}'`, code: 'FORBIDDEN_FILE_ACCESS' });
      }

      inputFiles.push({
        fileId:       fRecord.fileId,
        originalName: fRecord.originalName,
        localPath:    fRecord.localPath,
        cloudKey:     fRecord.cloudKey,
        fileSize:     fRecord.fileSize,
        mimeType:     fRecord.mimeType,
      });
    }
  }

  // 4. Đặt trước hạn mức nguyên tử (Atomic Quota Reservation)
  const quotaResult = await reserveQuota(userId, { count: 1 });
  if (!quotaResult.success) {
    return res.status(429).json({
      error: `Bạn đã sử dụng hết hạn mức hàng ngày (${quotaResult.currentUsage}/${quotaResult.maxLimit} lượt). Vui lòng nâng cấp gói Pro/Business.`,
      code: 'DAILY_QUOTA_EXHAUSTED',
      plan: quotaResult.plan,
    });
  }

  // 5. Khởi tạo JobRecord trong cơ sở dữ liệu
  const jobId = uuidv4();
  const sessionSecret = uuidv4();
  const opClass = OPERATION_CLASSES[operation] || 'pdf';

  const jobRecord = new JobRecord({
    jobId,
    idempotencyKey,
    user: userId,
    sessionSecret,
    operation,
    operationClass: opClass,
    status: 'INITIATED',
    params,
    inputFiles,
    quotaReserved: {
      count: 1,
      committed: false,
    },
  });

  await jobRecord.save();

  // 6. Đưa vào hàng đợi phân tán BullMQ (hoặc Fallback)
  const priority = userPlan === 'business' ? 1 : (userPlan === 'pro' ? 2 : 5);
  const queueResult = await enqueueJob(jobRecord, { priority });

  res.status(201).json({
    success: true,
    jobId,
    jobSecret: userId ? undefined : sessionSecret, // Chỉ trả sessionSecret cho guest
    status: 'QUEUED',
    operation,
    operationClass: opClass,
    queueEngine: queueResult.engine,
    checkStatusUrl: `/api/jobs/${jobId}`,
    cancelUrl: `/api/jobs/${jobId}/cancel`,
    createdAt: jobRecord.createdAt,
    idempotentReplay: false,
  });
}));

// ── 2. GET /api/jobs/:id — Kiểm tra tiến độ với Tenant Boundary ───────────────
router.get('/:id', optionalAuth, wrap(async (req, res) => {
  const jobId = req.params.id;
  const guestSecret = req.headers['x-job-secret'] || req.query.secret || null;

  const statusData = await getJobStatus(jobId, req.user, guestSecret);
  res.json({ success: true, ...statusData });
}));

// ── 3. POST /api/jobs/:id/cancel — Hủy tác vụ và hoàn trả Quota ───────────────
router.post('/:id/cancel', optionalAuth, wrap(async (req, res) => {
  const jobId = req.params.id;
  const guestSecret = req.headers['x-job-secret'] || req.body.secret || null;

  const cancelResult = await cancelJob(jobId, req.user, guestSecret);
  res.json(cancelResult);
}));

// ── 4. GET /api/jobs/:id/download-intent — Lấy quyền tải file kết quả ──────────
router.get('/:id/download-intent', optionalAuth, wrap(async (req, res) => {
  const jobId = req.params.id;
  const guestSecret = req.headers['x-job-secret'] || req.query.secret || null;

  const jobRecord = await JobRecord.findOne({ jobId }).select('+sessionSecret');
  if (!jobRecord) {
    return res.status(404).json({ error: 'Tác vụ không tồn tại', code: 'JOB_NOT_FOUND' });
  }

  if (jobRecord.user) {
    if (!req.user || String(req.user._id) !== String(jobRecord.user)) {
      return res.status(403).json({ error: 'Bạn không có quyền tải kết quả tác vụ này', code: 'FORBIDDEN_FILE_ACCESS' });
    }
  } else if (jobRecord.sessionSecret && guestSecret !== jobRecord.sessionSecret) {
    return res.status(403).json({ error: 'Token bảo mật không hợp lệ', code: 'FORBIDDEN_FILE_ACCESS' });
  }

  if (jobRecord.status !== 'COMPLETED' || !jobRecord.outputFile?.localPath) {
    return res.status(400).json({ error: `Tác vụ chưa hoàn tất (Trạng thái hiện tại: ${jobRecord.status})`, code: 'JOB_NOT_COMPLETED' });
  }

  const filename = path.basename(jobRecord.outputFile.localPath);
  const downloadToken = generateDownloadToken(filename, req.user?._id || 'guest', 15 * 60);

  res.json({
    success: true,
    fileId: jobRecord.outputFile.fileId,
    filename,
    downloadUrl: `/outputs/${filename}?token=${downloadToken}`,
    expiresInSeconds: 15 * 60,
  });
}));

module.exports = router;
