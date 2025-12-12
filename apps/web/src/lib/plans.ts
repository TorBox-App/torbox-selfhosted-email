/**
 * Centralized plan configuration for Wraps Dashboard
 *
 * This file defines all pricing tiers and their features.
 * Used across the app for consistent plan information.
 *
 * Plan Philosophy:
 * - Limits should be generous enough that 99% of users never hit them
 * - They exist to protect against abuse, not to upsell
 * - What we limit (things with real costs): AI messages, bulk batch size, AWS accounts
 * - What we DON'T limit: team members, templates (they're just database rows)
 *
 * Note: The CLI/SDK is free forever and doesn't require a subscription.
 * These plans are only for the hosted dashboard at wraps.dev
 */

export const PLANS = {
  starter: {
    name: "Starter",
    price: 10,
    period: "/month",
    description: "Full hosted dashboard access",
    dashboardAccess: true,
    maxMembers: -1, // Unlimited
    maxAwsAccounts: 1,
    aiMessages: 50,
    bulkBatchSize: 100,
    features: [
      "Hosted dashboard at wraps.dev",
      "Email analytics and history",
      "Unlimited templates",
      "50 AI messages per month",
      "Bulk sending (100 recipients/batch)",
      "1 AWS account",
      "Unlimited team members",
      "Email support (48hr)",
    ],
    cta: "Subscribe",
  },
  pro: {
    name: "Pro",
    price: 49,
    period: "/month",
    description: "For growing startups with marketing needs",
    dashboardAccess: true,
    maxMembers: -1, // Unlimited
    maxAwsAccounts: 3,
    aiMessages: 250,
    bulkBatchSize: 1000,
    features: [
      "Everything in Starter",
      "250 AI messages per month",
      "Bulk sending (1,000 recipients/batch)",
      "3 AWS accounts (dev, staging, prod)",
      "Reusable content blocks",
      "Template versioning",
      "Priority support (24hr)",
    ],
    cta: "Subscribe",
  },
  growth: {
    name: "Growth",
    price: 99,
    period: "/month",
    description: "For scale-ups with serious email volume",
    dashboardAccess: true,
    maxMembers: -1, // Unlimited
    maxAwsAccounts: -1, // Unlimited
    aiMessages: 1000,
    bulkBatchSize: 10_000,
    features: [
      "Everything in Pro",
      "1,000 AI messages per month",
      "Bulk sending (10,000 recipients/batch)",
      "Unlimited AWS accounts",
      "Image library",
      "API access",
      "Dedicated support",
    ],
    cta: "Subscribe",
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan = (typeof PLANS)[PlanId];

/**
 * Check if a plan has dashboard access
 * All dashboard plans have access (CLI-only users don't have accounts)
 */
export function hasDashboardAccess(plan: PlanId | string): boolean {
  const planConfig = PLANS[plan as PlanId];
  return planConfig?.dashboardAccess ?? false;
}

/**
 * Get plan by ID with type safety
 */
export function getPlan(planId: PlanId | string): Plan | undefined {
  return PLANS[planId as PlanId];
}

/**
 * Get available plans for self-serve display (excludes growth for now)
 */
export function getDisplayPlans(): { id: PlanId; plan: Plan }[] {
  return [{ id: "starter", plan: PLANS.starter }];
}

/**
 * Format price for display
 */
export function formatPrice(plan: Plan): string {
  if (plan.price === null) return "Custom";
  return `$${plan.price}`;
}

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
  if (limit === -1) return true; // Unlimited
  return currentCount < limit;
}

/**
 * Get a user-friendly message about AWS account limits
 */
export function getAwsAccountLimitMessage(planId: PlanId | string): string {
  const plan = PLANS[planId as PlanId];
  if (!plan) return "You've reached your AWS account limit.";

  const limit = plan.maxAwsAccounts;
  if (limit === -1) return ""; // No limit message needed

  if (limit === 1) {
    return `Your ${plan.name} plan includes 1 AWS account. Upgrade to Pro for up to 3 accounts.`;
  }

  return `Your ${plan.name} plan includes up to ${limit} AWS accounts. Upgrade for more.`;
}
