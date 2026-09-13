/**
 * Security Audit Trail Model - records all security-sensitive events.
 * Stored in dataDB. Auto-expires after 90 days.
 */
'use strict';

const mongoose = require('mongoose');
const { dataDB } = require('../config/database');

const auditSchema = new mongoose.Schema({
  userId: {
    type:    mongoose.Schema.Types.ObjectId,
    default: null,
  },
  email: {
    type:    String,
    default: null,
  },
  action: {
    type:     String,
    required: true,
    // e.g., 'login.success', 'login.failed', 'login.blocked', 'logout', 'password.changed', '2fa.enabled', 'suspicious.request'
  },
  severity: {
    type:    String,
    enum:    ['info', 'warning', 'critical'],
    default: 'info',
  },
  ip:        String,
  userAgent: String,
  method:    String,
  path:      String,
  meta: {
    type:    mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type:    Date,
    default: Date.now,
    index:   true,
  },
  expiresAt: {
    type:    Date,
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  },
});

auditSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
auditSchema.index({ userId: 1, createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });
auditSchema.index({ severity: 1, createdAt: -1 });

auditSchema.statics.log = async function(data) {
  try {
    await this.create(data);
  } catch (err) {
    // Non-blocking: audit log failure must never crash request handling
    console.error('[AuditLog] Ghi log thất bại:', err.message);
  }
};

module.exports = dataDB.model('AuditLog', auditSchema);
