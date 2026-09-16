/**
 * IndexedDB wrapper cho auto-save, version history, offline storage.
 */
import { openDB } from 'idb';

const DB_NAME    = 'filetools-pro';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Lưu draft tự động
        if (!db.objectStoreNames.contains('drafts')) {
          const drafts = db.createObjectStore('drafts', { keyPath: 'id' });
          drafts.createIndex('updatedAt', 'updatedAt');
        }
        // Lịch sử phiên bản
        if (!db.objectStoreNames.contains('versions')) {
          const versions = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
          versions.createIndex('draftId', 'draftId');
          versions.createIndex('savedAt', 'savedAt');
        }
        // File đã mở gần đây
        if (!db.objectStoreNames.contains('recent')) {
          db.createObjectStore('recent', { keyPath: 'name' });
        }
      },
    });
  }
  return dbPromise;
}

// ── Drafts ────────────────────────────────────────────────────────────────────

export async function saveDraft(id, { content, filename, language, metadata = {} }) {
  const db = await getDB();
  await db.put('drafts', {
    id,
    content,
    filename: filename || 'Untitled',
    language: language || 'plaintext',
    metadata,
    updatedAt: Date.now(),
    size:      new Blob([content]).size,
  });
}

export async function getDraft(id) {
  const db = await getDB();
  return db.get('drafts', id);
}

export async function deleteDraft(id) {
  const db = await getDB();
  await db.delete('drafts', id);
  // Xóa versions liên quan
  const tx    = db.transaction('versions', 'readwrite');
  const index = tx.store.index('draftId');
  const keys  = await index.getAllKeys(id);
  await Promise.all(keys.map(k => tx.store.delete(k)));
  await tx.done;
}

export async function listDrafts() {
  const db = await getDB();
  return db.getAllFromIndex('drafts', 'updatedAt');
}

// ── Version History ───────────────────────────────────────────────────────────

export async function saveVersion(draftId, content, label = '') {
  const db = await getDB();
  // Giữ tối đa 30 versions mỗi draft
  const existing = await db.getAllFromIndex('versions', 'draftId', draftId);
  if (existing.length >= 30) {
    const oldest = existing.sort((a, b) => a.savedAt - b.savedAt)[0];
    if (oldest?.id) {
      await db.delete('versions', oldest.id);
    }
  }
  return db.add('versions', {
    draftId,
    content,
    label:   label || new Date().toLocaleString('vi-VN'),
    savedAt: Date.now(),
    size:    new Blob([content]).size,
  });
}

export async function getVersions(draftId) {
  const db  = await getDB();
  const all = await db.getAllFromIndex('versions', 'draftId', draftId);
  return all.sort((a, b) => b.savedAt - a.savedAt); // Mới nhất trước
}

export async function restoreVersion(versionId) {
  const db = await getDB();
  return db.get('versions', versionId);
}

// ── Recent Files ──────────────────────────────────────────────────────────────

export async function addRecentFile(name, meta = {}) {
  const db = await getDB();
  await db.put('recent', { name, ...meta, openedAt: Date.now() });
}

export async function getRecentFiles(limit = 10) {
  const db  = await getDB();
  const all = await db.getAll('recent');
  return all.sort((a, b) => b.openedAt - a.openedAt).slice(0, limit);
}
