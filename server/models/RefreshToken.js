/**
 * Refresh Token Model with Token Rotation, Family Tracking & Replay Attack Detection.
 * Stored in authDB.
 */
'use strict';

const mongoose = require('mongoose');
const crypto   = require('crypto');
const { authDB } = require('../config/database');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  // Token hash (SHA-256) - never store raw token in DB
  tokenHash: {
    type:     String,
    required: true,
    unique:   true,
  },
  // First 8 characters for user identification in active sessions list
  tokenPrefix: {
    type:     String,
    required: true,
  },
  // Token family: all tokens generated from the same initial login belong to the same family
  family: {
    type:     String,
    required: true,
    index:    true,
  },
  deviceId: {
    type:    String,
    default: null,
  },
  userAgent: {
    type:    String,
    default: null,
  },
  ip: {
    type:     String,
    required: true,
  },
  expiresAt: {
    type:     Date,
    required: true,
  },
  usedAt: {
    type:    Date,
    default: null,
  },
  revokedAt: {
    type:    Date,
    default: null,
  },
  revokeReason: {
    type:    String,
    enum:    ['logout', 'logout_all', 'manual_revoke', 'password_reset', 'expired', 'family_breach', null],
    default: null,
  },
}, {
  timestamps: true,
});

// TTL Index: MongoDB automatically removes expired tokens after expiration date
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Static Methods ───────────────────────────────────────────────────────────

refreshTokenSchema.statics.createToken = async function(userId, ip, userAgent) {
  const rawToken    = crypto.randomBytes(48).toString('hex');
  const tokenHash   = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenPrefix = rawToken.slice(0, 8);
  const family      = crypto.randomBytes(16).toString('hex');
  const expiresDays = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10);
  const expiresAt   = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  await this.create({
    userId,
    tokenHash,
    tokenPrefix,
    family,
    ip:        ip || '127.0.0.1',
    userAgent: userAgent || 'Unknown',
    expiresAt,
  });

  return rawToken;
};

refreshTokenSchema.statics.verifyToken = async function(rawToken) {
  if (!rawToken) return null;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenDoc  = await this.findOne({ tokenHash, revokedAt: null });

  if (!tokenDoc) return null;
  if (tokenDoc.expiresAt < new Date()) {
    await tokenDoc.updateOne({ revokedAt: new Date(), revokeReason: 'expired' });
    return null;
  }

  return tokenDoc;
};

refreshTokenSchema.statics.rotateToken = async function(oldTokenDoc, ip, userAgent) {
  // Atomic check-and-update: Only transition usedAt from null -> Date
  // If a concurrent request already updated this token, findOneAndUpdate returns null!
  const updatedDoc = await this.findOneAndUpdate(
    { _id: oldTokenDoc._id, usedAt: null },
    { usedAt: new Date() },
    { new: true }
  );

  if (!updatedDoc) {
    // Kiểm tra xem token này có vừa được sử dụng trong khoảng thời gian ân hạn (Grace Period / Leeway: 15 giây) hay không.
    // Điều này giải quyết triệt để race condition khi trình duyệt gửi nhiều request 401 đồng thời.
    const recentDoc = await this.findById(oldTokenDoc._id);
    const GRACE_PERIOD_MS = 15 * 1000;
    const isWithinGrace = recentDoc && recentDoc.usedAt &&
      (Date.now() - new Date(recentDoc.usedAt).getTime()) < GRACE_PERIOD_MS &&
      !recentDoc.revokedAt;

    if (isWithinGrace) {
      const newRawToken = crypto.randomBytes(48).toString('hex');
      const tokenHash   = crypto.createHash('sha256').update(newRawToken).digest('hex');
      const expiresDays = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10);
      const expiresAt   = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

      await this.create({
        userId:      oldTokenDoc.userId,
        tokenHash,
        tokenPrefix: newRawToken.slice(0, 8),
        family:      oldTokenDoc.family,
        ip:          ip || oldTokenDoc.ip,
        userAgent:   userAgent || oldTokenDoc.userAgent,
        expiresAt,
      });

      return newRawToken;
    }

    // Replay Attack Detection: Token đã bị sử dụng vượt quá cửa sổ ân hạn -> Thật sự là tấn công Replay Attack!
    await this.updateMany(
      { family: oldTokenDoc.family },
      { revokedAt: new Date(), revokeReason: 'family_breach' }
    );
    console.error(`[SECURITY ALERT] Refresh token replay attack detected! Family: ${oldTokenDoc.family}`);
    return null;
  }

  // Issue new token in the same family
  const newRawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash   = crypto.createHash('sha256').update(newRawToken).digest('hex');
  const expiresDays = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10);
  const expiresAt   = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  await this.create({
    userId:      oldTokenDoc.userId,
    tokenHash,
    tokenPrefix: newRawToken.slice(0, 8),
    family:      oldTokenDoc.family,
    ip:          ip || oldTokenDoc.ip,
    userAgent:   userAgent || oldTokenDoc.userAgent,
    expiresAt,
  });

  return newRawToken;
};

refreshTokenSchema.statics.revokeAllUserTokens = async function(userId, reason = 'logout_all') {
  await this.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date(), revokeReason: reason }
  );
};

module.exports = authDB.model('RefreshToken', refreshTokenSchema);
