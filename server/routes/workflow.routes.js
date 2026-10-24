'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const WorkflowRun = require('../models/WorkflowRun');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const FileRecord = require('../models/FileRecord');
const {
  validateDag,
  getBuiltInTemplates,
  executeDagRun,
  cleanupRunSandbox,
  MAX_INPUT_FILES,
} = require('../services/workflowDag.service');
const { reserveQuota, refundQuota } = require('../services/quota.service');
const AuditLog = require('../models/AuditLog');

// ── 1. Fetch Templates (Built-in + User Custom) ─────────────────────────────
router.get('/templates', optionalAuth, async (req, res, next) => {
  try {
    const builtIn = getBuiltInTemplates();
    let userTemplates = [];

    if (req.user) {
      userTemplates = await WorkflowTemplate.find({ author: req.user._id })
        .sort({ createdAt: -1 })
        .lean();
    }

    res.json({
      success: true,
      templates: [...builtIn, ...userTemplates],
    });
  } catch (err) { next(err); }
});

// ── 2. Create User Workflow Template ────────────────────────────────────────
router.post('/templates', requireAuth, async (req, res, next) => {
  try {
    const { title, description, category, icon, dag } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Tiêu đề template không được để trống' });
    }

    // Validate DAG structure and allowlist
    const validation = validateDag(dag);

    // Sanitize template metadata - strictly prevent other users' file IDs
    const templateId = `tpl_${uuidv4().slice(0, 8)}`;
    const template = await WorkflowTemplate.create({
      templateId,
      title: title.trim(),
      description: description ? description.trim() : '',
      category: category || 'document',
      icon: icon || 'Layers',
      isBuiltIn: false,
      author: req.user._id,
      dag,
      quotaCost: validation.estimatedQuotaUnits,
    });

    res.status(201).json({ success: true, template });
  } catch (err) { next(err); }
});

// ── 3. Validate DAG Graph without Running ───────────────────────────────────
router.post('/validate', (req, res) => {
  try {
    const { dag } = req.body;
    const validation = validateDag(dag);
    res.json({ success: true, ...validation });
  } catch (err) {
    res.status(400).json({
      error: err.message,
      code: err.message.startsWith('DAG_') || err.message.startsWith('DISALLOWED_') ? err.message.split(':')[0] : 'INVALID_DAG',
    });
  }
});

// ── 4. Execute or Queue Workflow Run ────────────────────────────────────────
router.post('/run', optionalAuth, upload.array('files', MAX_INPUT_FILES), async (req, res, next) => {
  try {
    let dag = req.body.dag;
    if (typeof dag === 'string') {
      try {
        dag = JSON.parse(dag);
      } catch (parseErr) {
        return res.status(400).json({ error: 'DAG definition must be valid JSON' });
      }
    }

    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    // Idempotency check: prevent duplicate charging & duplicate runs
    if (idempotencyKey) {
      const existingQuery = { idempotencyKey };
      if (req.user) {
        existingQuery.user = req.user._id;
      }
      const existingRun = await WorkflowRun.findOne(existingQuery);
      if (existingRun) {
        return res.status(200).json({
          success: true,
          reused: true,
          run: existingRun,
        });
      }
    }

    // Validate DAG
    const validation = validateDag(dag);

    // Quota reservation for authenticated users
    let isGuest = !req.user;
    if (!isGuest) {
      const quotaRes = await reserveQuota(req.user._id, { count: validation.estimatedQuotaUnits });
      if (!quotaRes.success) {
        return res.status(429).json({
          error: 'Hạn mức xử lý hàng ngày của bạn không đủ để chạy quy trình này.',
          code: quotaRes.reason,
          required: validation.estimatedQuotaUnits,
          currentUsage: quotaRes.currentUsage,
          maxLimit: quotaRes.maxLimit,
        });
      }
    }

    // Prepare input files
    let inputFiles = [];
    if (req.files && req.files.length > 0) {
      inputFiles = req.files.map(f => f.path);
    } else if (req.body.fileIds) {
      let fileIds = req.body.fileIds;
      if (typeof fileIds === 'string') {
        try { fileIds = JSON.parse(fileIds); } catch (_) { fileIds = [fileIds]; }
      }
      if (Array.isArray(fileIds) && fileIds.length > 0) {
        const query = {
          fileId: { $in: fileIds },
          status: { $ne: 'DELETED' },
        };
        if (req.user) {
          query.user = req.user._id;
        }
        const records = await FileRecord.find(query);
        inputFiles = records.map(r => r.path);
      }
    }

    const sessionSecret = req.user ? null : (req.headers['x-session-secret'] || uuidv4());

    const runRecord = await WorkflowRun.create({
      runId: uuidv4(),
      user: req.user ? req.user._id : null,
      sessionSecret,
      title: req.body.title || 'Workflow Run',
      templateId: req.body.templateId || null,
      dag,
      idempotencyKey: idempotencyKey || undefined,
      quotaUnits: validation.estimatedQuotaUnits,
      status: 'PENDING',
    });

    // Execute run asynchronously
    executeDagRun(runRecord, { inputFiles }).catch(err => {
      console.error(`❌ [workflow.routes] Run ${runRecord.runId} failed:`, err.message);
    });

    res.status(202).json({
      success: true,
      runId: runRecord.runId,
      sessionSecret: req.user ? undefined : sessionSecret,
      status: 'PENDING',
      quotaUnits: validation.estimatedQuotaUnits,
    });
  } catch (err) { next(err); }
});

