/**
 * Track failed login attempts for account & IP lockout.
 * Stored in authDB.
 */
'use strict';

const mongoose = require('mongoose');
const { authDB } = require('../config/database');

const loginAttemptSchema = new mongoose.Schema({
  identifier: {
    type:     String,
    required: true,
    index:    true,
  },
  type: {
    type:     String,
    enum:     ['email', 'ip'],
    required: true,
  },
  attempts: {
    type:    Number,
    default: 0,
  },
  firstAt: {
    type:    Date,
    default: Date.now,
  },
  lastAt: {
    type:    Date,
    default: Date.now,
  },
  lockedUntil: {
    type:    Date,
    default: null,
  },
  expiresAt: {
    type:    Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
});

// Auto-cleanup after 24h of inactivity
loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const MAX_ATTEMPTS    = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MIN || '15', 10);

loginAttemptSchema.statics.recordFailed = async function(identifier, type) {
  const attempt = await this.findOneAndUpdate(
    { identifier, type },
    {
      $inc: { attempts: 1 },
      $set: { lastAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      $setOnInsert: { firstAt: new Date() },
    },
    { upsert: true, new: true }
  );

  if (attempt.attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    await attempt.updateOne({ lockedUntil });
    return { locked: true, lockedUntil, attempts: attempt.attempts, remaining: 0 };
  }

  return { locked: false, remaining: Math.max(0, MAX_ATTEMPTS - attempt.attempts), attempts: attempt.attempts };
};

loginAttemptSchema.statics.isLocked = async function(identifier, type) {
  const attempt = await this.findOne({ identifier, type });
  if (!attempt || !attempt.lockedUntil) return false;
  if (attempt.lockedUntil > new Date()) {
    return { locked: true, lockedUntil: attempt.lockedUntil };
  }
  // Lockout expired -> reset
  await attempt.updateOne({ attempts: 0, lockedUntil: null });
  return false;
};

loginAttemptSchema.statics.clear = async function(identifier, type) {
  await this.deleteOne({ identifier, type });
};

module.exports = authDB.model('LoginAttempt', loginAttemptSchema);
