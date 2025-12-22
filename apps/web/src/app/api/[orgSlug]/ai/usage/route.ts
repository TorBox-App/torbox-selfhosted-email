import { auth } from "@wraps/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { checkAiUsageLimit, getUsageWarning } from "@/lib/usage/ai-usage";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

/**
 * GET /api/[orgSlug]/ai/usage - Get current AI usage status
 *
 * AI usage is tracked per calendar month and resets on the 1st.
 * This ensures all users (including annual billing) get monthly resets.
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
    const usage = await checkAiUsageLimit(orgWithMembership.id);
    const warning = getUsageWarning(usage.current, usage.limit);

    return NextResponse.json({
      current: usage.current,
      limit: usage.limit,
      remaining: warning.remaining,
      percentUsed: warning.percentUsed,
      planId: usage.planId,
      warning: warning.shouldWarn ? warning.message : null,
    });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/ai/usage",
      method: "GET",
    });
    log.error({ err: serializeError(error) }, "Error fetching AI usage");
    return NextResponse.json(
      { error: "Failed to fetch AI usage" },
      { status: 500 }
    );
  }
}
