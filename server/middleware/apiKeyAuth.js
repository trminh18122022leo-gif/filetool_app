'use strict';

const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const User   = require('../models/User');

/**
 * Xác thực qua header X-API-Key (dành cho developers).
 */
async function apiKeyAuth(req, res, next) {
  const rawKey = req.headers['x-api-key'];

  if (!rawKey) {
    return res.status(401).json({
      error: 'Thiếu X-API-Key header',
      docs:  '/api/docs',
    });
  }

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyDoc  = await ApiKey.findOne({ keyHash, status: 'active' }).populate('user');

  if (!keyDoc) {
    return res.status(401).json({ error: 'API key không hợp lệ hoặc đã bị vô hiệu hóa' });
  }

  // Kiểm tra giới hạn rate limit của API key
  const today = new Date().toISOString().slice(0, 10);
  if (keyDoc.lastUsedDate !== today) {
    keyDoc.lastUsedDate = today;
    keyDoc.usageToday   = 0;
  }

  if (keyDoc.usageToday >= keyDoc.rateLimitPerDay) {
    return res.status(429).json({
      error:       `Đã đạt giới hạn ${keyDoc.rateLimitPerDay} requests/ngày`,
      usageToday:  keyDoc.usageToday,
      limit:       keyDoc.rateLimitPerDay,
      resetAt:     '00:00 UTC',
    });
  }

  // Cập nhật usage
  keyDoc.usageToday  += 1;
  keyDoc.totalUsage  += 1;
  keyDoc.lastUsedAt   = new Date();
  await keyDoc.save();

  req.apiKey = keyDoc;
  req.user   = keyDoc.user;
  next();
}

module.exports = apiKeyAuth;
