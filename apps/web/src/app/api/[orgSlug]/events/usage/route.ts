import { auth } from "@wraps/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import {
  checkEventUsageLimit,
  getEventUsageWarning,
} from "@/lib/usage/event-usage";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

/**
 * GET /api/[orgSlug]/events/usage - Get current event usage status
 *
 * Event usage is tracked per calendar month and resets on the 1st.
 *
 * Event limits (2026 pricing model):
 * - Starter: 50,000 events/month
 * - Growth: 250,000 events/month
 * - Scale: 1,000,000 events/month
 * - Enterprise: Unlimited
 *
 * Thresholds:
 * - 80%: warning
 * - 100%: critical (banner + email)
 * - 125%: exceeded (hard block)
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify organization membership
    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get usage info (tracked per calendar month)
    const usage = await checkEventUsageLimit(orgWithMembership.id);
    const warning = getEventUsageWarning(
      usage.current,
      usage.limit,
      usage.threshold
    );

    return NextResponse.json({
      current: usage.current,
      limit: usage.limit,
      remaining: Math.max(0, usage.limit === -1 ? -1 : usage.limit - usage.current),
      percentUsed: usage.percentUsed,
      planId: usage.planId,
      threshold: usage.threshold,
      warning: warning.message,
      action: warning.action,
    });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/events/usage",
      method: "GET",
    });
    log.error({ err: serializeError(error) }, "Error fetching event usage");
    return NextResponse.json(
      { error: "Failed to fetch event usage" },
      { status: 500 }
    );
  }
}
