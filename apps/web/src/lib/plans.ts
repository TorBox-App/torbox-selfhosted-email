/**
 * Centralized plan configuration for Wraps Dashboard
 *
 * This file defines all pricing tiers and their features.
 * Used across the app for consistent plan information.
 *
 * Plan Philosophy:
 * - Features unlock at the tier where they become valuable
 * - No artificial gates - upgrade triggers are natural business needs
 * - Contact limits scale with pricing tiers
 * - What we limit: contacts, AI messages, AWS accounts, API rate
 * - What we DON'T limit: team members, templates (they're just database rows)
 *
 * Note: The CLI/SDK is free forever and doesn't require a subscription.
 * These plans are only for the Platform at app.wraps.dev
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type PlanId = "starter" | "growth" | "scale";

export type PlanFeature =
  | "batch" // Starter+: Send to all contacts
  | "topics" // Growth+: Subscription management
  | "segments" // Growth+: Property-based targeting
  | "campaigns" // Growth+: Scheduled, targeted sends
  | "workflows" // Starter+: Visual automation builder (5/25/unlimited by tier)
  | "events" // Scale+: Behavioral tracking
  | "advancedSegments" // Scale+: Event-based segments
  | "customRetention" // Enterprise+: Custom data retention
  | "prioritySLA"; // Enterprise+: Priority support SLA

export type RateLimits = {
  dailyRequests: number; // -1 = unlimited
  minuteRequests: number;
};

export type BillingInterval = "monthly" | "annual";

export type PlanConfig = {
  name: string;
  price: number;
  earlyAdopterPrice?: number; // Discounted price for first 50 customers
  annualPrice?: number; // Regular annual price (per month equivalent)
  annualEarlyAdopterPrice?: number; // Early adopter annual price (per month equivalent)
  annualTotal?: number; // Total billed annually (early adopter)
  period: string;
  description: string;
  dashboardAccess: boolean;

  // Resource Limits
  maxContacts: number; // -1 = unlimited
  maxMembers: number; // -1 = unlimited
  maxAwsAccounts: number; // -1 = unlimited
  aiMessages: number;
  bulkBatchSize: number;

  // Event-Based Pricing Limits (2026 model)
  maxEvents: number; // Monthly event limit (-1 = unlimited)
  maxWorkflows: number; // Active workflow limit (-1 = unlimited)
  eventRetentionDays: number; // UI/API filter window (30, 90, 365)

  // Feature Access
  features: Record<PlanFeature, boolean>;

  // Rate Limits (API requests)
  rateLimits: RateLimits;

  // Display
  featureList: string[];
  cta: string;
};

// Early adopter pricing is active until we reach 50 customers
// After that, prices return to normal (and SMS features will be added)
export const EARLY_ADOPTER_ACTIVE = true;

// ═══════════════════════════════════════════════════════════════════════════
// PLAN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    name: "Starter",
    price: 19,
    earlyAdopterPrice: 10,
    annualPrice: 16, // ~20% savings vs monthly ($192/yr)
    annualEarlyAdopterPrice: 8, // Early adopter annual ($100/yr)
    annualTotal: 100, // Total billed annually (early adopter)
    period: "/month",
    description: "Transactional email + simple broadcasts",
    dashboardAccess: true,

    // Resource Limits (2026 model: unlimited contacts)
    maxContacts: -1, // Unlimited contacts
    maxMembers: -1, // Unlimited
    maxAwsAccounts: 1,
    aiMessages: 50,
    bulkBatchSize: 100,

    // Event-Based Pricing Limits
    maxEvents: 50_000, // 50K events/month
    maxWorkflows: 5, // 5 workflows
    eventRetentionDays: 30, // 30-day retention

    // Feature Access
    features: {
      batch: true, // Send to all contacts
      topics: false,
      segments: false,
      campaigns: false,
      workflows: true, // 5 workflows limit
      events: false,
      advancedSegments: false,
      customRetention: false,
      prioritySLA: false,
    },

    // Rate Limits
    rateLimits: {
      dailyRequests: 50_000,
      minuteRequests: 500,
    },

    // Display
    featureList: [
      "Unlimited contacts",
      "50,000 events/month",
      "Transactional + batch sending",
      "5 workflows",
      "50 AI messages per month",
      "1 AWS account",
      "30-day event history",
      "Email support (48hr)",
    ],
    cta: "Subscribe",
  },

  growth: {
    name: "Growth",
    price: 49,
    earlyAdopterPrice: 49, // No early adopter discount for Growth
    annualPrice: 41, // ~17% savings vs monthly ($490/yr)
    annualEarlyAdopterPrice: 41, // Same as regular annual
    annualTotal: 490, // Total billed annually
    period: "/month",
    description: "Add marketing automation + topics",
    dashboardAccess: true,

    // Resource Limits (2026 model: unlimited contacts)
    maxContacts: -1, // Unlimited contacts
    maxMembers: -1, // Unlimited
    maxAwsAccounts: 3,
    aiMessages: 250,
    bulkBatchSize: 1000,

    // Event-Based Pricing Limits
    maxEvents: 250_000, // 250K events/month
    maxWorkflows: 25, // 25 workflows
    eventRetentionDays: 90, // 90-day retention

    // Feature Access
    features: {
      batch: true,
      topics: true, // Subscription management
      segments: true, // Property-based targeting
      campaigns: true, // Scheduled, targeted sends
      workflows: true, // 25 workflows limit
      events: false,
      advancedSegments: false,
      customRetention: false,
      prioritySLA: false,
    },

    // Rate Limits
    rateLimits: {
      dailyRequests: 200_000,
      minuteRequests: 2000,
    },

    // Display
    featureList: [
      "Unlimited contacts",
      "250,000 events/month",
      "Everything in Starter",
      "Topics (subscription management)",
      "Segments (property-based targeting)",
      "Campaigns (scheduled, targeted)",
      "25 workflows",
      "250 AI messages per month",
      "3 AWS accounts",
      "90-day event history",
      "Priority support (24hr)",
    ],
    cta: "Subscribe",
  },

  scale: {
    name: "Scale",
    price: 149,
    earlyAdopterPrice: 149, // No early adopter discount for Scale
    annualPrice: 124, // ~17% savings vs monthly ($1,490/yr)
    annualEarlyAdopterPrice: 124, // Same as regular annual
    annualTotal: 1490, // Total billed annually
    period: "/month",
    description: "Full automation + event tracking",
    dashboardAccess: true,

    // Resource Limits (2026 model: unlimited contacts)
    maxContacts: -1, // Unlimited contacts
    maxMembers: -1, // Unlimited
    maxAwsAccounts: -1, // Unlimited
    aiMessages: 1000,
    bulkBatchSize: 10_000,

    // Event-Based Pricing Limits
    maxEvents: 1_000_000, // 1M events/month
    maxWorkflows: -1, // Unlimited workflows
    eventRetentionDays: 365, // 1-year retention

    // Feature Access
    features: {
      batch: true,
      topics: true,
      segments: true,
      campaigns: true,
      workflows: true, // Visual automation builder
      events: true, // Behavioral tracking
      advancedSegments: true, // Event-based segments
      customRetention: false,
      prioritySLA: true, // Priority support SLA
    },

    // Rate Limits
    rateLimits: {
      dailyRequests: 500_000,
      minuteRequests: 5000,
    },

    // Display
    featureList: [
      "Unlimited contacts",
      "1,000,000 events/month",
      "Everything in Growth",
      "Unlimited workflows",
      "Event tracking (behavioral triggers)",
      "Advanced segments (event-based)",
      "Multi-tenant orchestration",
      "1,000 AI messages per month",
      "Unlimited AWS accounts",
      "1-year event history",
      "Priority support + SLA",
    ],
    cta: "Subscribe",
  },
} as const;

export type Plan = PlanConfig;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a plan has dashboard access
 */