// ── 5. Get Workflow Run Status (Tenant Isolation) ───────────────────────────
router.get('/run/:id', optionalAuth, async (req, res, next) => {
  try {
    const run = await WorkflowRun.findOne({ runId: req.params.id }).select('+sessionSecret');
    if (!run) {
      return res.status(404).json({ error: 'Không tìm thấy phiên thực thi quy trình', code: 'RUN_NOT_FOUND' });
    }

    // ACL Enforcement: Multi-tenant boundary
    if (run.user) {
      if (!req.user || String(req.user._id) !== String(run.user)) {
        return res.status(403).json({ error: 'Không có quyền truy cập phiên thực thi này', code: 'FORBIDDEN' });
      }
    } else {
      // Guest access control
      const secret = req.headers['x-session-secret'] || req.query.sessionSecret;
      if (!secret || secret !== run.sessionSecret) {
        return res.status(403).json({ error: 'Không có quyền truy cập phiên thực thi này', code: 'FORBIDDEN' });
      }
    }

    res.json({
      success: true,
      run: {
        runId: run.runId,
        title: run.title,
        templateId: run.templateId,
        status: run.status,
        dag: run.dag,
        nodeStates: run.nodeStates,
        artifacts: run.artifacts,
        quotaUnits: run.quotaUnits,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        error: run.error,
      },
    });
  } catch (err) { next(err); }
});

// ── 6. Cancel Workflow Run ─────────────────────────────────────────────────
router.post('/run/:id/cancel', optionalAuth, async (req, res, next) => {
  try {
    const run = await WorkflowRun.findOne({ runId: req.params.id }).select('+sessionSecret');
    if (!run) {
      return res.status(404).json({ error: 'Không tìm thấy quy trình', code: 'RUN_NOT_FOUND' });
    }

    if (run.user) {
      if (!req.user || String(req.user._id) !== String(run.user)) {
        return res.status(403).json({ error: 'Không có quyền hủy quy trình này', code: 'FORBIDDEN' });
      }
    } else {
      const secret = req.headers['x-session-secret'] || req.query.sessionSecret;
      if (!secret || secret !== run.sessionSecret) {
        return res.status(403).json({ error: 'Không có quyền hủy quy trình này', code: 'FORBIDDEN' });
      }
    }

    if (run.status === 'COMPLETED' || run.status === 'CANCELLED') {
      return res.json({ success: true, status: run.status });
    }

    run.status = 'CANCELLED';
    run.completedAt = new Date();
    await run.save();

    // Cleanup intermediate sandbox
    cleanupRunSandbox(run.runId);

    // Refund quota if reserved and not committed
    if (run.user && !run.quotaCommitted) {
      try {
        const User = require('../models/User');
        await User.findByIdAndUpdate(run.user, {
          $inc: { 'dailyUsage.count': -(run.quotaUnits || 1) },
        });
      } catch (_) {}
    }

    res.json({ success: true, status: 'CANCELLED' });
  } catch (err) { next(err); }
});

// ── 7. List User's Workflow Runs ────────────────────────────────────────────
router.get('/runs', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [runs, totalCount] = await Promise.all([
      WorkflowRun.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('runId title templateId status quotaUnits artifacts startedAt completedAt createdAt error')
        .lean(),
      WorkflowRun.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      success: true,
      runs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
