'use strict';

const express = require('express');
const router  = express.Router();
const ApiKey  = require('../models/ApiKey');
const { requireAuth } = require('../middleware/auth');

// Danh sách API keys của user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const keys = await ApiKey.find({ user: req.user._id })
      .select('-keyHash')
      .sort({ createdAt: -1 });
    res.json({ success: true, keys });
  } catch (err) { next(err); }
});

// Tạo API key mới
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const count = await ApiKey.countDocuments({ user: req.user._id, status: 'active' });
    const maxKeys = req.user.plan === 'business' ? 10 : req.user.plan === 'pro' ? 3 : 1;

    if (count >= maxKeys) {
      return res.status(400).json({
        error: `Gói ${req.user.plan.toUpperCase()} tối đa ${maxKeys} API key`,
      });
    }

    const { rawKey, keyHash, keyPrefix } = ApiKey.generateKey();
    const rateLimits = { free: 100, pro: 1000, business: 10000 };

    const doc = await ApiKey.create({
      user:            req.user._id,
      name:            req.body.name || 'API Key',
      keyHash,
      keyPrefix,
      rateLimitPerDay: rateLimits[req.user.plan] || 100,
    });

    // CHỈ hiển thị plain text key 1 LẦN DUY NHẤT lúc tạo
    res.status(201).json({
      success: true,
      apiKey:  rawKey,
      keyDoc: {
        id:        doc._id,
        name:      doc.name,
        keyPrefix: doc.keyPrefix,
        createdAt: doc.createdAt,
      },
      warning: 'Hãy lưu key này ngay. Bạn sẽ không thể xem lại nó.',
    });
  } catch (err) { next(err); }
});

// Thu hồi (revoke) key
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await ApiKey.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: 'revoked' }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
