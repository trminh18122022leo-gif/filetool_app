'use strict';

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const storageSvc = require('../services/storage.service');
const { formatUser } = require('../services/auth.service');

// Lấy thông tin user hiện tại
router.get('/profile', requireAuth, (req, res) => {
  res.json({ success: true, user: formatUser(req.user) });
});

// Lấy thông tin usage trong ngày và giới hạn gói
router.get('/usage', requireAuth, (req, res) => {
  const { PLAN_LIMITS } = require('../middleware/planLimit');
  const plan = req.user.plan || 'free';
  res.json({
    plan,
    dailyUsage: req.user.dailyUsage,
    limits:     PLAN_LIMITS[plan],
    storageUsed: req.user.cloudStorageUsed,
  });
});

// Danh sách file đã lưu trên cloud của user
router.get('/files', requireAuth, async (req, res, next) => {
  try {
    const files = await storageSvc.getUserFiles(req.user._id);
    res.json({ success: true, files });
  } catch (err) { next(err); }
});

// Xóa 1 file trên cloud
router.delete('/files/:id', requireAuth, async (req, res, next) => {
  try {
    await storageSvc.deleteFromCloud(req.params.id, req.user._id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
