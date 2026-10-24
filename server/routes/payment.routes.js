'use strict';

const express = require('express');
const router = express.Router();
const stripeSvc = require('../services/stripe.service');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { PLANS, isBillingEnabled } = require('../config/plans');
const { isAuthConnected } = require('../config/database');

// ── 1. Public Plan Catalogue (Single Source of Truth) ─────────────────────────
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: PLANS,
    billingEnabled: isBillingEnabled(),
  });
});

// ── 2. Billing Status & Feature Flag Gate ─────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    billingEnabled: isBillingEnabled(),
    mode: isBillingEnabled() ? 'active' : 'sandbox_simulation_only',
    supportedIntervals: ['monthly', 'yearly'],
    currency: 'USD',
  });
});

// ── 3. Create Stripe Checkout Session ─────────────────────────────────────────
router.post('/create-checkout-session', requireAuth, async (req, res, next) => {
  try {
    const { planName = 'plus', interval = 'monthly' } = req.body;
    const session = await stripeSvc.createCheckoutSession(req.user._id, planName, interval);
    res.json(session);
  } catch (err) { next(err); }
});

// ── 4. Customer Portal Session ────────────────────────────────────────────────
router.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const result = await stripeSvc.createBillingPortalSession(req.user._id);
    res.json(result);
  } catch (err) { next(err); }
});

// ── 5. Stripe Webhook Handler (Raw Body + Signature Verification) ─────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Fail-closed DB connection check: Return 503 so Stripe retries automatically
  if (!isAuthConnected()) {
    return res.status(503).send('AuthDB is currently unavailable. Stripe should retry.');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = stripeSvc.getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const result = await stripeSvc.handleWebhookEvent(event);
    res.json({ received: true, ...result });
  } catch (handlerErr) {
    console.error('[Stripe Webhook] Error processing event:', handlerErr);
    res.status(500).json({ error: handlerErr.message });
  }
});

module.exports = router;
