# FileTools Pro — Production On-Call & Incident Runbook

**Document Version:** 1.0.0  
**Maintained By:** Production SRE & Systems Reliability Lead  
**Last Updated:** 2026-10-24  
**Primary Alert Channels:** Render Dashboard, Vercel Alerts, Sentry (if enabled), Server Logs

---

## 1. Incident Severity Definitions & Escalation SLA

| Severity | Definition | Examples | Response SLA | Resolution SLA |
|:---:|:---|:---|:---:|:---:|
| **P0 — Critical** | Complete service outage or active data compromise affecting all users. | Web application down; database cluster offline; unauthenticated file download leak. | **$< 15\text{ minutes}$** | **$< 2\text{ hours}$** |
| **P1 — High** | Core processing functionality degraded; queue stalled; payment failure. | BullMQ worker crash loop; Redis memory full; LibreOffice conversion hanging. | **$< 30\text{ minutes}$** | **$< 4\text{ hours}$** |
| **P2 — Medium** | Non-critical feature degraded; single external provider error with fallback. | Gemini API rate limited (falling back to Groq); Monaco editor asset slow load. | **$< 2\text{ hours}$** | **$< 24\text{ hours}$** |
| **P3 — Low** | Cosmetic UI glitch; non-blocking telemetry warning. | Typo in error string; minor styling glitch under obscure viewport. | **$< 24\text{ hours}$** | **Next Sprint** |

---

## 2. Health & Observability Endpoints

| Endpoint | Purpose | Normal Response | Failure Response & Action |
|:---|:---|:---|:---|
| `GET /api/live` | Process liveness check | `HTTP 200 {"status":"alive"}` | Process is hanging or unresponsive. Restart container. |
| `GET /api/ready` | Deep readiness check | `HTTP 200 {"status":"ready"}` | `HTTP 503 {"status":"degraded"}` indicates database or backing service failure. Check logs. |
| `GET /api/health` | General health | `HTTP 200 {"status":"ok"}` | `HTTP 503 {"status":"degraded"}` indicates DB disconnect. |
| `GET /api/capabilities` | Public feature catalog | `HTTP 200` with feature flags | Safe inspection of active features. |

---

## 3. Incident Playbooks

### Playbook 1: Render Worker Failure / Redis Connectivity Loss
**Symptoms:** Jobs remain in `QUEUED` status; polling does not transition to `PROCESSING`; `/api/ready` reports `"queueBackend":"in-memory-fallback"`.

**Troubleshooting Steps:**
1. Check Redis instance status in Render dashboard or Redis provider console.
2. Verify environment variable `REDIS_URL` or `VALKEY_URL`.
3. Check worker process logs on Render:
   ```bash
   # Filter logs for worker errors
   grep "[Worker]" logs/server.log
   ```
4. If Redis is unreachable, FileTools Pro automatically switches to the in-memory queue fallback (`server/queue/jobQueue.js`).
5. To restart the Render background worker service:
   - Navigate to **Render Dashboard** $\rightarrow$ **FileTools Worker** $\rightarrow$ **Manual Deploy** $\rightarrow$ **Clear build cache & deploy**.

---

### Playbook 2: MongoDB Cluster Degraded / Disconnected
**Symptoms:** Users receive `HTTP 503 AUTH_DB_UNAVAILABLE`; `/api/ready` reports `"authDatabase":"disconnected"`.

**Troubleshooting Steps:**
1. Inspect MongoDB Atlas console for cluster health, CPU spikes, or connection limit saturation.
2. Verify MongoDB IP Access List allows Render backend IP addresses (`0.0.0.0/0` with strong password, or Render fixed egress IP).
3. If using Dual-Cluster mode (`MONGODB_AUTH_URI` and `MONGODB_DATA_URI`), determine which cluster is degraded.
4. Verify database credentials in environment variables (`MONGODB_URI`).
5. The application will automatically attempt reconnection via Mongoose connection backoff.

---

### Playbook 3: Cloudflare R2 Upload / Storage Outage
**Symptoms:** Job completes locally, but cloud upload fails with `R2_UPLOAD_FAILED` or falls back to disk.

**Troubleshooting Steps:**
1. Check Cloudflare Dashboard status for Cloudflare R2 service disruptions.
2. Verify R2 credentials in environment:
   - `R2_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
3. Note: The application operates in **fail-closed** mode for cloud storage. If R2 fails, output files are kept locally in `outputs/` temporarily and deleted after TTL.

---

### Playbook 4: AI Provider Outage / Circuit Breaker Tripped
**Symptoms:** AI requests fail with `CIRCUIT_BREAKER_OPEN`; error banner indicates temporary provider unavailability.

**Troubleshooting Steps:**
1. Inspect `server/services/aiProviderAdapter.js` logs:
   ```text
   ⚠️ [AI CircuitBreaker] gemini trip to OPEN until ...
   ```
2. The circuit breaker automatically opens after 3 consecutive failures and enters a 30-second cooldown.
3. The AI orchestrator will automatically cascade down the provider list:
   $\text{Gemini} \rightarrow \text{Cerebras} \rightarrow \text{Groq} \rightarrow \text{OpenRouter} \rightarrow \text{Mistral}$.
4. If all providers fail, check whether the user has enabled BYOK (Bring Your Own Key) in Settings.

---

### Playbook 5: Stripe Webhook Duplicate / Signature Mismatch
**Symptoms:** Webhook returns `HTTP 400 Webhook Error: Signature verification failed`.

**Troubleshooting Steps:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint signing secret in Stripe Dashboard (`whsec_...`).
2. Ensure raw request body is passed to Stripe SDK (do not parse JSON body prior to webhook signature verification).
3. Check `StripeEvent` collection in MongoDB for deduplicated events (`duplicate_event_ignored`).

---

### Playbook 6: Memory Spikes / Chromium Process Leaks
**Symptoms:** Server RAM approaches 512MB limit on Render; response times increase.

**Troubleshooting Steps:**
1. Inspect running Chromium child processes:
   ```bash
   ps aux | grep chromium
   ```
2. In `server/utils/browser.js`, Chromium pages have explicit timeouts ($30\text{s}$) and close in `finally` blocks.
3. If memory leaks occur, Render will automatically restart the web service container.
4. Temporary files are pruned every 15 minutes by `server/services/cleanup.service.js`.

---

## 4. Emergency Contacts & Escalation Roster

- **Lead Systems Engineer:** Primary On-Call
- **Security Incident Response:** security@filetools.pro (Configured in Security Policy)
- **Stripe Support:** dashboard.stripe.com/support
- **Render Status Page:** status.render.com
- **Vercel Status Page:** vercel-status.com
