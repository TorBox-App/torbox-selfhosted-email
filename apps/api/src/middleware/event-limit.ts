/**
 * Event Usage Limit Middleware
 *
 * Enforces monthly event limits based on plan tier.
 * Uses soft caps with 25% grace period before hard blocking.
 *
 * Thresholds:
 * - 80%: Dashboard warning (not blocked)
 * - 100%: Critical warning, email notification
 * - 125%: Hard block with 429 response
 */

import { and, db, eq, eventUsageMonthly, sqlExpr as sql } from "@wraps/db";
import { Elysia } from "elysia";

import type { AuthContext } from "./auth";

// Tracked event limits per plan (tracked events per month)
const EVENT_LIMITS = {
  starter: 50_000,
  pro: 250_000, // Growth tier (now named "pro" in DB)
  growth: 1_000_000, // Scale tier (now named "growth" in DB)
  scale: -1, // Enterprise: unlimited
} as const;

/**
 * Get period key for current month (YYYY-MM format)
 */
function getPeriodKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get current event usage count for an organization
 */
async function getEventUsageCount(organizationId: string): Promise<number> {
  const periodKey = getPeriodKey();

  const [usage] = await db
    .select({ eventCount: eventUsageMonthly.eventCount })
    .from(eventUsageMonthly)
    .where(
      and(
        eq(eventUsageMonthly.organizationId, organizationId),
        eq(eventUsageMonthly.periodKey, periodKey)
      )
    )
    .limit(1);

  return usage?.eventCount ?? 0;
}

/**
 * Increment event usage count (called after successful event ingestion)
 */
export async function incrementEventUsage(
  organizationId: string,
  count = 1
): Promise<number> {
  const periodKey = getPeriodKey();

  const result = await db
    .insert(eventUsageMonthly)
    .values({
      organizationId,
      periodKey,
      eventCount: count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [eventUsageMonthly.organizationId, eventUsageMonthly.periodKey],
      set: {
        eventCount: sql`${eventUsageMonthly.eventCount} + ${count}`,
        updatedAt: new Date(),
      },
    })
    .returning({ eventCount: eventUsageMonthly.eventCount });

  return result[0]?.eventCount ?? count;
}

/**
 * Calculate 2-year TTL for event records (used in events route)
 */
export function getEventTTLExpiration(): Date {
  const ttl = new Date();
  ttl.setFullYear(ttl.getFullYear() + 2);
  return ttl;
}

/**
 * Event limit middleware
 *
 * Checks current event usage against plan limits.
 * Sets response headers with usage info.
 * Returns 429 if over 125% limit (hard block).
 */
export const eventLimitMiddleware = new Elysia({ name: "event-limit" }).derive(
  async (ctx) => {
    const auth = (ctx as unknown as { auth: AuthContext }).auth;

    if (!auth) {
      // Auth middleware should have already set this
      return {};
    }

    const { set } = ctx;
    const { organizationId, planId } = auth;

    // Get limit for this plan
    const limit =
      EVENT_LIMITS[planId as keyof typeof EVENT_LIMITS] ?? EVENT_LIMITS.starter;

    // Unlimited plans skip the check
    if (limit === -1) {
      set.headers["X-Event-Limit"] = "unlimited";
      return {};
    }

    try {
      const currentUsage = await getEventUsageCount(organizationId);
      const percentUsed = Math.round((currentUsage / limit) * 100);
      const remaining = Math.max(0, limit - currentUsage);
      const graceLimit = Math.floor(limit * 1.25); // 25% grace period

      // Set usage headers
      set.headers["X-Event-Limit"] = String(limit);
      set.headers["X-Event-Current"] = String(currentUsage);
      set.headers["X-Event-Remaining"] = String(remaining);
      set.headers["X-Event-Percent"] = String(percentUsed);

      // Hard block at 125%
      if (currentUsage >= graceLimit) {
        set.status = 429;
        set.headers["X-Event-Exceeded"] = "true";
        set.headers["Retry-After"] = String(getSecondsUntilNextMonth());

        throw new Error(
          JSON.stringify({
            error: "event_limit_exceeded",
            message: `Monthly event limit exceeded (${percentUsed}% used). Upgrade your plan to continue ingesting events.`,
            upgradeUrl: "https://app.wraps.dev/settings/billing",
            current: currentUsage,
            limit,
            percentUsed,
            resetsAt: getNextMonthResetDate().toISOString(),
          })
        );
      }

      // Log warning at 100% (but don't block)
      if (currentUsage >= limit) {
        console.log(
          `[EVENT-LIMIT] Organization ${organizationId} at ${percentUsed}% of event limit (${currentUsage}/${limit})`
        );
      }
    } catch (error) {
      // Re-throw limit exceeded errors
      if (
        error instanceof Error &&
        error.message.includes("event_limit_exceeded")
      ) {
        throw error;
      }

      // Log other errors but fail open
      console.error("[EVENT-LIMIT] Error checking event limit:", error);
    }

    return {};
  }
);

/**
 * Get seconds until the 1st of next month (for Retry-After header)
 */
function getSecondsUntilNextMonth(): number {
  const now = new Date();
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
  );
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);
}

/**
 * Get the Date object for the 1st of next month
 */
function getNextMonthResetDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
  );
}
