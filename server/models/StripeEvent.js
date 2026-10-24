'use strict';

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');

const stripeEventSchema = new mongoose.Schema({
  eventId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },
  type: {
    type:     String,
    required: true,
    index:    true,
  },
  status: {
    type:    String,
    enum:    ['PROCESSED', 'FAILED', 'IGNORED', 'DUPLICATE'],
    default: 'PROCESSED',
  },
  customerId: {
    type:  String,
    index: true,
  },
  userId: {
    type:  mongoose.Schema.Types.ObjectId,
    ref:   'User',
    index: true,
  },
  metadata: {
    type:    Object,
    default: {},
  },
  processedAt: {
    type:    Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

stripeEventSchema.index({ type: 1, createdAt: -1 });

module.exports = dataConn.model('StripeEvent', stripeEventSchema);
