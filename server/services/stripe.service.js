'use strict';

const User = require('../models/User');
const StripeEvent = require('../models/StripeEvent');
const AuditLog = require('../models/AuditLog');
const { PLANS, getPlan, isBillingEnabled } = require('../config/plans');

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

/**
 * Creates Stripe Checkout Session with Safety Gate and Single Source of Truth
 */
async function createCheckoutSession(userId, planName, interval = 'monthly') {
  // Safety Invariant: Gate BILLING_ENABLED=false unless owner explicitly enables
  if (!isBillingEnabled()) {
    const err = new Error('BILLING_DISABLED_BY_ADMIN: Cổng thanh toán đang tạm dừng để bảo trì định kỳ. Quý khách vui lòng thử lại sau.');
    err.status = 503;
    err.code = 'BILLING_DISABLED_BY_ADMIN';
    throw err;
  }

  const stripe = getStripe();
  const user = await User.findById(userId);
  if (!user) throw new Error('Không tìm thấy tài khoản người dùng');

  const plan = PLANS[planName];
  if (!plan || plan.id === 'free') {
    throw new Error(`Gói đăng ký không hợp lệ: ${planName}`);
  }

  const priceSpec = plan.prices[interval];
  if (!priceSpec || priceSpec.enabled === false) {
    throw new Error(`Chu kỳ thanh toán không hỗ trợ: ${interval}`);
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     user.name,
      metadata: { userId: String(user._id) },
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  const priceEnvKey = plan.stripePriceEnv?.[interval];
  const envPriceId = priceEnvKey ? process.env[priceEnvKey] : null;

  // Build line items: use configured Stripe Price ID if present, or dynamic recurring price
  let lineItems;
  if (envPriceId) {
    lineItems = [{ price: envPriceId, quantity: 1 }];
  } else {
    // Dynamic Price creation in Sandbox Test Mode
    lineItems = [{
      price_data: {
        currency: priceSpec.currency.toLowerCase(),
        product_data: {
          name: `FileTools Pro — ${plan.displayName}`,
          description: plan.tagline,
        },
        unit_amount: Math.round(priceSpec.amount * 100),
        recurring: {
          interval: interval === 'yearly' ? 'year' : 'month',
        },
      },
      quantity: 1,
    }];
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items:           lineItems,
    mode:                 'subscription',
    success_url:          `${clientUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:           `${clientUrl}/pricing?payment=canceled`,
    metadata: {
      userId:   String(user._id),
      planName,
      interval,
    },
  });

  AuditLog.log({
    userId: user._id,
    action: 'billing.checkout_session_created',
    severity: 'info',
    meta: { planName, interval, sessionId: session.id },
  });

  return { sessionId: session.id, url: session.url };
}

/**
 * Creates Billing Portal Session for managing subscriptions & cards
 */
async function createBillingPortalSession(userId) {
  if (!isBillingEnabled()) {
    const err = new Error('BILLING_DISABLED_BY_ADMIN: Cổng thanh toán đang tạm dừng.');
    err.status = 503;
    throw err;
  }

  const stripe = getStripe();
  const user = await User.findById(userId);
  if (!user?.stripeCustomerId) {
    throw new Error('Chưa có thông tin hồ sơ thanh toán trên cổng Stripe');
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const session = await stripe.billingPortal.sessions.create({
    customer:   user.stripeCustomerId,
    return_url: `${clientUrl}/dashboard`,
  });

  return { url: session.url };
}

/**
 * Handles Webhook Events with Strict Idempotency & Lifecycle Reconciliation
 */
async function handleWebhookEvent(event) {
  if (!event || !event.id) {
    throw new Error('Sự kiện Stripe Webhook không hợp lệ');
  }

  // 1. Strict Idempotency Check: Avoid duplicate charging or double extensions
  const processed = await StripeEvent.findOne({ eventId: event.id });
  if (processed) {
    return { received: true, duplicate: true, eventId: event.id };
  }

  const eventType = event.type;
  const dataObject = event.data?.object;

  switch (eventType) {
    case 'checkout.session.completed': {
      const session = dataObject;
      const userId = session.metadata?.userId;
      const planName = session.metadata?.planName || 'plus';
      const interval = session.metadata?.interval || 'monthly';

      if (userId) {
        const expiresDays = interval === 'yearly' ? 365 : 30;
        const planExpiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

        await User.findByIdAndUpdate(userId, {
          plan:                 planName,
          stripeSubscriptionId: session.subscription,
          planExpiresAt,
        });

        AuditLog.log({
          userId,
          action: 'billing.subscription_activated',
          severity: 'info',
          meta: { planName, interval, subscriptionId: session.subscription },
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = dataObject;
      const user = await User.findOne({ stripeSubscriptionId: sub.id });
      if (user) {
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        if (sub.status === 'active' || sub.status === 'trialing') {
          user.planExpiresAt = periodEnd;
          await user.save();
        } else if (sub.status === 'past_due') {
          // Grace period: warn user, preserve plan for 3 days
          AuditLog.log({
            userId: user._id,
            action: 'billing.payment_past_due',
            severity: 'warning',
            meta: { subscriptionId: sub.id, status: sub.status },
          });
        } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
          user.plan = 'free';
          user.stripeSubscriptionId = null;
          await user.save();
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = dataObject;
      const user = await User.findOne({ stripeSubscriptionId: sub.id });
      if (user) {
        user.plan = 'free';
        user.stripeSubscriptionId = null;
        await user.save();

        AuditLog.log({
          userId: user._id,
          action: 'billing.subscription_canceled',
          severity: 'info',
          meta: { subscriptionId: sub.id },
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = dataObject;
      if (invoice.subscription) {
        const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
        if (user && invoice.lines?.data?.[0]?.period?.end) {
          user.planExpiresAt = new Date(invoice.lines.data[0].period.end * 1000);
          await user.save();
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = dataObject;
      AuditLog.log({
        action: 'billing.invoice_payment_failed',
        severity: 'warning',
        meta: { customerId: invoice.customer, invoiceId: invoice.id },
      });
      break;
    }

    case 'charge.refunded': {
      const charge = dataObject;
      AuditLog.log({
        action: 'billing.charge_refunded',
        severity: 'info',
        meta: { chargeId: charge.id, amountRefunded: charge.amount_refunded },
      });
      break;
    }
  }

  // 2. Record processed event in StripeEvent ledger for idempotency
  await StripeEvent.create({
    eventId: event.id,
    type: event.type,
    customerId: dataObject?.customer || null,
    status: 'PROCESSED',
    processedAt: new Date(),
  }).catch(() => {});

  return { received: true, eventId: event.id };
}

module.exports = {
  PLANS,
  getStripe,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhookEvent,
};
