'use strict';

const express    = require('express');
const router     = express.Router();
const storageSvc = require('../services/storage.service');
const { requireAuth } = require('../middleware/auth');

// Lấy signed URL để tải file
router.get('/download/:id', requireAuth, async (req, res, next) => {
  try {
    const FileRecord = require('../models/FileRecord');
    const record = await FileRecord.findOne({ _id: req.params.id, user: req.user._id });
    if (!record) return res.status(404).json({ error: 'File không tồn tại hoặc đã hết hạn' });

    const url = await storageSvc.getDownloadUrl(record.cloudKey, 3600);
    record.downloadCount += 1;
    await record.save();

    res.json({ success: true, downloadUrl: url, fileName: record.originalName });
  } catch (err) { next(err); }
});

// Xóa file
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await storageSvc.deleteFromCloud(req.params.id, req.user._id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
