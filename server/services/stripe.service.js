'use strict';

const User = require('../models/User');

let stripeClient = null;

function getStripe() {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY chưa được cấu hình trong .env');
    }
    stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

const PLANS = {
  pro: {
    name:     'Pro Plan',
    priceId:  () => process.env.STRIPE_PRICE_PRO,
    price:    '$9.99/tháng',
  },
  business: {
    name:     'Business Plan',
    priceId:  () => process.env.STRIPE_PRICE_BUSINESS,
    price:    '$29.99/tháng',
  },
};

async function createCheckoutSession(userId, planName) {
  const stripe = getStripe();
  const user = await User.findById(userId);
  if (!user) throw new Error('Không tìm thấy tài khoản');

  const plan = PLANS[planName];
  if (!plan) throw new Error(`Gói không hợp lệ: ${planName}`);

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      metadata: { userId: String(user._id) },
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items: [{
      price:    plan.priceId(),
      quantity: 1,
    }],
    mode:                 'subscription',
    success_url:          `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:           `${process.env.CLIENT_URL || 'http://localhost:5173'}/pricing?payment=canceled`,
    metadata: {
      userId:   String(user._id),
      planName,
    },
  });

  return { sessionId: session.id, url: session.url };
}

async function createBillingPortalSession(userId) {
  const stripe = getStripe();
  const user = await User.findById(userId);
  if (!user?.stripeCustomerId) throw new Error('Chưa có thông tin thanh toán');

  const session = await stripe.billingPortal.sessions.create({
    customer:   user.stripeCustomerId,
    return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`,
  });

  return { url: session.url };
}

async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session  = event.data.object;
      const userId   = session.metadata?.userId;
      const planName = session.metadata?.planName || 'pro';
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          plan:                 planName,
          stripeSubscriptionId: session.subscription,
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const user = await User.findOne({ stripeSubscriptionId: subscription.id });
      if (user) {
        user.plan                 = 'free';
        user.stripeSubscriptionId = null;
        await user.save();
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const user = await User.findOne({ stripeSubscriptionId: sub.id });
      if (user && sub.status === 'active') {
        user.planExpiresAt = new Date(sub.current_period_end * 1000);
        await user.save();
      }
      break;
    }
  }
}

module.exports = {
  PLANS,
  getStripe,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhookEvent,
};
