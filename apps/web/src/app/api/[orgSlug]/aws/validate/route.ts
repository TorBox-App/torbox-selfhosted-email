import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { subscription } from "@wraps/db/schema/auth";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import { canAddAwsAccount, getAwsAccountLimitMessage } from "@/lib/plans";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/aws/validate",
      method: "POST",
      orgSlug,
    });

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

    // Parse request body
    const body = await request.json();
    const { roleArn, externalId } = body;

    if (!(roleArn && externalId)) {
      return NextResponse.json(
        { error: "Role ARN and External ID are required" },
        { status: 400 }
      );
    }

    // Validate role ARN format
    const roleArnRegex = /^arn:aws:iam::(\d{12}):role\/(.+)$/;
    const match = roleArn.match(roleArnRegex);

    if (!match) {
      return NextResponse.json(
        { error: "Invalid IAM Role ARN format" },
        { status: 400 }
      );
    }

    const accountId = match[1];
    const roleName = match[2];

    // Extract region from role ARN or use default
    // For cross-account roles, region is typically us-east-1 for STS
    const stsClient = new STSClient({ region: "us-east-1" });

    try {
      // Test the role assumption
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `wraps-onboarding-validation-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 900, // 15 minutes (minimum)
      });

      await stsClient.send(assumeRoleCommand);

      // Role assumption successful - save the connection
      const existingAccount = await db.query.awsAccount.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.organizationId, orgWithMembership.id),
            eq(table.externalId, externalId)
          ),
      });

      if (existingAccount) {
        // Update existing account
        await db
          .update(awsAccount)
          .set({
            roleArn,
            accountId,
            isVerified: true,
            lastVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(awsAccount.id, existingAccount.id));
      } else {
        // Check AWS account limit before creating a new account
        const activeSubscription = await db.query.subscription.findFirst({
          where: and(
            eq(subscription.referenceId, orgWithMembership.id),
            or(
              eq(subscription.status, "active"),
              eq(subscription.status, "trialing")
            )
          ),
        });

        const existingAccountCount = await db.query.awsAccount.findMany({
          where: (table, { eq }) =>
            eq(table.organizationId, orgWithMembership.id),
        });

        const planId = activeSubscription?.plan || "starter";
        if (!canAddAwsAccount(planId, existingAccountCount.length)) {
          return NextResponse.json(
            {
              error: "AWS account limit reached",
              message: getAwsAccountLimitMessage(planId),
              limitReached: true,
            },
            { status: 403 }
          );
        }

        // Create new account
        await db.insert(awsAccount).values({
          organizationId: orgWithMembership.id,
          name: `AWS Account ${accountId}`,
          accountId,
          region: "us-east-1", // Default region
          roleArn,
          externalId,
          isVerified: true,
          lastVerifiedAt: new Date(),
          createdBy: session.user.id,
        });
      }

      return NextResponse.json({
        success: true,
        message: "AWS account connected successfully",
        accountId,
        roleName,
      });
    } catch (error: any) {
      log.error({ err: serializeError(error) }, "Error assuming role");

      // Provide user-friendly error messages
      let errorMessage = "Failed to validate AWS connection";

      if (error.name === "AccessDenied") {
        errorMessage =
          "Access denied. Please verify the External ID matches the CloudFormation stack output.";
      } else if (error.name === "InvalidClientTokenId") {
        errorMessage =
          "Invalid credentials. Please check your AWS configuration.";
      } else if (error.message?.includes("not authorized to perform")) {
        errorMessage =
          "The role does not have permission to be assumed. Please check the trust policy.";
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/aws/validate",
      method: "POST",
    });
    log.error(
      { err: serializeError(error) },
      "Error validating AWS connection"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
