import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { organizationExtension } from "@wraps/db/schema/app";
import { subscription } from "@wraps/db/schema/auth";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { getSetupStatus } from "@/lib/setup-status";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
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

    // Get organization extension with onboarding status
    const [extension, activeSubscription, { setupStatus }] = await Promise.all([
      db.query.organizationExtension.findFirst({
        where: eq(organizationExtension.organizationId, orgWithMembership.id),
      }),
      db.query.subscription.findFirst({
        where: and(
          eq(subscription.referenceId, orgWithMembership.id),
          or(
            eq(subscription.status, "active"),
            eq(subscription.status, "trialing")
          )
        ),
      }),
      getSetupStatus(orgWithMembership.id),
    ]);

    return NextResponse.json({
      completed: extension?.onboardingCompleted ?? false,
      completedAt: extension?.onboardingCompletedAt,
      hasAwsAccount: setupStatus.hasAwsAccount,
      hasActiveSubscription: !!activeSubscription,
      steps: {
        hasAwsAccount: setupStatus.hasAwsAccount,
        hasPlatformConnection: setupStatus.hasPlatformConnection,
        hasVerifiedDomain: setupStatus.hasVerifiedDomain,
        hasSentEmail: setupStatus.hasSentEmail,
        sandboxStatus: setupStatus.sandboxStatus,
      },
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/onboarding/status",
      method: "GET",
      orgSlug,
    });
    log.error(
      { err: serializeError(error) },
      "Error fetching onboarding status"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
