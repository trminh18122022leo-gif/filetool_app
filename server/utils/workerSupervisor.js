'use strict';

/**
 * server/utils/workerSupervisor.js
 * In-container process supervisor for colocated Background Worker execution.
 * 
 * Purpose:
 * When running in low-cost single-container environments (e.g. Render Free/Starter Web Service),
 * Dockerfile's CMD only starts `server/index.js`. This supervisor launches and monitors
 * `server/worker.js` as a child process with crash recovery, backoff, and graceful signal forwarding.
 */

const { fork } = require('child_process');
const path = require('path');

let workerChild = null;
let isShuttingDown = false;
let restartCount = 0;
let lastRestartTime = 0;
const MAX_RESTARTS_PER_WINDOW = 5;
const WINDOW_MS = 60000; // 1 minute

function getWorkerPath() {
  return path.resolve(__dirname, '../worker.js');
}

function startWorkerSupervisor(options = {}) {
  if (workerChild && !workerChild.killed) {
    return workerChild;
  }

  isShuttingDown = false;
  const workerFile = getWorkerPath();

  console.log('🚀 [WorkerSupervisor] Khởi chạy tiến trình nền Worker colocated...');

  try {
    workerChild = fork(workerFile, [], {
      env: {
        ...process.env,
        SERVICE_ROLE: 'worker',
      },
      stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
    });

    const childPid = workerChild.pid;
    console.log(`✅ [WorkerSupervisor] Worker đã khởi chạy thành công (PID: ${childPid})`);

    workerChild.on('exit', (code, signal) => {
      console.warn(`⚠️ [WorkerSupervisor] Worker (PID: ${childPid}) đã thoát với code: ${code}, signal: ${signal}`);
      workerChild = null;

      if (isShuttingDown) {
        return;
      }

      const now = Date.now();
      if (now - lastRestartTime > WINDOW_MS) {
        restartCount = 0;
      }
      lastRestartTime = now;
      restartCount += 1;

      if (restartCount > MAX_RESTARTS_PER_WINDOW) {
        console.error(`💥 [WorkerSupervisor] Worker đã crash ${restartCount} lần trong 60s. Dừng tự động restart để bảo vệ tài nguyên.`);
        return;
      }

      const backoffMs = Math.min(1000 * Math.pow(2, restartCount - 1), 10000);
      console.log(`🔄 [WorkerSupervisor] Đang khởi động lại Worker sau ${backoffMs}ms (Lần thử ${restartCount}/${MAX_RESTARTS_PER_WINDOW})...`);
      setTimeout(() => {
        if (!isShuttingDown) {
          startWorkerSupervisor(options);
        }
      }, backoffMs);
    });

    workerChild.on('error', (err) => {
      console.error(`❌ [WorkerSupervisor] Lỗi tiến trình Worker: ${err.message}`);
    });

    return workerChild;
  } catch (err) {
    console.error(`❌ [WorkerSupervisor] Không thể spawn Worker process: ${err.message}`);
    return null;
  }
}

async function stopWorkerSupervisor(timeoutMs = 5000) {
  isShuttingDown = true;
  if (!workerChild || workerChild.killed) {
    workerChild = null;
    return;
  }

  const child = workerChild;
  workerChild = null;

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('⚠️ [WorkerSupervisor] Worker không dừng kịp thời, gửi SIGKILL');
        try { child.kill('SIGKILL'); } catch (_) {}
        resolve();
      }
    }, timeoutMs);

    child.on('exit', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        console.log('✅ [WorkerSupervisor] Worker đã dừng an toàn');
        resolve();
      }
    });

    try {
      child.kill('SIGTERM');
    } catch (_) {
      clearTimeout(timer);
      resolve();
    }
  });
}

function isWorkerRunning() {
  return Boolean(workerChild && !workerChild.killed);
}

function getWorkerPid() {
  return workerChild ? workerChild.pid : null;
}

function resetSupervisorForTesting() {
  isShuttingDown = false;
  restartCount = 0;
  lastRestartTime = 0;
}

module.exports = {
  startWorkerSupervisor,
  stopWorkerSupervisor,
  isWorkerRunning,
  getWorkerPid,
  resetSupervisorForTesting,
};
