'use strict';

const mongoose = require('mongoose');
const crypto   = require('crypto');
const { dataConn } = require('../config/database');

const apiKeySchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },
  name: {
    type:    String,
    trim:    true,
    default: 'Default Key',
  },
  // Lưu hash của key (như password — không lưu plain text)
  keyHash: {
    type:     String,
    required: true,
    unique:   true,
  },
  // 8 ký tự đầu để hiển thị: "sk-ft-xxxxxxxx..."
  keyPrefix: {
    type:     String,
    required: true,
  },
  rateLimitPerDay: {
    type:    Number,
    default: 100, // free: 100, pro: 1000, business: 10000
  },
  usageToday: {
    type:    Number,
    default: 0,
  },
  totalUsage: {
    type:    Number,
    default: 0,
  },
  lastUsedDate: {
    type:    String,
    default: () => new Date().toISOString().slice(0, 10),
  },
  lastUsedAt: Date,
  status: {
    type:    String,
    enum:    ['active', 'revoked'],
    default: 'active',
  },
  expiresAt: Date,
}, {
  timestamps: true,
});

// Tạo cặp (plainKey, keyHash, prefix)
apiKeySchema.statics.generateKey = function() {
  const raw    = 'sk-ft-' + crypto.randomBytes(24).toString('hex');
  const hash   = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12) + '...';
  return { rawKey: raw, keyHash: hash, keyPrefix: prefix };
};

module.exports = dataConn.model('ApiKey', apiKeySchema);
