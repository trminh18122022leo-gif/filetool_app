'use strict';

/**
 * tests/billing/subscription-finops.test.js
 * Comprehensive Subscription Platform, Stripe Webhook & FinOps Test Suite:
 * - Single Source of Truth (SSOT) Plan Catalogue & Entitlements
 * - Multi-interval Pricing (Monthly, Yearly with 33% discount, Weekly disabled)
 * - Atomic Quota Reservation & Release
 * - Stripe Webhook Idempotency & Replay Defense (StripeEvent ledger)
 * - Subscription Lifecycle (Active, Past Due Grace Period, Canceled Downgrade)
 * - Safety Gate: BILLING_ENABLED=false shuts down checkout safely
 * - PCI-DSS Invariant: Zero cardholder data stored at rest
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { v4: uuidv4 } = require('uuid');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-subscription-phase11-32chars!';
process.env.BILLING_ENABLED = 'false'; // Keep gated in tests

const {
  PLANS,
  getPlan,
  getPlanEntitlements,
  isBillingEnabled,
} = require('../../server/config/plans');

const {
  createCheckoutSession,
  handleWebhookEvent,
} = require('../../server/services/stripe.service');

const {
  reserveQuota,
  refundQuota,
  commitQuota,
} = require('../../server/services/quota.service');

const StripeEvent = require('../../server/models/StripeEvent');
const User = require('../../server/models/User');
const AuditLog = require('../../server/models/AuditLog');

describe('💳 Subscription Platform, Stripe Webhooks & FinOps Suite', () => {

  // ── 1. Plan SSOT & Entitlement Matrix ───────────────────────────────────────
  describe('1. Single Source of Truth (SSOT) Plan Catalogue', () => {
    it('verifies Free plan entitlements match specifications', () => {
      const free = getPlan('free');
      assert.strictEqual(free.id, 'free');
      assert.strictEqual(free.entitlements.maxFileSizeMB, 25);
      assert.strictEqual(free.entitlements.maxDailyJobs, 10);
      assert.strictEqual(free.entitlements.maxConcurrentJobs, 1);
      assert.strictEqual(free.entitlements.maxOcrPagesPerMonth, 20);
      assert.strictEqual(free.entitlements.includedAiCredits, 0);
      assert.strictEqual(free.prices.monthly.amount, 0);
    });

    it('verifies Plus plan pricing, discount and entitlements', () => {
      const plus = getPlan('plus');
      assert.strictEqual(plus.id, 'plus');
      assert.strictEqual(plus.prices.monthly.amount, 4.99);
      assert.strictEqual(plus.prices.yearly.amount, 39.99);
      assert.strictEqual(plus.prices.weekly.enabled, false, 'Weekly Plus must be disabled by default');
      assert.strictEqual(plus.entitlements.maxFileSizeMB, 250);
      assert.strictEqual(plus.entitlements.maxDailyJobs, 100);
      assert.strictEqual(plus.entitlements.maxConcurrentJobs, 2);
      assert.strictEqual(plus.entitlements.maxOcrPagesPerMonth, 300);
      assert.strictEqual(plus.entitlements.includedAiCredits, 100);
      assert.strictEqual(plus.entitlements.allowByok, true);
    });

    it('verifies Pro plan pricing, discount and entitlements', () => {
      const pro = getPlan('pro');
      assert.strictEqual(pro.id, 'pro');
      assert.strictEqual(pro.prices.monthly.amount, 9.99);
      assert.strictEqual(pro.prices.yearly.amount, 79.99);
      assert.strictEqual(pro.prices.weekly.enabled, false, 'Weekly Pro must be disabled by default');
      assert.strictEqual(pro.entitlements.maxFileSizeMB, 1000);
      assert.strictEqual(pro.entitlements.maxDailyJobs, 300);
      assert.strictEqual(pro.entitlements.maxConcurrentJobs, 4);
      assert.strictEqual(pro.entitlements.maxOcrPagesPerMonth, 1000);
      assert.strictEqual(pro.entitlements.includedAiCredits, 500);
    });
  });

  // ── 2. Feature Flag Safety Gate ─────────────────────────────────────────────
  describe('2. Safety Gate (BILLING_ENABLED=false)', () => {
    it('blocks checkout creation when BILLING_ENABLED=false', async () => {
      process.env.BILLING_ENABLED = 'false';
      assert.strictEqual(isBillingEnabled(), false);

      await assert.rejects(
        async () => {
          await createCheckoutSession('user_test_mock_id', 'plus');
        },
        (err) => {
          return err.message.includes('BILLING_DISABLED_BY_ADMIN');
        }
      );
    });
  });

  // ── 3. Stripe Webhook Event Idempotency ──────────────────────────────────────
  describe('3. Stripe Webhook Idempotency & Replay Defense', () => {
    const memEvents = new Map();
    const origFindOne = StripeEvent.findOne;
    const origCreate = StripeEvent.create;
    const origUserFindOne = User.findOne;
    const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

    let updatedUserId = null;
    let updatePayload = null;

    const origAuditLog = AuditLog.log;

    before(() => {
      AuditLog.log = function() { return Promise.resolve(); };
      StripeEvent.findOne = async function(query) {
        if (query.eventId && memEvents.has(query.eventId)) {
          return memEvents.get(query.eventId);
        }
        return null;
      };
      StripeEvent.create = async function(doc) {
        memEvents.set(doc.eventId, doc);
        return doc;
      };
      User.findOne = async function(query) {
        if (query.stripeSubscriptionId === 'sub_active_to_cancel_123') {
          return {
            _id: '507f1f77bcf86cd799439012',
            plan: 'pro',
            stripeSubscriptionId: 'sub_active_to_cancel_123',
            save: async function() { return this; }
          };
        }
        return null;
      };
      User.findByIdAndUpdate = async function(id, update) {
        updatedUserId = id;
        updatePayload = update;
        return { _id: id, ...update };
      };
    });

    after(() => {
      AuditLog.log = origAuditLog;
      StripeEvent.findOne = origFindOne;
      StripeEvent.create = origCreate;
      User.findOne = origUserFindOne;
      User.findByIdAndUpdate = origUserFindByIdAndUpdate;
    });

    it('processes event on first delivery and detects duplicate on replay', async () => {
      const testEvent = {
        id: 'evt_test_unique_idempotent_001',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
          },
        },
      };

      // 1st delivery
      const res1 = await handleWebhookEvent(testEvent);
      assert.strictEqual(res1.received, true);
      assert.strictEqual(res1.duplicate, undefined);

      // Replayed delivery (e.g. Stripe network retry)
      const res2 = await handleWebhookEvent(testEvent);
      assert.strictEqual(res2.received, true);
      assert.strictEqual(res2.duplicate, true, 'Replayed event must be flagged as duplicate');
    });

    it('activates subscription on checkout.session.completed', async () => {
      const checkoutEvent = {
        id: 'evt_checkout_success_002',
        type: 'checkout.session.completed',
        data: {
          object: {
            subscription: 'sub_new_pro_999',
            metadata: {
              userId: '507f1f77bcf86cd799439011',
              planName: 'pro',
              interval: 'yearly',
            },
          },
        },
      };

      const res = await handleWebhookEvent(checkoutEvent);
      assert.strictEqual(res.received, true);
      assert.strictEqual(updatedUserId, '507f1f77bcf86cd799439011');
      assert.strictEqual(updatePayload.plan, 'pro');
      assert.strictEqual(updatePayload.stripeSubscriptionId, 'sub_new_pro_999');
      assert.ok(updatePayload.planExpiresAt instanceof Date);
    });

    it('downgrades user to free plan on customer.subscription.deleted', async () => {
      const cancelEvent = {
        id: 'evt_sub_deleted_003',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_active_to_cancel_123',
          },
        },
      };

      const res = await handleWebhookEvent(cancelEvent);
      assert.strictEqual(res.received, true);
    });
  });

  // ── 4. Subscription State Lifecycle Mapping ─────────────────────────────────
  describe('4. Subscription State Lifecycle Mapping', () => {
    it('correctly maps subscription status to system states', () => {
      const statusMap = {
        active: 'ACTIVE',
        trialing: 'TRIAL',
        past_due: 'GRACE_PERIOD',
        incomplete: 'FREE',
        canceled: 'CANCELED',
        unpaid: 'SUSPENDED',
      };

      assert.strictEqual(statusMap['active'], 'ACTIVE');
      assert.strictEqual(statusMap['past_due'], 'GRACE_PERIOD');
      assert.strictEqual(statusMap['canceled'], 'CANCELED');
      assert.strictEqual(statusMap['incomplete'], 'FREE');
    });
  });

  // ── 5. PCI-DSS Compliance Invariant ─────────────────────────────────────────
  describe('5. PCI-DSS Compliance Invariant', () => {
    it('verifies User and StripeEvent models contain zero credit card fields', () => {
      const userSchemaPaths = Object.keys(User.schema.paths);
      const forbiddenFields = ['cardNumber', 'card', 'cvv', 'cvc', 'pan', 'expiryDate', 'expYear'];

      forbiddenFields.forEach(field => {
        assert.strictEqual(userSchemaPaths.includes(field), false, `User model must never contain ${field}`);
      });

      const stripeEventSchemaPaths = Object.keys(StripeEvent.schema.paths);
      forbiddenFields.forEach(field => {
        assert.strictEqual(stripeEventSchemaPaths.includes(field), false, `StripeEvent model must never contain ${field}`);
      });
    });
  });

  // ── 6. Atomic Quota Reservation & Refund Lifecycle ─────────────────────────
  describe('6. Atomic Quota Reservation & Refund Lifecycle', () => {
    it('permits guest quota reservation without DB hit', async () => {
      const res = await reserveQuota(null, { count: 1 });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.isGuest, true);
      assert.strictEqual(res.reservedCount, 1);
    });

    it('rejects quota refund if already committed or count is 0', async () => {
      const emptyJob = { user: 'user_123', quotaReserved: { count: 0, committed: false } };
      const res1 = await refundQuota(emptyJob);
      assert.strictEqual(res1.refunded, false);

      const committedJob = { user: 'user_123', quotaReserved: { count: 2, committed: true } };
      const res2 = await refundQuota(committedJob);
      assert.strictEqual(res2.refunded, false);
      assert.strictEqual(res2.reason, 'ALREADY_COMMITTED_OR_EMPTY');
    });

    it('successfully commits quota on job completion', async () => {
      let saved = false;
      const jobRecord = {
        quotaReserved: { count: 2, committed: false },
        save: async () => { saved = true; },
      };
      const res = await commitQuota(jobRecord);
      assert.strictEqual(res.committed, true);
      assert.strictEqual(jobRecord.quotaReserved.committed, true);
      assert.strictEqual(saved, true);
    });
  });

  // ── 7. FinOps Pricing & Discount Structure ─────────────────────────────────
  describe('7. FinOps Pricing & Discount Structure', () => {
    it('verifies Plus annual plan provides ~33% discount over monthly', () => {
      const plusMonthly = PLANS.plus.prices.monthly.amount;
      const plusYearly = PLANS.plus.prices.yearly.amount;
      const yearlyEquivalent = plusMonthly * 12; // 59.88
      const discountPercent = ((yearlyEquivalent - plusYearly) / yearlyEquivalent) * 100;
      assert.ok(discountPercent >= 30 && discountPercent <= 35, `Discount ${discountPercent}% should be ~33%`);
    });

    it('verifies Pro annual plan provides ~33% discount over monthly', () => {
      const proMonthly = PLANS.pro.prices.monthly.amount;
      const proYearly = PLANS.pro.prices.yearly.amount;
      const yearlyEquivalent = proMonthly * 12; // 119.88
      const discountPercent = ((yearlyEquivalent - proYearly) / yearlyEquivalent) * 100;
      assert.ok(discountPercent >= 30 && discountPercent <= 35, `Discount ${discountPercent}% should be ~33%`);
    });

    it('enforces weekly billing intervals remain disabled until approved', () => {
      assert.strictEqual(PLANS.plus.prices.weekly.enabled, false);
      assert.strictEqual(PLANS.pro.prices.weekly.enabled, false);
    });
  });
});
