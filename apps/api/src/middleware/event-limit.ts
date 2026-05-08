/**
 * Event Usage Limit Middleware
 *
 * Enforces monthly event limits based on plan tier.
 * Uses soft caps with 25% grace period before hard blocking.
 *
 * Thresholds:
 * - 100%: Warning logged
 * - 125%: Hard block with 429 response
 *
 * Usage: call applyEventLimit(app) on the Elysia instance that owns your
 * routes. Do NOT wrap in a plugin — Elysia 1.4 does not propagate plugin
 * hooks to parent route instances.
 */

import { and, db, eq, eventUsageMonthly, sqlExpr as sql } from "@wraps/db";

import { log } from "../lib/logger";
import type { AuthContext } from "./auth";

// Tracked event limits per plan (tracked events per month)
// Aligned with apps/web/src/lib/plans.ts
const EVENT_LIMITS = {
  free: 5000,
  starter: 50_000,
  growth: 250_000,
  scale: 1_000_000,
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
 * onBeforeHandle callback that enforces monthly event limits.
 *
 * Add directly to the Elysia instance that owns your routes:
 *   createAuthenticatedRoutes("/v1/events").onBeforeHandle(enforceEventLimit).post(...)
 *
 * Elysia 1.4 does not propagate plugin hooks to parent route instances, so
 * this must be added inline — not wrapped in a plugin and .use()-d.
 */
// biome-ignore lint/suspicious/noExplicitAny: ctx shape varies across Elysia route instances
export async function enforceEventLimit(ctx: any) {
  const auth = (ctx as { auth: AuthContext }).auth;
  if (!auth) return;

  const { set } = ctx;
  const { organizationId, planId } = auth;
  const limit =
    EVENT_LIMITS[planId as keyof typeof EVENT_LIMITS] ?? EVENT_LIMITS.free;

  try {
    const currentUsage = await getEventUsageCount(organizationId);
    const percentUsed = Math.round((currentUsage / limit) * 100);
    const remaining = Math.max(0, limit - currentUsage);
    const graceLimit = Math.floor(limit * 1.25);

    set.headers["X-Event-Limit"] = String(limit);
    set.headers["X-Event-Current"] = String(currentUsage);
    set.headers["X-Event-Remaining"] = String(remaining);
    set.headers["X-Event-Percent"] = String(percentUsed);

    if (currentUsage >= graceLimit) {
      set.status = 429;
      set.headers["X-Event-Exceeded"] = "true";
      set.headers["Retry-After"] = String(getSecondsUntilNextMonth());
      return {
        error: "event_limit_exceeded",
        message: `Monthly event limit exceeded (${percentUsed}% used). Upgrade your plan to continue ingesting events.`,
        upgradeUrl: "https://app.wraps.dev/settings/billing",
        current: currentUsage,
        limit,
        percentUsed,
        resetsAt: getNextMonthResetDate().toISOString(),
      };
    }

    if (currentUsage >= limit) {
      log.warn("Event limit reached", {
        organizationId,
        percentUsed,
        currentUsage,
        limit,
      });
    }
  } catch (error) {
    log.error("Event limit check failed", error, { organizationId });
    // fail open — a DB error here should not block event ingestion
  }
}

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
