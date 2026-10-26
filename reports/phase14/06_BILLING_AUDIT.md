# Phase 14 — Report 06: Subscription Platform, Billing & FinOps Audit

**Audit Phase:** Phase 14 — Comprehensive Final Second Pass & Production Release Audit  
**Author:** Independent FinOps Analyst & Subscription Platform Engineer  
**Audit Date:** 2026-10-24  
**Scope:** Review of the Single Source of Truth (SSOT) plan catalogue, Stripe integration, webhook idempotency, quota reservation lifecycle, and PCI-DSS invariants.

---

## 1. Single Source of Truth (SSOT) Plan Catalogue

Plan specifications, pricing intervals, and quota limits are defined exclusively in `server/config/plans.js`. The web client reads plan definitions from the backend endpoint `GET /api/payment/plans` and **cannot self-grant entitlements**.

### Plan Entitlements Summary

| Specification Axis | Free Plan ($0) | Plus Plan ($4.99 / mo) | Pro Plan ($9.99 / mo) |
|:---|:---:|:---:|:---:|
| **Monthly Price** | \$0.00 | \$4.99 USD / month | \$9.99 USD / month |
| **Annual Price (33% Discount)** | \$0.00 | \$39.99 USD / year (~$3.33/mo) | \$79.99 USD / year (~$6.67/mo) |
| **Weekly Interval** | *Disabled* | *Disabled by default* | *Disabled by default* |
| **Max File Size** | $25\text{ MB}$ | $250\text{ MB}$ | $1,000\text{ MB}$ ($1\text{ GB}$) |
| **Daily Jobs Cap** | 10 jobs / day | 100 jobs / day | 300 jobs / day |
| **Queue Concurrency** | 1 concurrent job | 2 concurrent jobs | 4 concurrent jobs |
| **OCR Pages / Month** | 0 pages | 300 pages / month | 1,000 pages / month |
| **Included AI Credits** | 0 credits | 100 credits / month | 500 credits / month |
| **Cloud Storage Retention** | 24 hours | 7 days | 30 days |
| **BYOK (Bring Your Own Key)** | Supported | Supported | Supported |

---

## 2. Safety Gate (`BILLING_ENABLED=false`) Audit

To prevent unauthorized or accidental customer charges prior to official owner financial approval:
- The system enforces a mandatory environment safety gate: `process.env.BILLING_ENABLED === 'true'`.
- In `server/routes/payment.routes.js:70`, attempting to create a Stripe checkout session while `BILLING_ENABLED=false` immediately aborts:
  ```javascript
  if (!isBillingEnabled()) {
    return res.status(403).json({
      error: 'Hệ thống thanh toán đang trong chế độ bảo trì hoặc thử nghiệm.',
      code: 'BILLING_DISABLED'
    });
  }
  ```
- Verified in `tests/billing/subscription-finops.test.js` (Test 2).

---

## 3. Stripe Webhook Verification & Replay Defense

### 1. Webhook Signature Check
- In `server/routes/payment.routes.js:145-175`, webhooks are mounted with `express.raw({ type: 'application/json' })` to preserve exact raw byte payload for `stripe.webhooks.constructEvent`.
- If `STRIPE_WEBHOOK_SECRET` is invalid or missing, webhook processing immediately aborts with HTTP 400.

### 2. Idempotency & Deduplication
- Processed Stripe events are recorded in the `StripeEvent` MongoDB collection (`eventId`, `eventType`, `receivedAt`).
- If an event with the same `eventId` is delivered multiple times (due to network retry or replay attack), the second delivery is detected via unique index lookup and returns HTTP 200 `{ duplicate: true, code: 'duplicate_event_ignored' }` **without granting double credits or multiple plan extensions**.

### 3. Subscription Lifecycle State Machine
- `checkout.session.completed`: Sets `user.plan = session.metadata.planId`, `user.subscriptionStatus = 'active'`, and records Stripe customer ID.
- `invoice.payment_failed`: Marks `user.subscriptionStatus = 'past_due'`; retains plan for 3-day grace period before downgrade.
- `customer.subscription.deleted`: Immediately downgrades `user.plan = 'free'` and `user.subscriptionStatus = 'canceled'`.

---

## 4. Atomic Quota Reservation & Refund Lifecycle

To prevent race conditions where concurrent jobs exceed monthly quotas:
1. **Reservation (`reserveQuota`):** Decrements user quota atomically before job execution begins.
2. **Commit (`commitQuota`):** Upon successful job completion, the reservation is permanently committed to the usage ledger.
3. **Refund (`refundQuota`):** If the background worker fails, crashes, or is cancelled, the reserved quota is automatically refunded to the user's balance.

---

## 5. FinOps COGS & Unit Economics Validation

From the reproducible benchmark harness (`scripts/load-benchmark.js`):
- **Cloudflare R2 Storage:** Zero egress fees. Storage cost is \$0.0000005 per MB-day. A 50MB file retained for 24 hours costs **\$0.000025 USD**.
- **AI Processing (Gemini 2.0 Flash):** 1,500 prompt tokens + 400 completion tokens costs **\$0.000233 USD** per request.
- **Worker Compute (Render Starter):** Fixed \$7/mo for Web + \$7/mo for Worker + \$7/mo for Redis = \$21/mo base infrastructure.
- **Break-Even Analysis:** At \$4.99/month for Plus, the fixed baseline is recovered with **$\ge 5$ paying subscribers**. Runaway job compute is protected by the daily cap of 100 jobs/day.

---

## 6. PCI-DSS Compliance Invariant

- FileTools Pro servers **never receive, transmit, or store raw credit card numbers, CVVs, or bank account details**.
- All checkout flows use Stripe-hosted checkout or Stripe Elements tokenization.
- Verified in `tests/billing/subscription-finops.test.js` (Test 5): Mongoose schemas `User` and `StripeEvent` contain zero financial PAN fields.
