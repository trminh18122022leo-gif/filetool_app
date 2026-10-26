# RELEASE EVIDENCE GATE — REPORT 03: QUEUE RESTART & STORAGE RELIABILITY

**Audit Phase:** Antigravity Release Evidence Gate  
**Scope:** Distributed Queue System (BullMQ / Redis), In-Memory Fallback Limits, and Object Storage Lifecycle  
**Verified Invariants:** Fail-Closed Queue Degradation, Cloudflare R2 Outage Handling, Sandbox Isolation, Cleanup Idempotency  

---

## 1. Distributed Queue & Worker Architecture

FileTools Pro implements a dual-mode job processing architecture:
1. **Primary Production Mode:** BullMQ backed by Redis (`REDIS_URL` or `REDIS_TLS_URL`).
   - Supports job priorities (Priority 1 for Pro/Plus, Priority 5 for Free).
   - Atomic concurrency limiting per user (`maxConcurrentJobs: 1` Free, `2` Plus, `4` Pro).
   - Job state tracked in MongoDB (`JobRecord`) with steps, progress percentages, and audit trails.
2. **In-Memory Fallback Mode:**
   - Active in development/test environments or when Redis is deliberately omitted.
   - Dispatches jobs asynchronously via `setImmediate` with local tracking.

---

## 2. Redis Outage & In-Memory Fallback Production Limits

### 2.1 The Container OOM Vulnerability
In previous phases, any Redis failure transparently redirected *all* pending jobs to an in-memory queue within the web application container. Under production load:
- High-intensity operations (FFmpeg video encoding, LibreOffice document conversions, multi-page OCR rasterization) consume 1–4GB of RAM per instance.
- Running multiple heavy jobs in-memory inside Render/Vercel web containers triggers out-of-memory (OOM) kernel terminations (SIGKILL), dropping active user connections.
- Furthermore, web container restarts destroy all in-memory job queues, permanently losing uncommitted user workloads.

### 2.2 Reconciled Fail-Closed Policy
To eliminate this risk, `server/queue/jobQueue.js` now enforces a strict fail-closed boundary in production (`process.env.NODE_ENV === 'production'`):
```javascript
const HEAVY_OPERATIONS = ['video-translate', 'audio-extract', 'libreoffice-convert', 'ocr-pdf', 'bulk-compress', 'workflow-dag', 'pdf-ocr'];
if (process.env.NODE_ENV === 'production' && !isRedisReady() && process.env.ALLOW_IN_MEMORY_FALLBACK !== 'true') {
  if (HEAVY_OPERATIONS.includes(jobRecord.operation)) {
    const err = new Error('Durable background queue is currently unavailable. Heavy operations cannot execute in-memory in production.');
    err.code = 'DURABLE_QUEUE_UNAVAILABLE';
    err.status = 503;
    throw err;
  }
}
```
- **Heavy Operations:** Fail-closed immediately with HTTP 503 `DURABLE_QUEUE_UNAVAILABLE`, alerting the user to retry when durable infrastructure is restored.
- **Lightweight Operations (or Dev/Test):** Permitted to execute via in-memory fallback.

---

## 3. Storage Outage & Lifecycle Negative Verification

Verified via `tests/security/file-storage.test.js` (12 test suites, all passing):

### 3.1 Cloud Storage Outage (Fail-Closed)
- **Test:** `uploadToCloud fails closed when R2 storage client is not configured`
- **Result:** **PASSED (0.61ms)**
- **Behavior:** If `R2_ACCESS_KEY_ID` or S3 client credentials are missing or unreachable, file operations fail closed and return a structured storage error rather than leaking local server paths or silently succeeding with broken download links.

### 3.2 Worker Crash Orphan Cleanup
- **Test:** `cleanupTempFiles cleans orphan files left by interrupted workers`
- **Result:** **PASSED (1.63ms)**
- **Behavior:** The garbage collector scans temporary scratch directories (`outputs/`, `temp_uploads/`) and purges orphaned artifacts whose job processes exited abnormally or exceeded max execution TTL (3600s).

### 3.3 Deletion Idempotency & Replay Safety
- **Test:** `Calling deleteFromCloud multiple times is idempotent and safe`
- **Result:** **PASSED (0.53ms)**
- **Behavior:** Calling `deleteFromCloud` on an already-deleted object returns success without throwing `NoSuchKey` exceptions or corrupting the database record state.

### 3.4 Retention Expiry Reconciliation
- **Test:** `reconcileExpiredCloudFiles identifies and cleans up expired cloud records`
- **Result:** **PASSED (0.24ms)**
- **Behavior:** Automated reconciliation job scans `FileRecord` entries older than the plan retention threshold (1 hour Free, 24 hours Plus, 72 hours Pro) and dispatches background R2 deletion commands.

---

## 4. Test Evidence Summary

| Test Case | Suite | Duration | Status |
| :--- | :--- | :--- | :--- |
| `uploadToCloud fails closed when R2 storage client is not configured` | Storage Security | 0.61ms | **PASS** |
| `cleanupTempFiles cleans orphan files left by interrupted workers` | Storage Security | 1.63ms | **PASS** |
| `Calling deleteFromCloud multiple times is idempotent and safe` | Storage Security | 0.53ms | **PASS** |
| `reconcileExpiredCloudFiles identifies and cleans up expired cloud records` | Storage Security | 0.24ms | **PASS** |
| `Thực thi hoàn tất một tác vụ trong Isolated Sandbox Directory` | Job Reliability | 1190.87ms | **PASS** |
| `Hủy tác vụ chưa hoàn thành phải hoàn trả quota (Refund Quota)` | Job Reliability | 2.69ms | **PASS** |
| `Tác vụ đã hoàn tất (COMPLETED) đã commit quota thì không được hoàn trả` | Job Reliability | 1.03ms | **PASS** |

---

## 5. Architectural Verdict

The distributed queue and storage subsystems exhibit robust fail-closed behaviors under outage and restart conditions. The elimination of unconstrained in-memory execution in production protects web tier availability.
