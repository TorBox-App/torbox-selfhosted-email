import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { organizationExtension } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { computeActivationScore } from "@/lib/activation-tracking";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [{ score, milestones }, extension] = await Promise.all([
      computeActivationScore(orgWithMembership.id),
      db.query.organizationExtension.findFirst({
        where: eq(organizationExtension.organizationId, orgWithMembership.id),
      }),
    ]);

    return NextResponse.json({
      score,
      milestones,
      onboardingPath: extension?.onboardingPath ?? null,
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/activation/status",
      method: "GET",
      orgSlug,
    });
    log.error(
      { err: serializeError(error) },
      "Error fetching activation status"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
