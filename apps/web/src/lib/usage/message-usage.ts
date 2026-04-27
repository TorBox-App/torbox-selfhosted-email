import { db } from "@wraps/db";
import { messageUsageMonthly } from "@wraps/db/schema/usage";
import { and, eq, sql } from "drizzle-orm";
import { getOrganizationPlanId } from "@/lib/organization";

// ═══════════════════════════════════════════════════════════════════════════
// PERIOD KEY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the period key for message usage tracking.
 *
 * Uses calendar month (YYYY-MM format) for message limits.
 * This ensures all users get their message limit reset each calendar month.
 */
export function getMessageUsagePeriodKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// USAGE QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current message usage for an organization in the current calendar month.
 * This is the fast path - single indexed query.
 */
export async function getMessageUsageCount(
  organizationId: string
): Promise<number> {
  const periodKey = getMessageUsagePeriodKey();

  const usage = await db.query.messageUsageMonthly.findFirst({
    where: and(
      eq(messageUsageMonthly.organizationId, organizationId),
      eq(messageUsageMonthly.periodKey, periodKey)
    ),
  });

  return usage?.messageCount ?? 0;
}

/**
 * Get email delivery count for an organization — analytics only.
 * Email sends are never plan-gated (users pay AWS directly).
 * Plan limits apply only to behavioral events (event_usage_monthly).
 */
export async function checkMessageUsageLimit(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  planId: string;
  percentUsed: number;
  threshold: "normal" | "warning" | "critical" | "exceeded";
}> {
  const [planId, currentUsage] = await Promise.all([
    getOrganizationPlanId(organizationId),
    getMessageUsageCount(organizationId),
  ]);

  return {
    allowed: true,
    current: currentUsage,
    limit: -1,
    planId,
    percentUsed: 0,
    threshold: "normal",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// USAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Increment message usage count for an organization.
 * Uses upsert pattern for atomicity.
 *
 * @param organizationId - The organization ID
 * @param count - Number of messages to add (default 1)
 * @returns The new total message count for this period
 */
export async function incrementMessageUsage(
  organizationId: string,
  count = 1
): Promise<number> {
  const periodKey = getMessageUsagePeriodKey();

  // Use upsert with ON CONFLICT to atomically increment
  const result = await db
    .insert(messageUsageMonthly)
    .values({
      organizationId,
      periodKey,
      messageCount: count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        messageUsageMonthly.organizationId,
        messageUsageMonthly.periodKey,
      ],
      set: {
        messageCount: sql`${messageUsageMonthly.messageCount} + ${count}`,
        updatedAt: new Date(),
      },
    })
    .returning({ messageCount: messageUsageMonthly.messageCount });

  return result[0]?.messageCount ?? count;
}

// ═══════════════════════════════════════════════════════════════════════════
// WARNING MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get warning info based on current message usage.
 * Message usage resets on the 1st of each calendar month.
 */
export function getMessageUsageWarning(
  current: number,
  limit: number,
  threshold: "normal" | "warning" | "critical" | "exceeded"
): {
  message: string | null;
  action: "upgrade" | "view_usage" | null;
} {
  // No warning for unlimited plans
  if (limit === -1) {
    return { message: null, action: null };
  }

  const remaining = Math.max(0, limit - current);
  const percentUsed = Math.round((current / limit) * 100);
  const resetInfo = `Resets ${formatNextMonthReset()}.`;

  switch (threshold) {
    case "exceeded":
      return {
        message: `Message limit exceeded (${percentUsed}% used). New messages are blocked until ${formatNextMonthReset()} or you upgrade.`,
        action: "upgrade",
      };
    case "critical":
      return {
        message: `You've reached your monthly message limit of ${limit.toLocaleString()}. ${resetInfo}`,
        action: "upgrade",
      };
    case "warning":
      return {
        message: `${remaining.toLocaleString()} messages remaining (${100 - percentUsed}% left). ${resetInfo}`,
        action: "view_usage",
      };
    default:
      return { message: null, action: null };
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// USAGE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get complete message usage summary for an organization.
 * Used for billing page and usage dashboards.
 */
export async function getMessageUsageSummary(
  organizationId: string,
  periodKey?: string
): Promise<{
  periodKey: string;
  messageCount: number;
  limit: number;
  planId: string;
  percentUsed: number;
  threshold: "normal" | "warning" | "critical" | "exceeded";
  remaining: number;
}> {
  const period = periodKey ?? getMessageUsagePeriodKey();
  const [planId, usage] = await Promise.all([
    getOrganizationPlanId(organizationId),
    db.query.messageUsageMonthly.findFirst({
      where: and(
        eq(messageUsageMonthly.organizationId, organizationId),
        eq(messageUsageMonthly.periodKey, period)
      ),
    }),
  ]);

  const messageCount = usage?.messageCount ?? 0;

  return {
    periodKey: period,
    messageCount,
    limit: -1,
    planId,
    percentUsed: 0,
    threshold: "normal",
    remaining: -1,
  };
}
