import { auth } from "@wraps/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import {
  checkMessageUsageLimit,
  getMessageUsageWarning,
} from "@/lib/usage/message-usage";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

/**
 * GET /api/[orgSlug]/messages/usage - Get email/SMS delivery count (analytics only)
 *
 * Email and SMS sends are NOT plan-gated — users pay AWS directly.
 * This endpoint returns delivery counts for display purposes only.
 * Plan limits apply only to behavioral events (/api/[orgSlug]/events/usage).
 *
 * Count resets on the 1st of each calendar month.
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
    const usage = await checkMessageUsageLimit(orgWithMembership.id);
    const warning = getMessageUsageWarning(
      usage.current,
      usage.limit,
      usage.threshold
    );

    return NextResponse.json({
      current: usage.current,
      limit: usage.limit,
      remaining: Math.max(
        0,
        usage.limit === -1 ? -1 : usage.limit - usage.current
      ),
      percentUsed: usage.percentUsed,
      planId: usage.planId,
      threshold: usage.threshold,
      warning: warning.message,
      action: warning.action,
    });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/messages/usage",
      method: "GET",
    });
    log.error({ err: error }, "Error fetching message usage");
    return NextResponse.json(
      { error: "Failed to fetch message usage" },
      { status: 500 }
    );
  }
}
