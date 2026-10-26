# ARCHITECTURE BLUEPRINT: CURRENT VS. TARGET
**Document ID:** `ARCH-CURRENT-TARGET-2026-10-23`  
**Classification:** Baseline & Target Blueprint  
**Status:** Architecture Specification

---

## 1. Current Architecture (As-Is at Commit `d1e5e30d`)

The current architecture is a single monolithic Express server hosting API endpoints, static file serving, in-memory job queues, and heavy binary rendering processes inside one shared process space:

```
[ CLIENT TIERS ]
  ├── Web Browser (React 18 SPA on Vercel)
  ├── PWA (Vite PWA, Workbox caching /api/* [S-17])
  ├── Desktop (Electron wrapper in electron/)
  ├── Mobile (Capacitor wrapper in client/)
  └── Chrome Extension (chrome-extension/)
         │
         │  HTTPS / HTTP Requests (Synchronous) [S-09, Timeout Risk]
         ▼
[ RENDER WEB SERVICE (Single Docker Container) ]
  ├── Express 4.21 Monolith (server/index.js)
  │     ├── Static Directory Serving (/uploads, /outputs) [S-01: PUBLIC LEAK]
  │     ├── Auth Routes (Telegram auth bypass without token) [S-02: AUTH BYPASS]
  │     ├── Memory Auth Fallback (Offline DB gives 'pro') [S-03: PRIVILEGE LEAK]
  │     ├── Route-level validation before Multer [S-05: VALIDATION BYPASS]
  │     ├── Heavy In-Memory Queues (p-queue per request) [S-10: TRANSIENT QUEUE]
  │     └── Direct filesystem access by raw filename/path [S-08: PATH CONFUSION]
  │
  ├── Heavy Binary Processes (Executed synchronously via child_process)
  │     ├── LibreOffice (Headless Word/Excel/PowerPoint) [~200MB RAM]
  │     ├── Puppeteer (--no-sandbox, user HTML execution) [S-06: SSRF RISK]
  │     ├── Ghostscript & Poppler (pdftoppm, pdftotext)
  │     ├── Tesseract OCR (vie + eng)
  │     └── FFmpeg (MISSING in Dockerfile [S-13]; local only)
  │
  ├── Local Ephemeral Storage (/uploads, /outputs)
  │     └── Cron job every 30m purges files > 1h
  │
  ├── WebSockets (Port 3002)
  │     ├── Socket.IO (Public join-job without ownership) [S-07: ACL LEAK]
  │     └── y-websocket (/collab without authentication) [S-07: NO AUTH]
  │
  └── Persistence & Cloud Integrations
        ├── MongoDB (Atlas Multi-Cluster / Unified DB)
        │     └── FileRecord TTL index expires doc without deleting R2 [S-12: ORPHAN OBJECTS]
        ├── Cloudflare R2 (Synchronous readFileSync upload) [S-11: RAM SPIKE]
        ├── Stripe Webhook (UNVERIFIED production readiness)
        └── AI API Cascade (Gemini, Groq, Cerebras, OpenRouter, Mistral)
```

### Critical Bottlenecks of Current Architecture
1. **Coupled Compute & HTTP:** Heavy video or 50-page OCR processing blocks the Express event loop and exceeds Render's 100s proxy timeout, producing `Network Error` on the client.
2. **Memory Exhaustion (OOM):** On Render's 512MB RAM tier, simultaneous execution of Puppeteer, LibreOffice, and large file buffer reading (`readFileSync`) triggers the OS OOM Killer (`SIGKILL`).
3. **Public Storage Exposure:** Sensitive customer documents are served directly as static assets without signed authorization.

---

## 2. Target Architecture (Modular Monolith + Durable Workers)

The target architecture decouples client-facing HTTP requests from compute-heavy jobs, strictly isolates untrusted file processing, and stores all documents in private object storage:

```
[ CLIENT TIERS ]
  ├── Web (Vercel Global Edge CDN + Pre-rendered Landing Pages)
  ├── PWA / Microsoft Store (MSIX Package)
  └── Native Mobile (Capacitor Touch-optimized, store compliant)
         │
         │  HTTPS (Stateless API Contracts, Pre-signed Uploads)
         ▼
[ RENDER API GATEWAY SERVICE ]
  ├── Express Modular Monolith
  │     ├── Strict Tenant / Ownership Validation (Opaque fileId)
  │     ├── Authentication (Fail-closed Telegram, Secure HttpOnly Session)
  │     ├── Server-side Quota & Entitlement Ledger
  │     ├── Signed URL Generator (Private Cloudflare R2)
  │     └── Job Dispatcher (BullMQ Producer)
  │
  ├── MongoDB
  │     ├── Users & Credentials (Auth DB)
  │     ├── Durable Jobs Ledger & File Records (Data DB)
  │     └── Usage & Quota Ledger
  │
  └── Redis / Valkey Service
        └── BullMQ Durable Queue (Persistent jobs, backoff retry, rate-limited)
               │
               ▼  (Job Consumption & Event Streaming)
[ ISOLATED RENDER BACKGROUND WORKERS ]
  ├── Worker Pool A: PDF & Document Processing
  │     ├── pdf-lib, qpdf, Poppler (isolated, non-root)
  │     └── Secure Redaction Sanitizer (Permanent stream removal)
  │
  ├── Worker Pool B: Media & Video Processing
  │     ├── FFmpeg / FFprobe (pinned, hardware-limited, memory capped)
  │     └── Edge-TTS batch audio synthesizer
  │
  ├── Worker Pool C: Sandboxed Renderers
  │     ├── Chromium (strictly isolated network, memory budget, no-network)
  │     └── LibreOffice (headless converter pool)
  │
  └── Private Cloudflare R2 Bucket
        ├── Quarantine Zone (Incoming client uploads)
        ├── Verified Clean Objects (Encrypted at rest)
        └── Short-lived Pre-signed Download URLs (TTL <= 15 minutes, no-store)
```

---

## 3. Side-by-Side Comparison

| Architectural Dimension | Current Architecture (`d1e5e30d`) | Target Architecture (Production) |
| :--- | :--- | :--- |
| **Request Model** | Synchronous HTTP POST (prone to 100s timeout) | Asynchronous Job Intent $\rightarrow$ BullMQ $\rightarrow$ Polling / SSE |
| **Job Durability** | In-memory `p-queue` (lost on restart) | Redis-backed BullMQ (durable, idempotent, retriable) |
| **Object Storage** | Local static folders (`/uploads`, `/outputs`) | Private Cloudflare R2 bucket with pre-signed URLs |
| **File Identification** | Client-supplied file paths and names | Opaque server-minted `fileId` with tenant ACL |
| **Redaction Security** | Visual overlay (fallback leaves raw text) | Complete object/stream removal + rasterized verify |
| **Browser Execution** | Unrestricted `--no-sandbox` Puppeteer | Network-denied sandbox or disabled by feature flag |
| **WebSocket Security** | Public room join, zero-auth Yjs collab | JWT handshake required, room owner permission gate |
| **Session Model** | Mixed cookies, URL query tokens, localStorage | Strict HttpOnly SameSite cookies + CSRF protection |
| **Readiness Check** | `/api/health` reports `ok` when DB is down | Semantic `/live`, `/ready`, `/capabilities` endpoints |
| **Memory Management** | `fs.readFileSync` for entire files | Streaming pipeline, backpressure, 50MB file limits |
| **Frontend Delivery** | Pure SPA (Vercel CDN, empty root div) | Pre-rendered static landing pages + SPA workspace |
