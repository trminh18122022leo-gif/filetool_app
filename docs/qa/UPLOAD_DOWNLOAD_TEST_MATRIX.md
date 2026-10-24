# FileTools Pro — Upload & Download Test Matrix & QA Evidence
**Version:** 1.0.0 (Production Verification)  
**Date:** 23/10/2026  
**Test Suite:** `tests/security/file-storage.test.js`  
**Execution Environment:** Node.js v24.18.0 (Windows x64)  
**Status:** **100% PASS (15/15 Tests Passed, 0 Failures)**

---

## 1. Negative & Boundary Test Matrix

| Test ID | Scenario Description | Input Fixture / Injection Vector | Expected Defense & Status Code | Verified Result |
| :---: | :--- | :--- | :--- | :---: |
| **TEST-01** | **Wrong Owner:** User B requests User A's cloud file | `GET /api/storage/download/:id` with User B session | `404 Not Found` (Zero cross-user data leakage) | **PASS ✅** |
| **TEST-02** | **Guessed Filename:** Unauthenticated crawl of output | Direct `GET /api/download/<filename>` without token | `403 FORBIDDEN_FILE_ACCESS` | **PASS ✅** |
| **TEST-03** | **Expired Signed Token:** Download token with past timestamp | Query `?token=<expired_jwt>` ($t < \text{now}$) | `403 INVALID_DOWNLOAD_TOKEN` | **PASS ✅** |
| **TEST-04** | **Aborted Upload Cleanup:** Interrupted upload leaving partial `.tmp` | Synthetic partial file in `uploads/` | `cleanDirectory` unlinks orphan files | **PASS ✅** |
| **TEST-05** | **Oversized File:** File exceeding max allowable size | File payload $> 500\text{MB}$ | Multer rejects with `LIMIT_FILE_SIZE` | **PASS ✅** |
| **TEST-06A**| **Spoofed MIME (Executable):** File named `.pdf` with `MZ` binary | Windows PE Executable ($0x4D, 0x5A$) renamed `.pdf` | `400 INVALID_FILE_CONTENT`, file unlinked | **PASS ✅** |
| **TEST-06B**| **Spoofed MIME (Shell Script):** File named `.jpg` with `#!/bin/bash` | Shell script renamed `.jpg` | `400 INVALID_FILE_CONTENT`, file unlinked | **PASS ✅** |
| **TEST-07A**| **Malformed PDF:** Truncated PDF without `%PDF-` header | Corrupted byte stream $< 32$ bytes | `400 INVALID_FILE_CONTENT`, file unlinked | **PASS ✅** |
| **TEST-07B**| **Weaponized PDF:** PDF containing embedded `/Launch` cmd action | `%PDF-1.7` stream containing `/Launch (cmd.exe)` | `400 INVALID_FILE_CONTENT`, file unlinked | **PASS ✅** |
| **TEST-08A**| **Path Traversal (PDF):** `tempFilePath` injection in `/redact` | Body `tempFilePath: '../../../../Windows/win.ini'` | `400 PATH_TRAVERSAL_DETECTED` | **PASS ✅** |
| **TEST-08B**| **Path Traversal (Video):** System path injection in `/render` | Body `videoFilename: '..\\..\\Windows\\cmd.exe'` | `400 PATH_TRAVERSAL_DETECTED` | **PASS ✅** |
| **TEST-09** | **Storage Outage:** S3/R2 client fails or endpoint unconfigured | `R2_ENDPOINT` unset or unreachable | `uploadToCloud` fails closed with explicit error | **PASS ✅** |
| **TEST-10** | **Worker Crash Cleanup:** Orphan files left by crashed worker | Old temporary file in `uploads/` ($mtime > \text{threshold}$) | `cleanupTempFiles` deletes orphaned file | **PASS ✅** |
| **TEST-11** | **Idempotent Manual Deletion:** User deletes file twice | Successive calls to `deleteFromCloud(id, user)` | Idempotent success; quota decrements exactly once | **PASS ✅** |
| **TEST-12** | **Retention Reconciliation:** Expired cloud objects ($t \le \text{now}$) | Records with `expiresAt <= now` | `reconcileExpiredCloudFiles` deletes R2 object & updates status | **PASS ✅** |

---

## 2. Test Execution Log Evidence

