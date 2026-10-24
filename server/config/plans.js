'use strict';

/**
 * server/config/plans.js
 * Single Source of Truth (SSOT) for Plan Catalogue, Pricing & Entitlements.
 * Web client may DISPLAY these values but cannot grant entitlements.
 */

const BILLING_INTERVALS = Object.freeze({
  MONTHLY: 'monthly',
  YEARLY:  'yearly',
  WEEKLY:  'weekly',
});

const PLANS = Object.freeze({
  free: {
    id: 'free',
    name: 'Free',
    displayName: 'Gói Miễn Phí',
    tagline: 'Phù hợp cho nhu cầu cá nhân & học tập cơ bản',
    prices: {
      monthly: { amount: 0, currency: 'USD', formatted: '$0' },
      yearly:  { amount: 0, currency: 'USD', formatted: '$0' },
    },
    entitlements: {
      maxFileSizeMB: 25,
      maxFileSizeBytes: 25 * 1024 * 1024,
      maxDailyJobs: 10,
      maxConcurrentJobs: 1,
      maxOcrPagesPerMonth: 20,
      includedAiCredits: 0,
      maxStorageBytes: 500 * 1024 * 1024, // 500 MB
      retentionDays: 1,
      maxDagNodes: 3,
      allowByok: false,
      priorityProcessing: false,
    },
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    displayName: 'Gói Plus',
    tagline: 'Dành cho Freelancers & nhà sáng tạo nội dung năng động',
    prices: {
      monthly: { amount: 4.99, currency: 'USD', formatted: '$4.99/tháng' },
      yearly:  { amount: 39.99, currency: 'USD', formatted: '$39.99/năm' }, // ~33% discount
      weekly:  { amount: 1.99, currency: 'USD', formatted: '$1.99/tuần', enabled: false }, // Disabled until churn assessed
    },
    stripePriceEnv: {
      monthly: 'STRIPE_PRICE_PLUS_MONTHLY',
      yearly:  'STRIPE_PRICE_PLUS_YEARLY',
    },
    entitlements: {
      maxFileSizeMB: 250,
      maxFileSizeBytes: 250 * 1024 * 1024,
      maxDailyJobs: 100,
      maxConcurrentJobs: 2,
      maxOcrPagesPerMonth: 300,
      includedAiCredits: 100,
      maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
      retentionDays: 7,
      maxDagNodes: 8,
      allowByok: true,
      priorityProcessing: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Gói Pro Chuyên Nghiệp',
    tagline: 'Cho văn phòng, lập trình viên & chuyên viên pháp lý',
    prices: {
      monthly: { amount: 9.99, currency: 'USD', formatted: '$9.99/tháng' },
      yearly:  { amount: 79.99, currency: 'USD', formatted: '$79.99/năm' }, // ~33% discount
      weekly:  { amount: 3.99, currency: 'USD', formatted: '$3.99/tuần', enabled: false },
    },
    stripePriceEnv: {
      monthly: 'STRIPE_PRICE_PRO_MONTHLY',
      yearly:  'STRIPE_PRICE_PRO_YEARLY',
    },
    entitlements: {
      maxFileSizeMB: 1000,
      maxFileSizeBytes: 1000 * 1024 * 1024, // 1 GB
      maxDailyJobs: 300,
      maxConcurrentJobs: 4,
      maxOcrPagesPerMonth: 1000,
      includedAiCredits: 500,
      maxStorageBytes: 50 * 1024 * 1024 * 1024, // 50 GB
      retentionDays: 30,
      maxDagNodes: 15,
      allowByok: true,
      priorityProcessing: true,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    displayName: 'Gói Doanh Nghiệp',
    tagline: 'Hạ tầng quy mô lớn, API webhook & hỗ trợ SLA 99.9%',
    prices: {
      monthly: { amount: 29.99, currency: 'USD', formatted: '$29.99/tháng' },
      yearly:  { amount: 249.99, currency: 'USD', formatted: '$249.99/năm' },
    },
    stripePriceEnv: {
      monthly: 'STRIPE_PRICE_BUSINESS_MONTHLY',
      yearly:  'STRIPE_PRICE_BUSINESS_YEARLY',
    },
    entitlements: {
      maxFileSizeMB: 5000,
      maxFileSizeBytes: 5000 * 1024 * 1024, // 5 GB
      maxDailyJobs: 10000,
      maxConcurrentJobs: 20,
      maxOcrPagesPerMonth: 100000,
      includedAiCredits: 2000,
      maxStorageBytes: 200 * 1024 * 1024 * 1024, // 200 GB
      retentionDays: 90,
      maxDagNodes: 25,
      allowByok: true,
      priorityProcessing: true,
    },
  },
});

function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

function getPlanEntitlements(planId) {
  const plan = getPlan(planId);
  return plan.entitlements;
}

function isBillingEnabled() {
  return process.env.BILLING_ENABLED === 'true';
}

module.exports = {
  BILLING_INTERVALS,
  PLANS,
  getPlan,
  getPlanEntitlements,
  isBillingEnabled,
};