export function hasDashboardAccess(planId: PlanId | string): boolean {
  const planConfig = PLANS[planId as PlanId];
  return planConfig?.dashboardAccess ?? false;
}

/**
 * Get plan by ID with type safety
 */
export function getPlan(planId: PlanId | string): PlanConfig | undefined {
  return PLANS[planId as PlanId];
}

/**
 * Get available plans for self-serve display
 */
export function getDisplayPlans(): { id: PlanId; plan: PlanConfig }[] {
  return [
    { id: "starter", plan: PLANS.starter },
    { id: "growth", plan: PLANS.growth },
    { id: "scale", plan: PLANS.scale },
  ];
}

/**
 * Format price for display
 */
export function formatPrice(plan: PlanConfig): string {
  return `$${plan.price}`;
}

/**
 * Get the current display price (early adopter or regular)
 */
export function getDisplayPrice(plan: PlanConfig): number {
  if (EARLY_ADOPTER_ACTIVE && plan.earlyAdopterPrice) {
    return plan.earlyAdopterPrice;
  }
  return plan.price;
}

/**
 * Check if a plan has early adopter pricing active
 */
export function hasEarlyAdopterPricing(plan: PlanConfig): boolean {
  return EARLY_ADOPTER_ACTIVE && plan.earlyAdopterPrice !== undefined;
}

