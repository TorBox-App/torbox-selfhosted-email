import { db } from "@wraps/db";
import { aiUsageLog, aiUsageMonthly } from "@wraps/db/schema/usage";
import { and, eq, sql } from "drizzle-orm";
import { getOrganizationPlanId } from "@/lib/organization";
import { isSelfHosted } from "@/lib/plan-limits";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Get the period key for AI usage tracking.
 *
 * Always uses calendar month (YYYY-MM format) for AI usage limits.
 * This ensures all users (including annual subscribers) get their
 * AI message limit reset each calendar month, not each billing cycle.
 */
export function getAiUsagePeriodKey(): string {
  return getCurrentPeriodKey();
}

/**
 * Get the current calendar month period key (YYYY-MM format)
 * Used as fallback for organizations without subscriptions
 */
export function getCurrentPeriodKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get AI message limit for a plan
 * Returns -1 for unlimited
 */
export function getAiMessageLimit(planId: PlanId | string): number {
  // Self-hosted deployments are licensed, not metered — no AI generation cap.
  if (isSelfHosted()) {
    return -1;
  }
  const plan = PLANS[planId as PlanId];
  return plan?.aiMessages ?? 50; // Default to starter limit
}

/**
 * Get current AI usage for an organization in the current calendar month
 * This is the fast path - single indexed query
 */
export async function getAiUsageCount(organizationId: string): Promise<number> {
  const periodKey = getAiUsagePeriodKey();

  const usage = await db.query.aiUsageMonthly.findFirst({
    where: and(
      eq(aiUsageMonthly.organizationId, organizationId),
      eq(aiUsageMonthly.periodKey, periodKey)
    ),
  });

  return usage?.messageCount ?? 0;
}

/**
 * Check if organization can make an AI request.
 * AI usage is tracked per calendar month, regardless of billing cycle.
 */
export async function checkAiUsageLimit(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  planId: string;
}> {
  const [planId, currentUsage] = await Promise.all([
    getOrganizationPlanId(organizationId),
    getAiUsageCount(organizationId),
  ]);

  const limit = getAiMessageLimit(planId);
  const allowed = limit === -1 || currentUsage < limit;

  return {
    allowed,
    current: currentUsage,
    limit,
    planId,
  };
}

/**
 * Increment AI usage count for an organization
 * Uses upsert pattern for atomicity
 */
export async function incrementAiUsage(
  organizationId: string
): Promise<number> {
  const periodKey = getAiUsagePeriodKey();

  // Use upsert with ON CONFLICT to atomically increment
  const result = await db
    .insert(aiUsageMonthly)
    .values({
      organizationId,
      periodKey,
      messageCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiUsageMonthly.organizationId, aiUsageMonthly.periodKey],
      set: {
        messageCount: sql`${aiUsageMonthly.messageCount} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ messageCount: aiUsageMonthly.messageCount });

  return result[0]?.messageCount ?? 1;
}

/**
 * Log an individual AI usage request (for detailed analytics)
 */
export async function logAiUsage(data: {
  organizationId: string;
  userId: string;
  featureType?: string;
  templateId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  durationMs?: number;
}): Promise<void> {
  const periodKey = getAiUsagePeriodKey();

  await db.insert(aiUsageLog).values({
    organizationId: data.organizationId,
    userId: data.userId,
    periodKey,
    featureType: data.featureType ?? "ai_chat",
    templateId: data.templateId,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    totalTokens: data.totalTokens,
    model: data.model,
    durationMs: data.durationMs,
  });
}

/**
 * Combined function to increment usage and log the request
 * Called after a successful AI request
 */
export async function trackAiRequest(data: {
  organizationId: string;
  userId: string;
  featureType?: string;
  templateId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  durationMs?: number;
}): Promise<number> {
  // Run both in parallel for speed
  const [newCount] = await Promise.all([
    incrementAiUsage(data.organizationId),
    logAiUsage(data),
  ]);

  return newCount;
}

/**
 * Check if user is approaching their AI usage limit (last 10%)
 * Returns warning info if they should be warned.
 * AI usage resets on the 1st of each calendar month.
 */
export function getUsageWarning(
  current: number,
  limit: number
): {
  shouldWarn: boolean;
  remaining: number;
  percentUsed: number;
  message?: string;
} {
  // No warning for unlimited plans
  if (limit === -1) {
    return { shouldWarn: false, remaining: -1, percentUsed: 0 };
  }

  const remaining = Math.max(0, limit - current);
  const percentUsed = Math.round((current / limit) * 100);

  // Warn when 90% or more used (last 10%)
  const shouldWarn = percentUsed >= 90;

  // Calculate days until next month reset
  const resetInfo = `Resets ${formatNextMonthReset()}.`;

  let message: string | undefined;
  if (remaining === 0) {
    message = `You've reached your AI message limit. ${resetInfo}`;
  } else if (remaining <= 3) {
    message = `Only ${remaining} AI message${remaining === 1 ? "" : "s"} remaining. ${resetInfo}`;
  } else if (shouldWarn) {
    message = `${remaining} AI messages remaining (${100 - percentUsed}% left). ${resetInfo}`;
  }

  return { shouldWarn, remaining, percentUsed, message };
}

/**
 * Format when the next month reset occurs for display
 */
function formatNextMonthReset(): string {
  const now = new Date();

  // Get the 1st of next month in UTC
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  const diffDays = Math.ceil(
    (nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) {
    return "soon";
  }
  if (diffDays === 1) {
    return "tomorrow";
  }
  if (diffDays <= 7) {
    return `in ${diffDays} days`;
  }

  // Otherwise show the date (1st of next month)
  return `on ${nextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/**
 * Get usage summary for admin panel
 */
export async function getUsageSummary(
  organizationId: string,
  periodKey?: string
): Promise<{
  periodKey: string;
  messageCount: number;
  limit: number;
  planId: string;
}> {
  const period = periodKey ?? getAiUsagePeriodKey();
  const [planId, usage] = await Promise.all([
    getOrganizationPlanId(organizationId),
    db.query.aiUsageMonthly.findFirst({
      where: and(
        eq(aiUsageMonthly.organizationId, organizationId),
        eq(aiUsageMonthly.periodKey, period)
      ),
    }),
  ]);

  return {
    periodKey: period,
    messageCount: usage?.messageCount ?? 0,
    limit: getAiMessageLimit(planId),
    planId,
  };
}
