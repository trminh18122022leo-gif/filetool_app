'use strict';

const express    = require('express');
const router     = express.Router();
const stripeSvc  = require('../services/stripe.service');
const { requireAuth } = require('../middleware/auth');

// Tạo Stripe Checkout Session
router.post('/create-checkout-session', requireAuth, async (req, res, next) => {
  try {
    const { planName } = req.body; // 'pro' | 'business'
    const session = await stripeSvc.createCheckoutSession(req.user._id, planName);
    res.json(session);
  } catch (err) { next(err); }
});

// Customer Portal: hủy gói, đổi thẻ
router.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const result = await stripeSvc.createBillingPortalSession(req.user._id);
    res.json(result);
  } catch (err) { next(err); }
});

// Webhook Stripe: nhận thông báo thanh toán thành công
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const stripe = stripeSvc.getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  await stripeSvc.handleWebhookEvent(event);
  res.json({ received: true });
});

module.exports = router;
