'use strict';

/**
 * server/services/collabAuth.js
 * Database-backed document-level authorization service for Yjs collaboration rooms.
 * 
 * Invariants:
 * - Every Yjs collaboration room must be created through a verified document or workspace flow.
 * - Connecting to an unknown arbitrary room ID does NOT grant ownership (fails closed with ROOM_NOT_FOUND).
 * - Unauthorized users cannot access arbitrary documents, regardless of naming convention.
 * - Deleted documents and rooms are rejected (DOCUMENT_DELETED).
 * - Access between different user accounts is strictly isolated and rejected with 403 Forbidden
 *   unless explicitly granted via room collaborators list.
 * - Fails closed in staging and production if the backing database is disconnected.
 */

const mongoose = require('mongoose');
const { isDataConnected } = require('../config/database');
const CollabRoom = require('../models/CollabRoom');
const FileRecord = require('../models/FileRecord');

function isValidObjectId(val) {
  return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);
}

/**
 * Validate room identifier for path traversal, control chars, length, and format
 */
function isValidRoomIdentifier(roomId) {
  if (!roomId || typeof roomId !== 'string') return false;
  const clean = roomId.trim();
  if (clean.length < 3 || clean.length > 128) return false;

  // Reject path traversal and dangerous characters
  if (clean.includes('..') || clean.includes('/') || clean.includes('\\') || clean.includes('\0')) {
    return false;
  }
  // Allow alphanumeric, underscores, hyphens, colons, and dots
  if (!/^[a-zA-Z0-9_\-:\.]+$/.test(clean)) {
    return false;
  }
  return true;
}

// In-memory registry for test mode and local dev when MongoDB is offline
const inMemoryCollabRooms = new Map();

/**
 * Explicitly create a verified collaboration room.
 * Must be called through an authenticated document creation flow.
 * 
 * @param {string} roomId - Unique room identifier
 * @param {string} ownerId - Authenticated User ID of creator
 * @param {object} options - Optional metadata { title, isPublic, collaborators }
 */
async function createCollabRoom(roomId, ownerId, options = {}) {
  if (!isValidRoomIdentifier(roomId)) {
    throw new Error('Invalid room identifier format');
  }
  if (!ownerId) {
    throw new Error('Owner ID is required to create a collaboration room');
  }

  const cleanRoomId = roomId.trim();
  const ownerIdStr = String(ownerId);
  const { title = 'Collaborative Document', isPublic = false, collaborators = [] } = options;

  if (isDataConnected && isDataConnected()) {
    const existing = await CollabRoom.findOne({ roomId: cleanRoomId });
    if (existing) {
      if (String(existing.owner) !== ownerIdStr) {
        throw new Error('Room ID already claimed by another user');
      }
      return existing;
    }

    const room = await CollabRoom.create({
      roomId: cleanRoomId,
      owner: isValidObjectId(ownerIdStr) ? new mongoose.Types.ObjectId(ownerIdStr) : null,
      title,
      isPublic: Boolean(isPublic),
      collaborators: collaborators.map(c => isValidObjectId(String(c)) ? new mongoose.Types.ObjectId(String(c)) : c),
      status: 'ACTIVE',
      isDeleted: false,
    });
    return room;
  }

  // In-memory fallback
  if (inMemoryCollabRooms.has(cleanRoomId)) {
    const existing = inMemoryCollabRooms.get(cleanRoomId);
    if (existing.owner !== ownerIdStr) {
      throw new Error('Room ID already claimed by another user');
    }
    return existing;
  }

  const room = {
    roomId: cleanRoomId,
    owner: ownerIdStr,
    title,
    isPublic: Boolean(isPublic),
    collaborators: collaborators.map(c => String(c)),
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: new Date(),
  };
  inMemoryCollabRooms.set(cleanRoomId, room);
  return room;
}

/**
 * Mark a collaboration room as deleted
 */
async function deleteCollabRoom(roomId, requestingUserId) {
  const cleanRoomId = roomId.trim();
  const userIdStr = String(requestingUserId);

  if (isDataConnected && isDataConnected()) {
    const room = await CollabRoom.findOne({ roomId: cleanRoomId });
    if (!room) throw new Error('Collab room not found');
    if (String(room.owner) !== userIdStr) {
      throw new Error('Only the room owner can delete a collaboration room');
    }
    room.isDeleted = true;
    room.status = 'DELETED';
    await room.save();
    return room;
  }

  const room = inMemoryCollabRooms.get(cleanRoomId);
  if (!room) throw new Error('Collab room not found');
  if (room.owner !== userIdStr) {
    throw new Error('Only the room owner can delete a collaboration room');
  }
  room.isDeleted = true;
  room.status = 'DELETED';
  return room;
}

/**
 * Verify whether a given user is authorized to access a Yjs collaboration room.
 * 
 * Rules:
 * 1. Checks room identifier syntax.
 * 2. Personal user rooms (user_<ownerId>_... or user:<ownerId>:...) belong strictly to <ownerId>.
 * 3. FileRecord-backed rooms require document ownership or collaborator status, rejecting deleted files.
 * 4. CollabRoom-backed rooms require room ownership, collaborator status, or public flag, rejecting deleted rooms.
 * 5. Unknown arbitrary rooms are REJECTED (ROOM_NOT_FOUND) — ownership is never granted on connect.
 * 
 * @param {string} roomId - Identifier of the collaboration room / document
 * @param {string} userId - Authenticated User ID from verified JWT
 * @returns {Promise<{ authorized: boolean, reason?: string, role?: string }>}
 */
