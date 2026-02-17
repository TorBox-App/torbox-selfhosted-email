import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { organizationExtension } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { trackOnboardingCompleted } from "@/lib/activation-tracking";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
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

    // Check if extension exists
    const existingExtension = await db.query.organizationExtension.findFirst({
      where: eq(organizationExtension.organizationId, orgWithMembership.id),
    });

    if (existingExtension) {
      // Update existing extension
      await db
        .update(organizationExtension)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(organizationExtension.organizationId, orgWithMembership.id));
    } else {
      // Create new extension
      await db.insert(organizationExtension).values({
        organizationId: orgWithMembership.id,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      });
    }

    // Emit onboarding.completed event to trigger workflows (e.g. activation drip)
    await trackOnboardingCompleted(session.user.email, orgWithMembership.id);

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/onboarding/complete",
      method: "POST",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error completing onboarding");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
