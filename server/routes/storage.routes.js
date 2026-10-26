'use strict';

const express    = require('express');
const router     = express.Router();
const path       = require('path');
const storageSvc = require('../services/storage.service');
const { requireAuth } = require('../middleware/auth');
const FileRecord = require('../models/FileRecord');
const AuditLog   = require('../models/AuditLog');

// ── 1. List My Files with Pagination, Folder, Tag & Search Filters ──────────
router.get('/files', requireAuth, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const { folder, tag, search, sort = 'newest', isTrash = 'false' } = req.query;

    const query = {
      user: req.user._id,
      status: { $ne: 'DELETED' },
      isSoftDeleted: isTrash === 'true',
    };

    if (folder && folder !== 'all' && isTrash !== 'true') {
      query.folder = folder;
    }

    if (tag) {
      query.tags = tag;
    }

    if (search && search.trim()) {
      query.originalName = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    // Sort order
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') sortObj = { createdAt: 1 };
    else if (sort === 'name_asc') sortObj = { originalName: 1 };
    else if (sort === 'name_desc') sortObj = { originalName: -1 };
    else if (sort === 'size_desc') sortObj = { fileSize: -1 };
    else if (sort === 'size_asc') sortObj = { fileSize: 1 };

    const [files, totalCount] = await Promise.all([
      FileRecord.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .select('fileId originalName fileSize mimeType status folder tags isSoftDeleted createdAt updatedAt downloadCount')
        .lean(),
      FileRecord.countDocuments(query),
    ]);

    res.json({
      success: true,
      files,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) { next(err); }
});

// ── 2. Get Single File Details ──────────────────────────────────────────────
router.get('/files/:id', requireAuth, async (req, res, next) => {
  try {
    const record = await FileRecord.findOne({
      $or: [{ _id: req.params.id }, { fileId: req.params.id }],
      user: req.user._id,
      status: { $ne: 'DELETED' },
    }).lean();

    if (!record) {
      return res.status(404).json({ error: 'File không tồn tại hoặc bạn không có quyền truy cập', code: 'FILE_NOT_FOUND' });
    }

    res.json({ success: true, file: record });
  } catch (err) { next(err); }
});

// ── 3. Rename File (Preserves Original Extension) ───────────────────────────
router.post('/files/:id/rename', requireAuth, async (req, res, next) => {
  try {
    const { newName } = req.body;
    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'Tên file mới không được để trống' });
    }

    const record = await FileRecord.findOne({
      $or: [{ _id: req.params.id }, { fileId: req.params.id }],
      user: req.user._id,
      status: { $ne: 'DELETED' },
    });
    if (!record) {
      return res.status(404).json({ error: 'File không tồn tại', code: 'FILE_NOT_FOUND' });
    }

    // Preserve original extension to prevent MIME type spoofing
    const origExt = path.extname(record.originalName);
    let sanitized = path.basename(newName.trim());
    if (!sanitized.endsWith(origExt)) {
      sanitized = sanitized + origExt;
    }

    record.originalName = sanitized;
    await record.save();

    res.json({ success: true, originalName: record.originalName });
  } catch (err) { next(err); }
});

// ── 4. Update Folder & Tags Metadata ────────────────────────────────────────
router.patch('/files/:id/meta', requireAuth, async (req, res, next) => {
  try {
    const { folder, tags } = req.body;
    const record = await FileRecord.findOne({
      $or: [{ _id: req.params.id }, { fileId: req.params.id }],
      user: req.user._id,
      status: { $ne: 'DELETED' },
    });
    if (!record) {
      return res.status(404).json({ error: 'File không tồn tại', code: 'FILE_NOT_FOUND' });
    }

    if (folder !== undefined) {
      record.folder = String(folder || '/').trim();
    }
    if (Array.isArray(tags)) {
      record.tags = tags.map(t => String(t).trim()).filter(Boolean);
    }

    await record.save();
    res.json({ success: true, folder: record.folder, tags: record.tags });
  } catch (err) { next(err); }
});