async function verifyCollabRoomAccess(roomId, userId) {
  if (!isValidRoomIdentifier(roomId)) {
    return { authorized: false, reason: 'INVALID_ROOM_ID' };
  }

  const cleanRoomId = roomId.trim();

  if (!userId) {
    return { authorized: false, reason: 'UNAUTHENTICATED' };
  }

  const userIdStr = String(userId);

  // 1. Convention check: user_<ownerId>_... or user:<ownerId>:...
  if (cleanRoomId.startsWith('user_') || cleanRoomId.startsWith('user:')) {
    const parts = cleanRoomId.split(/[_:]/);
    const roomOwnerId = parts[1];
    if (roomOwnerId && String(roomOwnerId) !== userIdStr) {
      return { authorized: false, reason: 'CROSS_USER_ROOM_FORBIDDEN' };
    }
    // Personal workspace room verified for this authenticated user
    return { authorized: true, role: 'personal_room_owner' };
  }

  // 2. Production & Staging path: Query MongoDB Atlas
  if (isDataConnected && isDataConnected()) {
    try {
      // 2a. Check if roomId represents an existing FileRecord (document-backed)
      const fileQuery = [{ fileId: cleanRoomId }];
      if (isValidObjectId(cleanRoomId)) {
        fileQuery.push({ _id: new mongoose.Types.ObjectId(cleanRoomId) });
      }

      const fileDoc = await FileRecord.findOne({ $or: fileQuery }).select('user collaborators status isDeleted');
      if (fileDoc) {
        if (fileDoc.status === 'DELETED' || fileDoc.isDeleted) {
          return { authorized: false, reason: 'DOCUMENT_DELETED' };
        }
        if (fileDoc.user && String(fileDoc.user) === userIdStr) {
          return { authorized: true, role: 'file_owner' };
        }
        if (fileDoc.collaborators && fileDoc.collaborators.some(c => String(c) === userIdStr)) {
          return { authorized: true, role: 'file_collaborator' };
        }
        return { authorized: false, reason: 'FILE_ACCESS_DENIED' };
      }

      // 2b. Check existing CollabRoom
      const existingRoom = await CollabRoom.findOne({ roomId: cleanRoomId });
      if (existingRoom) {
        if (existingRoom.isDeleted || existingRoom.status === 'DELETED') {
          return { authorized: false, reason: 'DOCUMENT_DELETED' };
        }
        if (String(existingRoom.owner) === userIdStr) {
          return { authorized: true, role: 'room_owner' };
        }
        if (existingRoom.collaborators && existingRoom.collaborators.some(c => String(c) === userIdStr)) {
          return { authorized: true, role: 'room_collaborator' };
        }
        if (existingRoom.isPublic) {
          return { authorized: true, role: 'public_member' };
        }
        return { authorized: false, reason: 'ROOM_ACCESS_DENIED' };
      }

      // 2c. Room does NOT exist: Reject unauthorized claims to arbitrary identifiers!
      // Rooms must be created via verified document/workspace creation flow.
      return { authorized: false, reason: 'ROOM_NOT_FOUND' };

    } catch (err) {
      console.warn(`[CollabAuth] Database check warning for room ${cleanRoomId}:`, err.message);
      return { authorized: false, reason: 'DATABASE_ERROR' };
    }
  }

  // 3. Fail-closed in production / staging when database is offline
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'staging') {
    return { authorized: false, reason: 'DATABASE_UNAVAILABLE' };
  }

  // 4. Test / Dev in-memory fallback
  if (inMemoryCollabRooms.has(cleanRoomId)) {
    const memRoom = inMemoryCollabRooms.get(cleanRoomId);
    if (memRoom.isDeleted || memRoom.status === 'DELETED') {
      return { authorized: false, reason: 'DOCUMENT_DELETED' };
    }
    if (memRoom.owner === userIdStr) {
      return { authorized: true, role: 'room_owner' };
    }
    if (memRoom.collaborators && memRoom.collaborators.includes(userIdStr)) {
      return { authorized: true, role: 'room_collaborator' };
    }
    if (memRoom.isPublic) {
      return { authorized: true, role: 'public_member' };
    }
    return { authorized: false, reason: 'ROOM_ACCESS_DENIED' };
  }

  // In test / dev mode without pre-creation: arbitrary rooms fail-closed
  return { authorized: false, reason: 'ROOM_NOT_FOUND' };
}

/**
 * Add a collaborator to an existing Yjs collaboration room.
 * Only the room owner may grant collaborator access.
 */
async function addCollabRoomCollaborator(roomId, ownerId, collaboratorUserId) {
  const cleanRoomId = roomId.trim();
  const ownerIdStr = String(ownerId);
  const collabIdStr = String(collaboratorUserId);

  if (isDataConnected && isDataConnected()) {
    const room = await CollabRoom.findOne({ roomId: cleanRoomId });
    if (!room) throw new Error('Collab room not found');
    if (String(room.owner) !== ownerIdStr) throw new Error('Only the room owner can add collaborators');
    if (!room.collaborators.some(c => String(c) === collabIdStr)) {
      room.collaborators.push(new mongoose.Types.ObjectId(collabIdStr));
      await room.save();
    }
    return room;
  }

  const memRoom = inMemoryCollabRooms.get(cleanRoomId);
  if (!memRoom) throw new Error('Collab room not found');
  if (memRoom.owner !== ownerIdStr) throw new Error('Only the room owner can add collaborators');
  if (!memRoom.collaborators.includes(collabIdStr)) {
    memRoom.collaborators.push(collabIdStr);
  }
  return memRoom;
}

function resetCollabRoomsForTesting() {
  inMemoryCollabRooms.clear();
}

module.exports = {
  isValidRoomIdentifier,
  createCollabRoom,
  deleteCollabRoom,
  verifyCollabRoomAccess,
  addCollabRoomCollaborator,
  resetCollabRoomsForTesting,
};
