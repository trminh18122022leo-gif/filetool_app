'use strict';

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');

const aiUsageLedgerSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: false, // Hỗ trợ guest
    index:    true,
  },
  operation: {
    type:     String,
    required: true,
    enum:     ['summarize', 'translate', 'chat', 'explain-code', 'security-audit', 'generate-tests', 'text-to-data', 'edit-diff'],
    index:    true,
  },
  provider: {
    type:     String,
    required: true,
  },
  model: {
    type: String,
  },
  isBYOK: {
    type:    Boolean,
    default: false,
    index:   true,
  },
  promptTokens: {
    type:    Number,
    default: 0,
  },
  completionTokens: {
    type:    Number,
    default: 0,
  },
  totalTokens: {
    type:    Number,
    default: 0,
  },
  providerCostUSD: {
    type:    Number,
    default: 0,
  },
  infrastructureCostUSD: {
    type:    Number,
    default: 0.0002,
  },
  includedCreditsDeducted: {
    type:    Number,
    default: 1,
  },
  latencyMs: {
    type:    Number,
    default: 0,
  },
  status: {
    type:    String,
    enum:    ['SUCCESS', 'FAILED', 'CIRCUIT_BROKEN'],
    default: 'SUCCESS',
    index:   true,
  },
  idempotencyKey: {
    type:   String,
    index:  true,
    sparse: true,
  },
}, {
  timestamps: true,
});

aiUsageLedgerSchema.index({ user: 1, createdAt: -1 });
aiUsageLedgerSchema.index({ createdAt: -1 });

module.exports = dataConn.model('AiUsageLedger', aiUsageLedgerSchema);
