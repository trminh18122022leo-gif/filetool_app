# FileTools Pro — File & Storage Threat Model
**Version:** 1.0.0 (Production Security Architecture)  
**Date:** 23/10/2026  
**Scope:** File Ingestion, Quarantine Validation, S3/R2 Cloud Storage, Temporary Local Files, and Download Access  
**Target Gate:** Gate G1.2 & Storage Security Sign-Off

---

## 1. System Context & Trust Boundaries

FileTools Pro processes diverse multi-media files (PDF, Office, Images, Audio, Video, Archives). File processing presents a high-risk attack surface because untrusted user input is parsed by complex native binaries (Ghostscript, LibreOffice, Tesseract, ffmpeg) and stored in multi-tenant environments.

```mermaid
flowchart TD
    subgraph Untrusted External Zone
        User[Client Browser / Native App]
        Attacker[Adversary / Scanners]
    end

    subgraph Demilitarized Buffer (DMZ / Memory)
        RateLimiter[Rate Limiter & Speed Limiter]
        MulterStream[Multer Disk Stream to uploads/]
    end

    subgraph Quarantine Security Gate
        Quarantine[validateUploadedFiles]
        MagicBytes[Magic Bytes Binary Sniffing]
        Complexity[Bomb & PDF Complexity Guard]
        Symlink[Symlink & Traversal Guard]
    end

    subgraph Processing & Storage Zone (High Trust)
        RouteHandler[Route Controller]
        WorkerMonolith[Worker / Processor]
        LocalOutputs[Local outputs/ - No Static Serving]
        R2Adapter[S3/R2 Streaming Adapter]
        R2Bucket[(Cloudflare R2 Private Bucket)]
        DB[(MongoDB FileRecord ACL)]
    end

    User -->|Upload Request| RateLimiter
    Attacker -->|Spoofed / Malicious File| RateLimiter
    RateLimiter --> MulterStream
    MulterStream -->|Quarantined File| Quarantine
    Quarantine --> MagicBytes & Complexity & Symlink
    
    MagicBytes -->|Pass| RouteHandler
    MagicBytes -->|Fail| UnlinkDrop[Unlink & Emit AuditLog & 400 Error]
    Complexity -->|Fail| UnlinkDrop
    Symlink -->|Fail| UnlinkDrop

    RouteHandler --> WorkerMonolith
    WorkerMonolith --> LocalOutputs
    LocalOutputs --> R2Adapter
    R2Adapter -->|Streaming Transfer| R2Bucket
    R2Adapter -->|Metadata & TTL| DB
```

---

## 2. Threat Analysis & Defensive Matrix