/**
 * Get the annual price for display (early adopter or regular)
 */
export function getAnnualDisplayPrice(plan: PlanConfig): number | null {
  if (EARLY_ADOPTER_ACTIVE && plan.annualEarlyAdopterPrice) {
    return plan.annualEarlyAdopterPrice;
  }
  return plan.annualPrice ?? null;
}

/**
 * Get the annual total (amount billed annually)
 */
export function getAnnualTotal(plan: PlanConfig): number | null {
  return plan.annualTotal ?? null;
}

/**
 * Get the price based on billing interval
 */
export function getPriceByInterval(
  plan: PlanConfig,
  interval: BillingInterval
): number {
  if (interval === "annual") {
    const annualPrice = getAnnualDisplayPrice(plan);
    if (annualPrice) return annualPrice;
  }
  return getDisplayPrice(plan);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT LIMITS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the contact limit for a plan
 * Returns -1 for unlimited
 */
export function getContactLimit(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId];
  return plan?.maxContacts ?? 5000; // Default to Starter limit
}

/**
 * Check if an organization can add more contacts based on their plan
 */
export function canAddContact(
  planId: PlanId | string,
  currentCount: number
): boolean {
  const limit = getContactLimit(planId);
  if (limit === -1) {
    return true; // Unlimited
  }
  return currentCount < limit;
}

/**
 * Get contact limit message for display
 */
export function getContactLimitMessage(
  planId: PlanId | string,
  currentCount: number
): string {
  const plan = PLANS[planId as PlanId];
  if (!plan) {
    return "You've reached your contact limit.";
  }

  const limit = plan.maxContacts;
  if (limit === -1) {
    return ""; // No limit message needed
  }

  const remaining = limit - currentCount;
  if (remaining <= 0) {
    return `You've reached your ${plan.name} plan limit of ${limit.toLocaleString()} contacts. Upgrade to add more.`;
  }

  if (remaining <= limit * 0.1) {
    // Less than 10% remaining
    return `You have ${remaining.toLocaleString()} contacts remaining on your ${plan.name} plan.`;
  }

  return "";
}

// ═══════════════════════════════════════════════════════════════════════════
// AWS ACCOUNT LIMITS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the AWS account limit for a plan
 * Returns -1 for unlimited
 */
export function getAwsAccountLimit(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId];
  return plan?.maxAwsAccounts ?? 1; // Default to 1 if plan not found
}

/**
 * Check if an organization can add more AWS accounts based on their plan
 */
export function canAddAwsAccount(
  planId: PlanId | string,
  currentCount: number
): boolean {
  const limit = getAwsAccountLimit(planId);
  if (limit === -1) {
    return true; // Unlimited
  }
  return currentCount < limit;
}

/**
 * Get AWS account limit message for display
 */
