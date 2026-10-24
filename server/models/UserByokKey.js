'use strict';

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');

const userByokKeySchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  provider: {
    type:     String,
    enum:     ['gemini', 'openai', 'groq', 'anthropic', 'cerebras', 'openrouter', 'mistral', 'github'],
    required: true,
  },
  encryptedKey: {
    type:     String,
    required: true,
    select:   false, // Strict security: Never returned in normal queries
  },
  iv: {
    type:     String,
    required: true,
    select:   false,
  },
  authTag: {
    type:     String,
    required: true,
    select:   false,
  },
  keyMasked: {
    type:     String,
    required: true,
  },
  isValid: {
    type:    Boolean,
    default: true,
  },
  lastValidatedAt: {
    type:    Date,
    default: Date.now,
  },
  rotationHistory: [{
    rotatedAt:          { type: Date, default: Date.now },
    previousKeyMasked:  String,
  }],
}, {
  timestamps: true,
});

userByokKeySchema.index({ user: 1, provider: 1 }, { unique: true });

module.exports = dataConn.model('UserByokKey', userByokKeySchema);
