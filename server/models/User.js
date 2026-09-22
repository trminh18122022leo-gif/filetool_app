'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { authDB } = require('../config/database');

const userSchema = new mongoose.Schema({
  email: {
    type:      String,
    required:  [true, 'Email là bắt buộc'],
    unique:    true,
    lowercase: true,
    trim:      true,
  },
  password: {
    type:     String,
    required: false,
    minlength: 6,
    select:   false,
  },
  name: {
    type: String,
    trim: true,
    default: function() { return this.email ? this.email.split('@')[0] : 'User'; },
  },
  avatar: {
    type: String,
    default: null,
  },
  googleId: {
    type: String,
    default: null,
    sparse: true,
  },
  githubId: {
    type: String,
    default: null,
    sparse: true,
  },
  telegramId: {
    type: String,
    default: null,
    sparse: true,
  },
  authProvider: {
    type:    String,
    enum:    ['local', 'google', 'github', 'telegram'],
    default: 'local',
  },
  role: {
    type:    String,
    enum:    ['user', 'admin'],
    default: 'user',
  },
  plan: {
    type:    String,
    enum:    ['free', 'pro', 'business'],
    default: 'free',
  },
  planExpiresAt: {
    type:    Date,
    default: null,
  },
  stripeCustomerId: {
    type:    String,
    default: null,
  },
  stripeSubscriptionId: {
    type:    String,
    default: null,
  },
  dailyUsage: {
    date:  { type: String, default: () => new Date().toISOString().slice(0,10) },
    count: { type: Number, default: 0 },
  },
  cloudStorageUsed: {
    type:    Number,
    default: 0,
  },
  isVerified: {
    type:    Boolean,
    default: false,
  },
  verifyToken:        String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  refreshToken:       String,
  passwordChangedAt:  Date,

  // ── 2FA TOTP Fields ────────────────────────────────────────────────────────
  twoFactorEnabled: {
    type:    Boolean,
    default: false,
  },
  twoFactorSecret: {
    type:    String,
    select:  false,
    default: null,
  },
  twoFactorTempSecret: {
    type:    String,
    select:  false,
    default: null,
  },
  twoFactorChallenge: {
    type:    String,
    default: null,
  },
  twoFactorChallengeExpiry: {
    type:    Date,
    default: null,
  },
  lastLogin: {
    type:    Date,
    default: null,
  },
}, {
  timestamps: true,
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const parsedRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10) || 12;
  // Giới hạn rounds trong khoảng an toàn [10, 14] để ngăn chặn CPU exhaustion DoS
  const ROUNDS = Math.min(14, Math.max(10, parsedRounds));
  this.password = await bcrypt.hash(this.password, ROUNDS);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isPlanActive = function() {
  if (this.plan === 'free') return true;
  if (!this.planExpiresAt) return true;
  return new Date() < this.planExpiresAt;
};

userSchema.methods.toPublic = function() {
  return {
    id:               this._id,
    email:            this.email,
    name:             this.name,
    authProvider:     this.authProvider,
    role:             this.role,
    plan:             this.plan,
    isVerified:       this.isVerified,
    twoFactorEnabled: this.twoFactorEnabled,
    cloudStorageUsed: this.cloudStorageUsed || 0,
    dailyUsage:       this.dailyUsage,
    createdAt:        this.createdAt,
  };
};

// ── Indexes để tăng tốc độ truy vấn ──────────────────────────────────────────
userSchema.index({ resetPasswordToken: 1 }, { sparse: true, expireAfterSeconds: 3600 });
userSchema.index({ verifyToken: 1 },        { sparse: true });
userSchema.index({ plan: 1, planExpiresAt: 1 });
userSchema.index({ createdAt: -1 });

module.exports = authDB.model('User', userSchema);
