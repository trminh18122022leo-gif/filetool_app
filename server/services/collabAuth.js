'use strict';

/**
 * server/services/collabAuth.js
 * Database-backed document-level authorization service for Yjs collaboration rooms.
 * 
 * Invariants:
 * - Every Yjs collaboration room is bound to an authenticated owner in MongoDB.
 * - Unauthorized users cannot access arbitrary documents, regardless of naming convention.
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

// In-memory registry for test mode and local dev when MongoDB is offline
const inMemoryCollabRooms = new Map();

/**
 * Verify whether a given user is authorized to access a Yjs collaboration room.
 * 
 * @param {string} roomId - Identifier of the collaboration room / document
 * @param {string} userId - Authenticated User ID from verified JWT
 * @returns {Promise<{ authorized: boolean, reason?: string, role?: string }>}
 */
async function verifyCollabRoomAccess(roomId, userId) {
  if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
    return { authorized: false, reason: 'INVALID_ROOM_ID' };
  }

  const cleanRoomId = roomId.trim();

  if (!userId) {
    return { authorized: false, reason: 'UNAUTHENTICATED' };
  }

  const userIdStr = String(userId);

  // 1. Fast convention check: user_<ownerId>_... or user:<ownerId>:...
  if (cleanRoomId.startsWith('user_') || cleanRoomId.startsWith('user:')) {
    const parts = cleanRoomId.split(/[_:]/);
    const roomOwnerId = parts[1];
    if (roomOwnerId && String(roomOwnerId) !== userIdStr) {
      return { authorized: false, reason: 'CROSS_USER_ROOM_FORBIDDEN' };
    }
  }

  // 2. Production & Staging path: Query MongoDB Atlas
  if (isDataConnected && isDataConnected()) {
    try {
      // 2a. Check if roomId represents an existing FileRecord (document-backed)
      const fileQuery = [{ fileId: cleanRoomId }];
      if (isValidObjectId(cleanRoomId)) {
        fileQuery.push({ _id: new mongoose.Types.ObjectId(cleanRoomId) });
      }

      const fileDoc = await FileRecord.findOne({ $or: fileQuery }).select('user collaborators');
      if (fileDoc) {
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

      // 2c. Room does not exist yet: First authenticated visitor registers ownership
      await CollabRoom.create({
        roomId: cleanRoomId,
        owner:  isValidObjectId(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null,
      });
      return { authorized: true, role: 'room_owner_created' };

    } catch (err) {
      if (err.code === 11000) {
        const raceRoom = await CollabRoom.findOne({ roomId: cleanRoomId });
        if (raceRoom && String(raceRoom.owner) === userIdStr) {
          return { authorized: true, role: 'room_owner' };
        }
        return { authorized: false, reason: 'ROOM_ACCESS_DENIED' };
      }
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

  // First authenticated visitor registers ownership in memory
  inMemoryCollabRooms.set(cleanRoomId, {
    roomId: cleanRoomId,
    owner: userIdStr,
    collaborators: [],
    isPublic: false,
    createdAt: new Date(),
  });
  return { authorized: true, role: 'room_owner_created' };
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
  verifyCollabRoomAccess,
  addCollabRoomCollaborator,
  resetCollabRoomsForTesting,
};