// ── 5. Soft Delete (Move to Trash) ──────────────────────────────────────────
router.post('/files/:id/trash', requireAuth, async (req, res, next) => {
  try {
    const record = await FileRecord.findOne({
      $or: [{ _id: req.params.id }, { fileId: req.params.id }],
      user: req.user._id,
      status: { $ne: 'DELETED' },
    });
    if (!record) {
      return res.status(404).json({ error: 'File không tồn tại', code: 'FILE_NOT_FOUND' });
    }

    record.isSoftDeleted = true;
    record.deletedAt = new Date();
    await record.save();

    res.json({ success: true, message: 'Đã chuyển file vào Thùng rác' });
  } catch (err) { next(err); }
});

// ── 6. Restore File from Trash ──────────────────────────────────────────────
router.post('/files/:id/restore', requireAuth, async (req, res, next) => {
  try {
    const record = await FileRecord.findOne({
      $or: [{ _id: req.params.id }, { fileId: req.params.id }],
      user: req.user._id,
      status: { $ne: 'DELETED' },
    });
    if (!record) {
      return res.status(404).json({ error: 'File không tồn tại', code: 'FILE_NOT_FOUND' });
    }

    record.isSoftDeleted = false;
    record.deletedAt = null;
    await record.save();

    res.json({ success: true, message: 'Đã khôi phục file về không gian làm việc' });
  } catch (err) { next(err); }
});

// ── 7. Distinct Folders & Tags ──────────────────────────────────────────────
router.get('/folders', requireAuth, async (req, res, next) => {
  try {
    const folders = await FileRecord.distinct('folder', {
      user: req.user._id,
      status: { $ne: 'DELETED' },
      isSoftDeleted: false,
    });
    res.json({ success: true, folders: folders.filter(Boolean) });
  } catch (err) { next(err); }
});

router.get('/tags', requireAuth, async (req, res, next) => {
  try {
    const tags = await FileRecord.distinct('tags', {
      user: req.user._id,
      status: { $ne: 'DELETED' },
      isSoftDeleted: false,
    });
    res.json({ success: true, tags: tags.filter(Boolean) });
  } catch (err) { next(err); }
});

// ── 8. Storage Usage Stats ──────────────────────────────────────────────────
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const records = await FileRecord.find({
      user: req.user._id,
      status: { $ne: 'DELETED' },
      isSoftDeleted: false,
    }).select('fileSize').lean();

    const totalFiles = records.length;
    const totalBytes = records.reduce((sum, r) => sum + (r.fileSize || 0), 0);
    const maxBytes = req.user.plan === 'pro' ? 20 * 1024 * 1024 * 1024 : 500 * 1024 * 1024; // 20GB vs 500MB

    res.json({
      success: true,
      totalFiles,
      totalBytes,
      maxBytes,
      percentage: Math.min(100, Math.round((totalBytes / maxBytes) * 100)),
    });
  } catch (err) { next(err); }
});

// ── 9. Download Signed URL (1-hour TTL) ──────────────────────────────────────
router.get('/download/:id', requireAuth, async (req, res, next) => {
  try {
    const record = await FileRecord.findOne({
      $or: [{ _id: req.params.id }, { fileId: req.params.id }],
      user: req.user._id,
      status: { $ne: 'DELETED' },
    });
    if (!record) return res.status(404).json({ error: 'File không tồn tại hoặc bạn không có quyền truy cập', code: 'FILE_NOT_FOUND' });

    const url = await storageSvc.getDownloadUrl(record.cloudKey, 3600, record.originalName);
    record.downloadCount += 1;
    await record.save();

    AuditLog.log({
      userId:   req.user._id,
      action:   'file.cloud_download_token_minted',
      severity: 'info',
      ip:       req.ip,
      meta: {
        fileId:    record.fileId || String(record._id),
        fileSize:  record.fileSize,
        operation: record.operation,
      },
    });

    res.setHeader('Cache-Control', 'no-store, private, must-revalidate');
    res.json({
      success:     true,
      downloadUrl: url,
      fileName:    record.originalName,
      fileId:      record.fileId || String(record._id),
      fileSize:    record.fileSize,
      mimeType:    record.mimeType,
      expiresIn:   3600,
    });
  } catch (err) { next(err); }
});

// ── 10. Permanent Delete from Cloud (Idempotent) ─────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await storageSvc.deleteFromCloud(req.params.id, req.user._id);

    AuditLog.log({
      userId:   req.user._id,
      action:   'file.cloud_delete',
      severity: 'info',
      ip:       req.ip,
      meta: { targetId: req.params.id },
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
