'use strict';

/**
 * server/models/CollabRoom.js
 * Database-backed authorization and access control model for Yjs collaboration rooms.
 * Enforces strict multi-tenant boundary and document ownership across all rooms.
 */

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');

const collabRoomSchema = new mongoose.Schema({
  roomId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },
  owner: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
  }],
  isPublic: {
    type:    Boolean,
    default: false,
    index:   true,
  },
  title: {
    type:    String,
    default: 'Collaborative Document',
  },
}, {
  timestamps: true,
});

collabRoomSchema.index({ owner: 1, roomId: 1 });

module.exports = dataConn.models.CollabRoom || dataConn.model('CollabRoom', collabRoomSchema);
