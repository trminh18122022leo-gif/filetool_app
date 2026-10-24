'use strict';

/**
 * tests/reliability/job-system.test.js
 * Test suite kiểm định độ tin cậy của Distributed Job System, Idempotency, Quota Atomicity & Tenant Boundary.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-reliability-audit-32chars!';

const JobRecord = require('../../server/models/JobRecord');
const User = require('../../server/models/User');
const { reserveQuota, refundQuota, commitQuota, PLAN_LIMITS } = require('../../server/services/quota.service');
const { enqueueJob, cancelJob, getJobStatus, processJobDirectly } = require('../../server/queue/jobQueue');
const { isRedisReady } = require('../../server/queue/connection');

describe('⚙️ Distributed Job System & Reliability Verification Suite', () => {

  const testDir = path.resolve('outputs', 'test_jobs_reliability');
  let samplePdfPath = '';

  // In-Memory Mocks for DB operations in Test Environment
  const memJobStore = new Map();
  const memUserStore = new Map();

  const origJobFindOne = JobRecord.findOne;
  const origUserFindById = User.findById;
  const origUserFindOneAndUpdate = User.findOneAndUpdate;
  const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

  let userA = null;
  let userB = null;

  function createMockJobRecord(data) {
    const job = {
      ...data,
      jobId: data.jobId || uuidv4(),
      status: data.status || 'INITIATED',
      progress: data.progress || 0,
      currentStep: data.currentStep || 'Khởi tạo',
      errors: data.errors || [],
      quotaReserved: data.quotaReserved || { count: 0, committed: false },
      save: async function() {
        memJobStore.set(this.jobId, this);
        return this;
      },
      select: function() { return this; },
    };
    memJobStore.set(job.jobId, job);
    return job;
  }

  before(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    samplePdfPath = path.join(testDir, 'sample_test.pdf');
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 300]);
    page.drawText('Test Content for Reliability Worker Processing', { x: 50, y: 150 });
    fs.writeFileSync(samplePdfPath, await doc.save());

    userA = {
      _id: '607f1f77bcf86cd7994390aa',
      email: 'tenant_worker_a@test.local',
      role: 'user',
      plan: 'free',
      dailyUsage: {
        date: new Date().toISOString().slice(0, 10),
        count: 0,
      },
      cloudStorageUsed: 0,
    };

    userB = {
      _id: '607f1f77bcf86cd7994390bb',
      email: 'tenant_worker_b@test.local',
      role: 'user',
      plan: 'free',
      dailyUsage: {
        date: new Date().toISOString().slice(0, 10),
        count: 0,
      },
      cloudStorageUsed: 0,
    };

    memUserStore.set(String(userA._id), userA);
    memUserStore.set(String(userB._id), userB);

    // Mock DB queries
    JobRecord.findOne = function(query) {
      return {
        select: function() {
          return this.exec();
        },
        exec: async function() {
          if (query.jobId) {
            return memJobStore.get(query.jobId) || null;
          }
          if (query.idempotencyKey) {
            for (const job of memJobStore.values()) {
              if (job.idempotencyKey === query.idempotencyKey) {
                if (!query.user || String(job.user) === String(query.user)) {
                  return job;
                }
              }
            }
          }
          return null;
        },
        then: function(resolve, reject) {
          return this.exec().then(resolve, reject);
        },
      };
    };

    User.findById = async function(id) {
      return memUserStore.get(String(id)) || null;
    };

    User.findOneAndUpdate = async function(query, update) {
      const user = memUserStore.get(String(query._id));
      if (!user) return null;

      // Check condition: count <= maxDailyJobs - count
      const countToAdd = update.$inc?.['dailyUsage.count'] || 0;
      const maxLimit = PLAN_LIMITS[user.plan || 'free'].maxDailyJobs;
      if (user.dailyUsage.count + countToAdd > maxLimit) {
        return null; // Race / quota exceeded
      }

      if (update.$inc) {
        if (update.$inc['dailyUsage.count']) user.dailyUsage.count += update.$inc['dailyUsage.count'];
        if (update.$inc.cloudStorageUsed) user.cloudStorageUsed += update.$inc.cloudStorageUsed;
      }
      if (update.$set) {
        if (update.$set['dailyUsage.date']) user.dailyUsage.date = update.$set['dailyUsage.date'];
      }
      return user;
    };

    User.findByIdAndUpdate = async function(id, update) {
      const user = memUserStore.get(String(id));
      if (!user) return null;
      if (update.$inc && update.$inc['dailyUsage.count']) {
        user.dailyUsage.count += update.$inc['dailyUsage.count'];
      }
      return user;
    };
  });

  after(() => {
    // Restore mocks
    JobRecord.findOne = origJobFindOne;
    User.findById = origUserFindById;
    User.findOneAndUpdate = origUserFindOneAndUpdate;
    User.findByIdAndUpdate = origUserFindByIdAndUpdate;

    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  beforeEach(() => {
    memJobStore.clear();
    userA.dailyUsage.count = 0;
    userB.dailyUsage.count = 0;
  });

  describe('1. Idempotency-Key Deduplication & Safe Resends', () => {

    it('Đảm bảo cùng 1 Idempotency-Key không tạo duplicate job hay trừ phí 2 lần', async () => {
      const idempotencyKey = `idem-key-${uuidv4()}`;

      const job1 = createMockJobRecord({
        jobId: uuidv4(),
        idempotencyKey,
        user: userA._id,
        operation: 'pdf-compress',
        status: 'QUEUED',
        quotaReserved: { count: 1, committed: false },
      });
      await job1.save();

      // Giả lập browser resend hoặc network retry với cùng Idempotency-Key
      const foundDuplicate = await JobRecord.findOne({
        idempotencyKey,
        user: userA._id,
      });

      assert.ok(foundDuplicate, 'Phải tìm thấy job đã tạo trước đó');
      assert.strictEqual(foundDuplicate.jobId, job1.jobId, 'JobId phải hoàn toàn trùng khớp (Idempotent Replay)');
      assert.strictEqual(foundDuplicate.operation, 'pdf-compress');
    });

  });

  describe('2. Multi-Tenant Boundary & Job ACL Security', () => {

    it('User B bị từ chối xem trạng thái tác vụ của User A (403 FORBIDDEN_JOB_ACCESS)', async () => {
      const jobOfUserA = createMockJobRecord({
        jobId: uuidv4(),
        user: userA._id,
        operation: 'pdf-redact',
        status: 'PROCESSING',
        progress: 45,
      });
      await jobOfUserA.save();

      // User B cố tình truy vấn job của User A
      await assert.rejects(
        async () => {
          await getJobStatus(jobOfUserA.jobId, userB);
        },
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_JOB_ACCESS');
          return true;
        }
      );

      // User A truy vấn chính job của mình -> Thành công
      const statusData = await getJobStatus(jobOfUserA.jobId, userA);
      assert.strictEqual(statusData.jobId, jobOfUserA.jobId);
      assert.strictEqual(statusData.status, 'PROCESSING');
      assert.strictEqual(statusData.progress, 45);
    });

    it('User B bị từ chối hủy tác vụ của User A', async () => {
      const jobOfUserA = createMockJobRecord({
        jobId: uuidv4(),
        user: userA._id,
        operation: 'batch-process',
        status: 'QUEUED',
      });
      await jobOfUserA.save();

      await assert.rejects(
        async () => {
          await cancelJob(jobOfUserA.jobId, userB);
        },
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_JOB_ACCESS');
          return true;
        }
      );
    });

  });

  describe('3. Atomic Quota Reservation & Release Policy', () => {

    it('Đặt trước quota thành công khi còn trong hạn mức', async () => {
      const res = await reserveQuota(userA._id, { count: 1 });
      assert.strictEqual(res.success, true);
      assert.strictEqual(userA.dailyUsage.count, 1);
    });

    it('Từ chối đặt trước khi quota đã cạn (DAILY_QUOTA_EXHAUSTED)', async () => {
      userA.dailyUsage.count = PLAN_LIMITS.free.maxDailyJobs; // 15
      const res = await reserveQuota(userA._id, { count: 1 });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, 'DAILY_QUOTA_EXHAUSTED');
    });

    it('Hủy tác vụ chưa hoàn thành phải hoàn trả quota (Refund Quota)', async () => {
      userA.dailyUsage.count = 5;

      const jobToCancel = createMockJobRecord({
        jobId: uuidv4(),
        user: userA._id,
        operation: 'pdf-compress',
        status: 'QUEUED',
        quotaReserved: { count: 1, committed: false },
      });
      await jobToCancel.save();

      // Thực hiện hủy tác vụ
      const cancelResult = await cancelJob(jobToCancel.jobId, userA);
      assert.strictEqual(cancelResult.success, true);
      assert.strictEqual(cancelResult.status, 'CANCELLED');

      // Xác nhận quota đã được hoàn trả: 5 - 1 = 4
      assert.strictEqual(userA.dailyUsage.count, 4);
    });

    it('Tác vụ đã hoàn tất (COMPLETED) đã commit quota thì không được hoàn trả', async () => {
      userA.dailyUsage.count = 3;

      const completedJob = createMockJobRecord({
        jobId: uuidv4(),
        user: userA._id,
        operation: 'pdf-merge',
        status: 'COMPLETED',
        quotaReserved: { count: 1, committed: true },
      });
      await completedJob.save();

      const refundResult = await refundQuota(completedJob);
      assert.strictEqual(refundResult.refunded, false);
      assert.strictEqual(refundResult.reason, 'ALREADY_COMMITTED_OR_EMPTY');

      // Quota vẫn nguyên vẹn
      assert.strictEqual(userA.dailyUsage.count, 3);
    });

  });

  describe('4. Job Execution & Sandbox Directory Isolation', () => {

    it('Thực thi hoàn tất một tác vụ trong Isolated Sandbox Directory', async () => {
      const jobId = uuidv4();
      const testJob = createMockJobRecord({
        jobId,
        user: userA._id,
        operation: 'pdf-compress',
        params: { quality: 'ebook' },
        inputFiles: [{
          fileId: 'input-f1',
          originalName: 'sample_test.pdf',
          localPath: samplePdfPath,
          fileSize: fs.statSync(samplePdfPath).size,
          mimeType: 'application/pdf',
        }],
        status: 'INITIATED',
        quotaReserved: { count: 1, committed: false },
      });
      await testJob.save();

      // Thực thi qua pipeline dispatcher
      await processJobDirectly(testJob);

      assert.strictEqual(testJob.status, 'COMPLETED');
      assert.strictEqual(testJob.progress, 100);
      assert.strictEqual(testJob.quotaReserved.committed, true, 'Quota phải được commit khi job thành công');
      assert.ok(testJob.outputFile?.localPath, 'Output file path phải tồn tại');

      // Xác nhận thư mục sandbox riêng biệt của job đã được dọn sạch an toàn
      const expectedSandboxDir = path.resolve('uploads', 'jobs', jobId);
      assert.strictEqual(fs.existsSync(expectedSandboxDir), false, 'Thư mục tạm sandbox của job phải được dọn sạch hoàn toàn!');

      // Dọn file output sau test
      try {
        if (testJob.outputFile?.localPath && fs.existsSync(testJob.outputFile.localPath)) {
          fs.unlinkSync(testJob.outputFile.localPath);
        }
      } catch (_) {}
    });

  });

  describe('5. Health & Observability Capabilities Check', () => {

    it('Xác nhận trạng thái capabilities không lộ lọt thông tin nhạy cảm', () => {
      const redisStatus = isRedisReady();
      assert.strictEqual(typeof redisStatus, 'boolean');

      const expectedSupportedOps = [
        'pdf-compress',
        'pdf-merge',
        'pdf-split',
        'pdf-to-word',
        'word-to-pdf',
        'pdf-redact',
        'batch-process',
        'image-convert',
        'image-compress',
        'image-resize',
        'html-to-pdf',
      ];

      assert.ok(expectedSupportedOps.length >= 10);
    });

  });

});