| Threat ID | Threat Vector & Scenario | Impact | System Defensive Countermeasure | Verified Status |
| :---: | :--- | :--- | :--- | :---: |
| **TH-01** | **Direct Public File Extraction:** Attacker browses or crawls `/outputs/<filename>` or `/uploads/<filename>`. | Data Breach / Tenant Leakage | Static directories `app.use('/outputs', ...)` and `app.use('/uploads', ...)` removed. All downloads require `/api/download/:filename` with Signed Download Token or active session ACL. | **TESTED (PASS)** |
| **TH-02** | **Guessed / Enumerated Filenames:** Attacker attempts to download private files by guessing output filenames. | Unauthorized File Access | `validateDownloadAccess` strictly requires an HMAC-signed JWT download token or verified owner session matching `FileRecord`. Unauthenticated guessed requests return `403 FORBIDDEN_FILE_ACCESS`. | **TESTED (PASS)** |
| **TH-03** | **Cross-Tenant Download Token Theft:** User B obtains User A's signed download URL and submits it from User B's authenticated session. | Cross-Tenant Breach | Download tokens embed the creator's `userId`. If `req.user` is present, `validateDownloadAccess` enforces `String(req.user._id) === decoded.userId`. Mismatches return `403 CROSS_USER_FORBIDDEN`. | **TESTED (PASS)** |
| **TH-04** | **Directory Traversal (S-08):** Attacker injects `../../etc/shadow` or `C:\Windows\System32\` via filename query or body params (`tempFilePath`, `videoFilename`). | Local File Inclusion / System Tampering | `path.basename()` normalization combined with `targetPath.startsWith(baseDir)` validation. Any occurrence of `..`, `/`, `\`, or absolute path prefixes is rejected with `400 PATH_TRAVERSAL_DETECTED`. | **TESTED (PASS)** |
| **TH-05** | **Symlink Hijacking:** Attacker uploads a symbolic link pointing to sensitive server configuration (`.env` or `/etc/passwd`). | Credential Theft | `fs.lstatSync(file.path).isSymbolicLink()` check in quarantine. Any symlink is immediately unlinked and rejected with `400 INVALID_SYMLINK`. | **TESTED (PASS)** |
| **TH-06** | **MIME / Extension Spoofing:** Attacker names an executable `invoice.pdf` or script `avatar.jpg`. | Remote Code Execution / Stored XSS | `checkMagicBytes` verifies the first 1KB of the binary. Windows PE (`MZ`), Linux ELF (`\x7fELF`), and Java (`CAFEBABE`) binaries are blocked regardless of extension. Mismatched binaries return `400 INVALID_FILE_CONTENT`. | **TESTED (PASS)** |
| **TH-07** | **Malformed PDF / Weaponized Actions:** PDF containing embedded `/Launch` executable commands or corrupted structure. | Parser Crash / Arbitrary Command Exec | PDF headers must start with `%PDF-` and be $\ge 32$ bytes. Header inspection blocks `/Launch` and suspicious embedded executable streams. | **TESTED (PASS)** |
| **TH-08** | **ZIP Bomb / Decompression Explosion:** Malicious archive with 1000:1 compression ratio designed to consume server disk space. | Denial of Service (Disk Exhaustion) | Multer size limits + archive complexity verification cap decompressed limits to 500MB and reject suspicious ratios. | **TESTED (PASS)** |
| **TH-09** | **Memory Exhaustion (OOM DOS):** Upload of large files triggering `fs.readFileSync()` into Node.js heap. | Server Crash (Out of Memory) | Replaced `fs.readFileSync()` with Node.js stream (`fs.createReadStream()`) piped directly to `@aws-sdk/client-s3` with `ContentLength` and SHA-256 stream hashing. | **TESTED (PASS)** |
| **TH-10** | **SSRF via Cloud Storage Endpoints:** Malicious or misconfigured `R2_ENDPOINT` pointing to internal AWS metadata (`169.254.169.254`) or localhost. | Cloud Credential Theft | `isValidStorageEndpoint()` mandates HTTPS protocol and blocks `localhost`, `127.0.0.1`, RFC1918 subnets (`10.x`, `172.16-31.x`, `192.168.x`), and metadata IP `169.254.169.254`. | **TESTED (PASS)** |
| **TH-11** | **R2 Public Bucket Exposure:** Objects uploaded with public ACL or public bucket read policy. | Mass Data Leakage | Cloudflare R2 bucket is private by default. Access is granted exclusively through short-lived (1h) pre-signed URLs with `ResponseCacheControl: 'private, no-cache, no-store'`. | **TESTED (PASS)** |
| **TH-12** | **Storage Cost Runaway / Orphan Leakage:** Interrupted uploads, failed multipart sessions, or expired records remaining in R2. | Financial Runaway / Disk Saturation | Scheduled `reconcileStorage()` runs every 30 minutes, deleting local files older than 1h and invoking R2 `DeleteObjectCommand` for all expired `FileRecord`s idempotently. | **TESTED (PASS)** |

---

## 3. Post-Multer Quarantine Validation Pipeline (Resolving Finding S-05)

### Vulnerability Analysis
Prior to this remediation, `validateUploadedFiles` was registered in `server/index.js` at the router mount level before route execution:
```javascript
// VULNERABLE ORDERING:
app.use('/api/pdf', toolRateLimit, validateUploadedFiles, require('./routes/pdf.routes'));
```
Because Multer (`upload.single('file')`) was defined inside the individual route handlers within `routes/pdf.routes.js`, `req.file` and `req.files` did not exist when `validateUploadedFiles` ran at the mount level. It checked an empty array and immediately called `next()`, completely bypassing validation!

### Remediated Architecture
Validation is now wrapped directly around Multer in [`server/middleware/upload.js`](file:///C:/Users/Admin/test_app/filetools-app/server/middleware/upload.js):
```javascript
function wrapWithValidation(handler) {
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) return next(err);
      validateUploadedFiles(req, res, next);
    });
  };
}
```
**Guarantee:** In every tool route across the application, files are guaranteed to be inspected and sanitized in quarantine immediately after Multer finishes writing to disk, and before any route controller or business logic can access them.

---

## 4. Opaque File Identifiers & Client Boundary (Resolving Finding S-08)

### Vulnerability Analysis
Several multi-step tool routes (`pdf.routes.js`, `videotranslate.routes.js`, `creative.routes.js`) previously returned the internal server path `tempFilePath: req.file.path` (e.g. `C:\Users\Admin\test_app\uploads\uuid.pdf`) and subsequently accepted `req.body.tempFilePath` or `req.body.videoFilename` from the client. An attacker could tamper with these parameters to reference files belonging to other users or system files.

### Remediated Architecture
- **Server Internal:** Stores files under isolated, server-generated UUID names in `uploads/`.
- **Client Facing:** The client receives only an opaque `fileId` (and a signed view token URL).
- **Subsequent Steps:** When the client requests follow-up actions (such as PII redaction or video rendering), the server accepts only `fileId`, enforces strict basename sanitization, verifies path boundaries within `uploads/`, and matches owner session authorization.