```text
> filetools-app@1.0.0 test:security
> node --test tests/security/auth-access.test.js tests/security/file-storage.test.js

⚠️ [AuthDB] Chưa cấu hình AUTH_DB_URI hoặc MONGODB_AUTH_URI
⚠️ [DataDB] Chưa cấu hình DATA_DB_URI hoặc MONGODB_DATA_URI
✅ Đã đóng an toàn tất cả DB connections
▶ 🛡️ P0 Security & Access Control Verification Suite
  ✔ 1. Auth DB Outage & Fail-Closed Semantics (2.90ms)
  ✔ 2. JWT Expiration & Invalid Token Handling (1.18ms)
  ✔ 3. Telegram Callback Cryptographic Verification (3553.36ms)
  ✔ 4. Tenant Boundary & File Download/View Access Control (2.01ms)
  ✔ 5. WebSocket Job Room Authorization (join-job) (0.56ms)
  ✔ 6. Yjs Collab Room Tenant Boundary & Cross-User Isolation (0.17ms)
  ✔ 7. Global State Mutation Protection (Speech Dictionary) (0.27ms)
  ✔ 8. Open Redirect & Host Header Poisoning Defense (0.15ms)
✔ 🛡️ P0 Security & Access Control Verification Suite (3561.45ms)
⚠️ [AuthDB] Chưa cấu hình AUTH_DB_URI hoặc MONGODB_AUTH_URI
⚠️ [DataDB] Chưa cấu hình DATA_DB_URI hoặc MONGODB_DATA_URI
✅ Đã đóng an toàn tất cả DB connections
▶ 📦 File Storage Security, Lifecycle & Negative Verification Suite
  ▶ 1. Wrong Owner / Cross-Tenant Storage Isolation
    ✔ User B cannot access or download User A file in storage routes (113.84ms)
  ✔ 1. Wrong Owner / Cross-Tenant Storage Isolation (114.31ms)
  ▶ 2. Guessed Filename Attack Prevention
    ✔ Attacker guessing valid output filename is blocked with 403 FORBIDDEN_FILE_ACCESS (0.34ms)
  ✔ 2. Guessed Filename Attack Prevention (0.48ms)
  ▶ 3. Expired Signed URL / Token Invalidation
    ✔ Expired signed download token is rejected with 403 INVALID_DOWNLOAD_TOKEN (3.09ms)
  ✔ 3. Expired Signed URL / Token Invalidation (3.23ms)
  ▶ 4. Aborted Upload Cleanup & Quarantine Hygiene
    ✔ Orphaned partial upload file is safely unlinked by cleanDirectory (2.30ms)
  ✔ 4. Aborted Upload Cleanup & Quarantine Hygiene (2.51ms)
  ▶ 5. Oversized File Guard
    ✔ Rejects file exceeding max file size limit during upload filtering (21.08ms)
  ✔ 5. Oversized File Guard (21.25ms)
  ▶ 6. Spoofed Extension & MIME Binary Validation
    ✔ Rejects file claiming to be .pdf but containing Windows Executable (MZ) binary (2.67ms)
    ✔ Rejects file claiming to be .jpg but containing shell script (2.08ms)
  ✔ 6. Spoofed Extension & MIME Binary Validation (4.92ms)
  ▶ 7. Malformed PDF & Malicious PDF Action Guard
    ✔ Rejects corrupt/truncated PDF missing valid %PDF- header (2.00ms)
    ✔ Rejects PDF containing dangerous /Launch executable command action (2.04ms)
  ✔ 7. Malformed PDF & Malicious PDF Action Guard (4.19ms)
  ▶ 8. Client-Controlled Path Traversal Defense (Finding S-08)
    ✔ PDF redact endpoint rejects directory traversal in tempFilePath (531.68ms)
    ✔ Video render endpoint rejects absolute system path in videoFilename (54.51ms)
  ✔ 8. Client-Controlled Path Traversal Defense (Finding S-08) (586.37ms)
  ▶ 9. Storage Outage & Fail-Closed Policy
    ✔ uploadToCloud fails closed when R2 storage client is not configured (0.67ms)
  ✔ 9. Storage Outage & Fail-Closed Policy (0.75ms)
  ▶ 10. Worker Crash Orphan Input Cleanup
    ✔ cleanupTempFiles cleans orphan files left by interrupted workers (2.28ms)
  ✔ 10. Worker Crash Orphan Input Cleanup (2.39ms)
  ▶ 11. Manual Deletion Idempotency
    ✔ Calling deleteFromCloud multiple times is idempotent and safe (0.68ms)
  ✔ 11. Manual Deletion Idempotency (0.78ms)
  ▶ 12. Retention Expiry Reconciliation
    ✔ reconcileExpiredCloudFiles identifies and cleans up expired cloud records (0.36ms)
  ✔ 12. Retention Expiry Reconciliation (0.48ms)
✔ 📦 File Storage Security, Lifecycle & Negative Verification Suite (744.63ms)
ℹ tests 36
ℹ suites 22
ℹ pass 36
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4138.92ms
```
