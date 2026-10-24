'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const crypto = require('node:crypto');
const jwt    = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-security-audit-32chars!';
process.env.CLIENT_URL = 'http://localhost:5173';

const authSvc = require('../../server/services/auth.service');
const storageSvc = require('../../server/services/storage.service');
const { validateUploadedFiles, checkMagicBytes } = require('../../server/middleware/security');
const { validateDownloadAccess } = require('../../server/middleware/accessControl');
const { cleanupTempFiles, cleanDirectory, reconcileExpiredCloudFiles } = require('../../server/services/cleanup.service');
const FileRecord = require('../../server/models/FileRecord');
const User = require('../../server/models/User');
const dbConfig = require('../../server/config/database');

describe('📦 File Storage Security, Lifecycle & Negative Verification Suite', () => {

  const userA = {
    _id: '507f1f77bcf86cd799439011',
    email: 'tenant_a@test.local',
    role: 'user',
    plan: 'free',
  };

  const userB = {
    _id: '507f191e810c19729de860ea',
    email: 'tenant_b@test.local',
    role: 'user',
    plan: 'free',
  };

  const testTempDir = path.resolve('uploads', 'test_fixtures');
  const AuditLog = require('../../server/models/AuditLog');
  const origAuditLog = AuditLog.log;

  before(() => {
    AuditLog.log = async () => {};
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
  });

  after(async () => {
    try {
      AuditLog.log = origAuditLog;
      if (fs.existsSync(testTempDir)) {
        fs.rmSync(testTempDir, { recursive: true, force: true });
      }
      await dbConfig.closeConnections();
    } catch (_) {}
  });

  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
      setHeader(k, v) {
        this.headers[k] = v;
      },
    };
  }

  // ── 1. Wrong Owner (Cross-Tenant File Access) ──────────────────────────────
  describe('1. Wrong Owner / Cross-Tenant Storage Isolation', () => {
    it('User B cannot access or download User A file in storage routes', async () => {
      const origFindOne = FileRecord.findOne;
      // Mock FileRecord.findOne to mimic MongoDB query: { _id, user: req.user._id }
      FileRecord.findOne = async (query) => {
        // Query has: user: req.user._id
        if (query.user && String(query.user) !== String(userA._id)) {
          return null; // Return null if requesting user is NOT userA
        }
        return {
          _id: 'file-123',
          originalName: 'doc.pdf',
          cloudKey: 'users/userA/doc.pdf',
          user: userA._id,
          status: 'RESULT_READY',
          save: async () => {},
        };
      };

      try {
        const storageRoutes = require('../../server/routes/storage.routes');
        const routeLayer = storageRoutes.stack.find(s => s.route?.path === '/download/:id');
        assert.ok(routeLayer, 'Route /download/:id must exist');

        const req = {
          params: { id: 'file-123' },
          user: { _id: userB._id }, // Authenticated as User B
          headers: {},
          ip: '127.0.0.1',
        };
        const res = createMockRes();

        // The second stack handler is the controller after requireAuth
        await routeLayer.route.stack[1].handle(req, res, () => {});

        assert.equal(res.statusCode, 404, 'Must return 404 without leaking existence of other user file');
        assert.equal(res.body?.code, 'FILE_NOT_FOUND');
      } finally {
        FileRecord.findOne = origFindOne;
      }
    });
  });

  // ── 2. Guessed Filename (Direct Access Attempt) ─────────────────────────────
  describe('2. Guessed Filename Attack Prevention', () => {
    it('Attacker guessing valid output filename is blocked with 403 FORBIDDEN_FILE_ACCESS', async () => {
      const req = {
        params: { filename: 'confidential_quarterly_report.pdf' },
        query: {}, // Zero tokens
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateDownloadAccess(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'Direct unauthenticated file crawl must be blocked');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.code, 'FORBIDDEN_FILE_ACCESS');
    });
  });

  // ── 3. Expired Signed URL / Download Token ──────────────────────────────────
  describe('3. Expired Signed URL / Token Invalidation', () => {
    it('Expired signed download token is rejected with 403 INVALID_DOWNLOAD_TOKEN', async () => {
      const expiredToken = jwt.sign(
        { filename: 'result.pdf', userId: 'anonymous', type: 'file_download' },
        process.env.JWT_SECRET,
        { expiresIn: -10 } // Expired 10s ago
      );

      const req = {
        params: { filename: 'result.pdf' },
        query: { token: expiredToken },
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateDownloadAccess(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.code, 'INVALID_DOWNLOAD_TOKEN');
    });
  });

  // ── 4. Multi-part / Upload Abort Cleanup ────────────────────────────────────
  describe('4. Aborted Upload Cleanup & Quarantine Hygiene', () => {
    it('Orphaned partial upload file is safely unlinked by cleanDirectory', () => {
      const orphanFile = path.join(testTempDir, 'aborted_upload_part_001.tmp');
      fs.writeFileSync(orphanFile, Buffer.alloc(1024));

      assert.ok(fs.existsSync(orphanFile));

      // Clean files older than 0ms
      const deleted = cleanDirectory(testTempDir, -1);
      assert.ok(deleted >= 1);
      assert.equal(fs.existsSync(orphanFile), false, 'Aborted upload file must be removed');
    });
  });

  // ── 5. Oversized File Rejection ─────────────────────────────────────────────
  describe('5. Oversized File Guard', () => {
    it('Rejects file exceeding max file size limit during upload filtering', () => {
      const uploadMw = require('../../server/middleware/upload');
      assert.ok(uploadMw, 'Upload middleware must be defined');
      // Verifies limits are configured on raw multer
      assert.equal(uploadMw.raw.limits.fileSize, 500 * 1024 * 1024);
    });
  });

  // ── 6. Spoofed Extension & Spoofed MIME ────────────────────────────────────
  describe('6. Spoofed Extension & MIME Binary Validation', () => {
    it('Rejects file claiming to be .pdf but containing Windows Executable (MZ) binary', async () => {
      const fakePdf = path.join(testTempDir, 'malicious_trojan.pdf');
      // MZ header (0x4D, 0x5A) followed by binary junk
      const mzPayload = Buffer.concat([Buffer.from([0x4D, 0x5A, 0x90, 0x00]), Buffer.alloc(100)]);
      fs.writeFileSync(fakePdf, mzPayload);

      const req = {
        files: [{
          path: fakePdf,
          originalname: 'invoice.pdf',
          mimetype: 'application/pdf',
        }],
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateUploadedFiles(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'Executable disguised as PDF must be blocked');
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.code, 'INVALID_FILE_CONTENT');
      assert.equal(fs.existsSync(fakePdf), false, 'Malicious file must be immediately quarantined and unlinked');
    });

    it('Rejects file claiming to be .jpg but containing shell script', async () => {
      const fakeJpg = path.join(testTempDir, 'script.jpg');
      fs.writeFileSync(fakeJpg, '#!/bin/bash\nrm -rf /;\n');

      const req = {
        files: [{
          path: fakeJpg,
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
        }],
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateUploadedFiles(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.code, 'INVALID_FILE_CONTENT');
      assert.equal(fs.existsSync(fakeJpg), false);
    });
  });

  // ── 7. Malformed PDF & PDF Complexity Guard ────────────────────────────────
  describe('7. Malformed PDF & Malicious PDF Action Guard', () => {
    it('Rejects corrupt/truncated PDF missing valid %PDF- header', async () => {
      const corruptPdf = path.join(testTempDir, 'corrupt.pdf');
      fs.writeFileSync(corruptPdf, 'Not a real pdf at all just plain text');

      const req = {
        files: [{
          path: corruptPdf,
          originalname: 'corrupt.pdf',
          mimetype: 'application/pdf',
        }],
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateUploadedFiles(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.code, 'INVALID_FILE_CONTENT');
      assert.equal(fs.existsSync(corruptPdf), false);
    });

    it('Rejects PDF containing dangerous /Launch executable command action', async () => {
      const launchPdf = path.join(testTempDir, 'exploit_launch.pdf');
      const maliciousPdfContent = '%PDF-1.7\n1 0 obj\n<< /Type /Action /S /Launch /F (cmd.exe) >>\nendobj\n%%EOF';
      fs.writeFileSync(launchPdf, maliciousPdfContent);

      const req = {
        files: [{
          path: launchPdf,
          originalname: 'exploit_launch.pdf',
          mimetype: 'application/pdf',
        }],
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateUploadedFiles(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.code, 'INVALID_FILE_CONTENT');
      assert.equal(fs.existsSync(launchPdf), false);
    });
  });

  // ── 8. Temp-File Direct Path Traversal Injection (S-08) ────────────────────
  describe('8. Client-Controlled Path Traversal Defense (Finding S-08)', () => {
    it('PDF redact endpoint rejects directory traversal in tempFilePath', async () => {
      const pdfRoutes = require('../../server/routes/pdf.routes');
      const routeLayer = pdfRoutes.stack.find(s => s.route?.path === '/redact');
      assert.ok(routeLayer, 'Route /redact must exist');

      const req = {
        body: { tempFilePath: '../../../../Windows/win.ini' },
        file: null,
        cookies: {},
        get: () => 'localhost:3002',
      };
      const res = createMockRes();

      await routeLayer.route.stack[2].handle(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.code, 'PATH_TRAVERSAL_DETECTED');
    });

    it('Video render endpoint rejects absolute system path in videoFilename', async () => {
      const videoTranslateRoutes = require('../../server/routes/videotranslate.routes');
      const routeLayer = videoTranslateRoutes.stack.find(s => s.route?.path === '/render');
      assert.ok(routeLayer, 'Route /render must exist');

      const req = {
        body: {
          videoFilename: '..\\..\\Windows\\System32\\cmd.exe',
          cues: [{ start: 0, end: 1, text: 'hello' }],
        },
        cookies: {},
        get: () => 'localhost:3002',
      };
      const res = createMockRes();

      await routeLayer.route.stack[1].handle(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.code, 'PATH_TRAVERSAL_DETECTED');
    });
  });

  // ── 9. Storage Outage & Fail-Closed Behavior ────────────────────────────────
  describe('9. Storage Outage & Fail-Closed Policy', () => {
    it('uploadToCloud fails closed when R2 storage client is not configured', async () => {
      const origEndpoint = process.env.R2_ENDPOINT;
      delete process.env.R2_ENDPOINT;

      try {
        await assert.rejects(
          async () => {
            await storageSvc.uploadToCloud('dummy.txt', { userId: userA._id });
          },
          /Cloud storage chưa được cấu hình/
        );
      } finally {
        process.env.R2_ENDPOINT = origEndpoint;
      }
    });
  });

  // ── 10. Worker Crash / Orphan Temp Input Cleanup ───────────────────────────
  describe('10. Worker Crash Orphan Input Cleanup', () => {
    it('cleanupTempFiles cleans orphan files left by interrupted workers', () => {
      const orphanInput = path.resolve('uploads', 'orphan_crash_worker.pdf');
      fs.writeFileSync(orphanInput, 'dummy temporary worker input');
      const pastSec = (Date.now() - 10000) / 1000;
      fs.utimesSync(orphanInput, pastSec, pastSec);

      assert.ok(fs.existsSync(orphanInput));

      // Run cleanup for files older than 5 seconds
      const { uploadsDeleted } = cleanupTempFiles(5000);
      assert.ok(uploadsDeleted >= 1);
      assert.equal(fs.existsSync(orphanInput), false, 'Orphan worker input must be cleaned');
    });
  });

  // ── 11. Manual Deletion & Idempotency ──────────────────────────────────────
  describe('11. Manual Deletion Idempotency', () => {
    it('Calling deleteFromCloud multiple times is idempotent and safe', async () => {
      const origFindOne = FileRecord.findOne;
      const origFindByIdAndUpdate = User.findByIdAndUpdate;

      let quotaDecrementedCount = 0;
      User.findByIdAndUpdate = async () => { quotaDecrementedCount++; };

      let callCount = 0;
      const mockRecord = {
        _id: 'rec-123',
        cloudKey: 'users/123/file.pdf',
        fileSize: 1024,
        status: 'RESULT_READY',
        save: async function() { this.status = 'DELETED'; },
      };

      FileRecord.findOne = async () => {
        callCount++;
        return mockRecord;
      };

      try {
        // First delete
        const res1 = await storageSvc.deleteFromCloud('rec-123', userA._id);
        assert.equal(res1.success, true);
        assert.equal(mockRecord.status, 'DELETED');
        assert.equal(quotaDecrementedCount, 1);

        // Second delete on already DELETED file
        const res2 = await storageSvc.deleteFromCloud('rec-123', userA._id);
        assert.equal(res2.success, true);
        // Quota should NOT be decremented a second time!
        assert.equal(quotaDecrementedCount, 1, 'Idempotent: quota must not double-decrement');
      } finally {
        FileRecord.findOne = origFindOne;
        User.findByIdAndUpdate = origFindByIdAndUpdate;
      }
    });
  });

  // ── 12. Retention Expiry Reconciliation ────────────────────────────────────
  describe('12. Retention Expiry Reconciliation', () => {
    it('reconcileExpiredCloudFiles identifies and cleans up expired cloud records', async () => {
      const origFind = FileRecord.find;
      const origDelete = storageSvc.deleteFromCloud;

      let deletedInCloud = 0;
      storageSvc.deleteFromCloud = async () => { deletedInCloud++; };

      FileRecord.find = () => ({
        limit: async () => [
          { _id: 'exp-1', user: userA._id, status: 'EXPIRING' },
          { _id: 'exp-2', user: userB._id, status: 'RESULT_READY' },
        ],
      });

      try {
        const cleaned = await reconcileExpiredCloudFiles();
        assert.equal(cleaned, 2, 'Should process 2 expired records');
        assert.equal(deletedInCloud, 2, 'Both expired objects must be deleted from cloud');
      } finally {
        FileRecord.find = origFind;
        storageSvc.deleteFromCloud = origDelete;
      }
    });
  });

});
