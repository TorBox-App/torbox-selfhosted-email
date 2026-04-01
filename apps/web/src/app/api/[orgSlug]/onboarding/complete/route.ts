import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { organizationExtension } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { trackOnboardingCompleted } from "@/lib/activation-tracking";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
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

    // Parse optional body for onboarding path
    let onboardingPath: string | undefined;
    try {
      const body = await request.json();
      if (body?.path === "start_building" || body?.path === "connect_aws") {
        onboardingPath = body.path;
      }
    } catch {
      // No body or invalid JSON — that's fine, path is optional
    }

    // Check if extension exists
    const existingExtension = await db.query.organizationExtension.findFirst({
      where: eq(organizationExtension.organizationId, orgWithMembership.id),
    });

    // If onboarding is already completed, return success without re-emitting events
    if (existingExtension?.onboardingCompleted) {
      return NextResponse.json({
        success: true,
        message: "Onboarding already completed",
      });
    }

    if (existingExtension) {
      // Update existing extension
      await db
        .update(organizationExtension)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          ...(onboardingPath && { onboardingPath }),
          updatedAt: new Date(),
        })
        .where(eq(organizationExtension.organizationId, orgWithMembership.id));
    } else {
      // Create new extension
      await db.insert(organizationExtension).values({
        organizationId: orgWithMembership.id,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        ...(onboardingPath && { onboardingPath }),
      });
    }

    // Emit onboarding.completed event to trigger workflows (e.g. activation drip)
    await trackOnboardingCompleted(session.user.email, orgWithMembership.id, {
      path: onboardingPath as "start_building" | "connect_aws" | undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
    });
  } catch (error) {
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
