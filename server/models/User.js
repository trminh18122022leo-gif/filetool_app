'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

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
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: 6,
    select:   false, // không trả về khi query thông thường
  },
  name: {
    type: String,
    trim: true,
    default: function() { return this.email.split('@')[0]; },
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
  // Stripe customer ID
  stripeCustomerId: {
    type:    String,
    default: null,
  },
  stripeSubscriptionId: {
    type:    String,
    default: null,
  },
  // Giới hạn theo ngày (reset mỗi 00:00 UTC)
  dailyUsage: {
    date:  { type: String, default: () => new Date().toISOString().slice(0,10) },
    count: { type: Number, default: 0 },
  },
  // Dung lượng cloud đã dùng (bytes)
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
}, {
  timestamps: true,
});

// Hash password trước khi lưu
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Kiểm tra mật khẩu
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Kiểm tra gói còn hạn không
userSchema.methods.isPlanActive = function() {
  if (this.plan === 'free') return true;
  if (!this.planExpiresAt) return true; // lifetime hoặc renew tự động
  return new Date() < this.planExpiresAt;
};

module.exports = mongoose.model('User', userSchema);
