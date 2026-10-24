'use strict';

/**
 * server/worker.js
 * Tiến trình nền Render Background Worker độc lập cho các tác vụ CPU-heavy.
 * Hỗ trợ Graceful Shutdown, Class Concurrency, và Khắc phục lỗi tự động.
 */

require('dotenv').config();
const { Worker } = require('bullmq');
const { getRedisClient, isRedisReady, closeRedisConnection } = require('./queue/connection');
const { executeJob } = require('./queue/jobProcessors');
const JobRecord = require('./models/JobRecord');
const { commitQuota, refundQuota } = require('./services/quota.service');
const { emitProgress, emitComplete, emitError } = require('./services/jobEmitter');
const { closeConnections } = require('./config/database');

const QUEUE_NAME = 'filetools-jobs';
let workerInstance = null;

async function startWorker() {
  const client = getRedisClient();
  if (!client) {
    console.warn('⚠️ [Worker] Không có kết nối Redis. Worker không thể lắng nghe BullMQ queue.');
    return;
  }

  console.log(`🚀 [Worker] Khởi động Render Background Worker cho hàng đợi: ${QUEUE_NAME}`);

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { jobId } = job.data;
      console.log(`📥 [Worker] Bắt đầu xử lý Job ID: ${jobId} (Operation: ${job.name})`);

      const jobRecord = await JobRecord.findOne({ jobId });
      if (!jobRecord) {
        throw new Error(`JobRecord không tìm thấy cho Job ID: ${jobId}`);
      }

      if (jobRecord.status === 'CANCELLED') {
        console.log(`⏭️ [Worker] Job ID: ${jobId} đã bị hủy, bỏ qua xử lý`);
        return;
      }

      jobRecord.status = 'PROCESSING';
      jobRecord.startedAt = new Date();
      jobRecord.workerId = `worker-${process.pid}`;
      jobRecord.attempts += 1;
      await jobRecord.save();

      try {
        const outputResult = await executeJob(jobRecord, async (percent, step) => {
          jobRecord.progress = percent;
          jobRecord.currentStep = step;
          await jobRecord.save().catch(() => {});
          emitProgress(jobId, { progress: percent, currentStep: step });
        });

        jobRecord.status = 'COMPLETED';
        jobRecord.progress = 100;
        jobRecord.currentStep = 'Hoàn tất tác vụ';
        jobRecord.completedAt = new Date();
        jobRecord.outputFile = outputResult;

        await commitQuota(jobRecord);
        await jobRecord.save();

        emitComplete(jobId, { outputFile: outputResult });
        console.log(`✅ [Worker] Xử lý thành công Job ID: ${jobId}`);
        return outputResult;
      } catch (err) {
        console.error(`❌ [Worker] Thất bại khi xử lý Job ID: ${jobId}: ${err.message}`);
        jobRecord.status = 'FAILED';
        jobRecord.failedAt = new Date();
        jobRecord.errors.push({ message: err.message, timestamp: new Date() });

        await refundQuota(jobRecord);
        await jobRecord.save();

        emitError(jobId, err);
        throw err;
      }
    },
    {
      connection: client,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4', 10),
      limiter: {
        max: 50,
        duration: 1000,
      },
    }
  );

  workerInstance.on('completed', (job) => {
    console.log(`🎉 [Worker] Job ${job.id} đã hoàn tất`);
  });

  workerInstance.on('failed', (job, err) => {
    console.error(`💥 [Worker] Job ${job?.id} thất bại: ${err.message}`);
  });

  workerInstance.on('error', (err) => {
    console.error(`⚠️ [Worker] Worker error: ${err.message}`);
  });
}

// ── Graceful Shutdown Handler ────────────────────────────────────────────────
async function handleShutdown(signal) {
  console.log(`🛑 [Worker] Nhận tín hiệu ${signal}, đang tiến hành đóng an toàn...`);
  if (workerInstance) {
    try {
      await workerInstance.close();
      console.log('✅ [Worker] BullMQ Worker đã dừng an toàn');
    } catch (err) {
      console.error('❌ [Worker] Lỗi khi đóng Worker:', err.message);
    }
  }

  await closeRedisConnection();
  await closeConnections();
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT',  () => handleShutdown('SIGINT'));

if (require.main === module) {
  startWorker().catch((err) => {
    console.error('❌ [Worker] Lỗi khởi động worker process:', err);
    process.exit(1);
  });
}

module.exports = {
  startWorker,
};
