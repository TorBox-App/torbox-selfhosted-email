import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
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

    // Query AWS account connections for this organization
    const connections = await db
      .select({
        id: awsAccount.id,
        accountId: awsAccount.accountId,
        name: awsAccount.name,
        region: awsAccount.region,
        isVerified: awsAccount.isVerified,
        emailEnabled: awsAccount.emailEnabled,
        createdAt: awsAccount.createdAt,
      })
      .from(awsAccount)
      .where(eq(awsAccount.organizationId, orgWithMembership.id));

    return NextResponse.json({
      connections: connections.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const orgSlug = (await context.params).orgSlug;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/connections",
      method: "GET",
      orgSlug,
    });
    log.error({ err: serializeError(error) }, "Error fetching connections");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