export function getAwsAccountLimitMessage(planId: PlanId | string): string {
  const plan = PLANS[planId as PlanId];
  if (!plan) {
    return "You've reached your AWS account limit.";
  }

  const limit = plan.maxAwsAccounts;
  if (limit === -1) {
    return ""; // No limit message needed
  }

  if (limit === 1) {
    return `Your ${plan.name} plan includes 1 AWS account. Upgrade to Growth for up to 3 accounts.`;
  }

  return `Your ${plan.name} plan includes up to ${limit} AWS accounts. Upgrade for more.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE ACCESS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a feature is available for a plan
 */
export function hasFeature(
  planId: PlanId | string,
  feature: PlanFeature
): boolean {
  const plan = PLANS[planId as PlanId];
  return plan?.features[feature] ?? false;
}

/**
 * Get the minimum plan required for a feature
 */
export function getRequiredPlan(feature: PlanFeature): PlanId | null {
  const planOrder: PlanId[] = ["starter", "growth", "scale"];

  for (const planId of planOrder) {
    if (PLANS[planId].features[feature]) {
      return planId;
    }
  }

  return null;
}

/**
 * Get feature gate message for display
 */
export function getFeatureGateMessage(
  planId: PlanId | string,
  feature: PlanFeature,
  featureDisplayName: string
): string {
  const currentPlan = PLANS[planId as PlanId];
  const requiredPlan = getRequiredPlan(feature);

  if (!(currentPlan && requiredPlan)) {
    return `${featureDisplayName} is not available on your current plan.`;
  }

  const requiredPlanConfig = PLANS[requiredPlan];
  return `${featureDisplayName} requires a ${requiredPlanConfig.name} plan ($${requiredPlanConfig.price}/mo).`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get rate limits for a plan
 */
export function getRateLimits(planId: PlanId | string): RateLimits {
  const plan = PLANS[planId as PlanId];
  return (
    plan?.rateLimits ?? {
      dailyRequests: 50_000,
      minuteRequests: 500,
    }
  );
}

/**
 * Get batch size limit for a plan
 */
export function getBatchSizeLimit(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId];
  return plan?.bulkBatchSize ?? 100;
}

/**
 * Get AI message limit for a plan
 */
export function getAiMessageLimit(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId];
  return plan?.aiMessages ?? 50;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LIMITS (2026 Event-Based Pricing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the monthly event limit for a plan
 * Returns -1 for unlimited
 */
export function getEventLimit(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId];
  return plan?.maxEvents ?? 50_000; // Default to Starter limit
}

/**
 * Get the workflow limit for a plan
 * Returns -1 for unlimited
 */
export function getWorkflowLimit(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId];
  return plan?.maxWorkflows ?? 5; // Default to Starter limit
}

/**
 * Get the event retention period in days for a plan
 */
export function getEventRetentionDays(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId];
  return plan?.eventRetentionDays ?? 30; // Default to Starter retention
}

/**
 * Check if an organization can ingest more events based on their plan
 */
export function canIngestEvent(
  planId: PlanId | string,
  currentCount: number
): boolean {
  const limit = getEventLimit(planId);
  if (limit === -1) {
    return true; // Unlimited
  }
  // Allow up to 125% of limit (25% grace period) before hard block
  return currentCount < limit * 1.25;
}

/**
 * Get event usage threshold status based on current usage
 */
export function getEventUsageThreshold(
  planId: PlanId | string,
  currentCount: number
): "normal" | "warning" | "critical" | "exceeded" {
  const limit = getEventLimit(planId);
  if (limit === -1) {
    return "normal"; // Unlimited
  }

  const percentUsed = (currentCount / limit) * 100;

  if (percentUsed >= 125) {
    return "exceeded"; // 125%+ - hard block
  }
  if (percentUsed >= 100) {
    return "critical"; // 100-125% - banner + email
  }
  if (percentUsed >= 80) {
    return "warning"; // 80-100% - dashboard warning
  }
  return "normal";
}

/**
 * Get event limit message for display
 */
export function getEventLimitMessage(
  planId: PlanId | string,
  currentCount: number
): string {
  const plan = PLANS[planId as PlanId];
  if (!plan) {
    return "You've reached your event limit.";
  }

  const limit = plan.maxEvents;
  if (limit === -1) {
    return ""; // No limit message needed
  }

  const threshold = getEventUsageThreshold(planId, currentCount);
  const remaining = Math.max(0, limit - currentCount);
  const percentUsed = Math.round((currentCount / limit) * 100);

  switch (threshold) {
    case "exceeded":
      return `Event limit exceeded (${percentUsed}% used). Upgrade to continue ingesting events.`;
    case "critical":
      return `You've reached your monthly event limit of ${limit.toLocaleString()}. Resets on the 1st.`;
    case "warning":
      return `${remaining.toLocaleString()} events remaining (${100 - percentUsed}% left). Resets on the 1st.`;
    default:
      return "";
  }
}

/**
 * Check if an organization can add more workflows based on their plan
 */
export function canAddWorkflow(
  planId: PlanId | string,
  currentCount: number
): boolean {
  const limit = getWorkflowLimit(planId);
  if (limit === -1) {
    return true; // Unlimited
  }
  return currentCount < limit;
}

/**
 * Get workflow limit message for display
 */
export function getWorkflowLimitMessage(planId: PlanId | string): string {
  const plan = PLANS[planId as PlanId];
  if (!plan) {
    return "You've reached your workflow limit.";
  }

  const limit = plan.maxWorkflows;
  if (limit === -1) {
    return ""; // No limit message needed
  }

  if (limit <= 5) {
    return `Your ${plan.name} plan includes ${limit} workflows. Upgrade to Growth for 25 workflows.`;
  }

  return `Your ${plan.name} plan includes up to ${limit} workflows. Upgrade for unlimited.`;
}
