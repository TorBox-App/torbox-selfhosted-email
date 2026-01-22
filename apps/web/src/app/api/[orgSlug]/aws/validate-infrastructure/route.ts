import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { subscription } from "@wraps/db/schema/auth";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assumeRole } from "@/lib/aws/assume-role";
import {
  detectFeaturesFromOutputs,
  findInfrastructureStack,
} from "@/lib/aws/detect-features";
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
      path: "/api/[orgSlug]/aws/validate-infrastructure",
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
    const { roleArn, externalId, region = "us-east-1" } = body;

    if (!roleArn) {
      return NextResponse.json(
        { error: "Role ARN is required" },
        { status: 400 }
      );
    }

    if (!externalId) {
      return NextResponse.json(
        { error: "External ID is required" },
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

    try {
      // Assume the customer's role using Wraps backend credentials (Vercel OIDC)
      const assumedCredentials = await assumeRole({
        roleArn,
        externalId,
        sessionName: `wraps-infrastructure-validation-${Date.now()}`,
      });

      // Try to find the infrastructure stack and get its outputs
      let detectedFeatures = null;
      let stackOutputs: Record<string, string> = {};

      try {
        const stackInfo = await findInfrastructureStack(roleArn, region, {
          accessKeyId: assumedCredentials.accessKeyId,
          secretAccessKey: assumedCredentials.secretAccessKey,
          sessionToken: assumedCredentials.sessionToken,
        });

        if (stackInfo) {
          stackOutputs = stackInfo.outputs;
          detectedFeatures = detectFeaturesFromOutputs(stackOutputs);
          log.info(
            { stackName: stackInfo.stackName, features: detectedFeatures },
            "Detected infrastructure features"
          );
        }
      } catch (stackError) {
        // Stack detection failed, but role is valid
        log.warn(
          { err: serializeError(stackError) },
          "Could not detect infrastructure stack"
        );
      }

      // Check AWS account limit before creating/updating
      const existingAccount = await db.query.awsAccount.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.organizationId, orgWithMembership.id),
            eq(table.roleArn, roleArn)
          ),
      });

      if (existingAccount) {
        // Update existing account with detected features
        await db
          .update(awsAccount)
          .set({
            accountId,
            region,
            isVerified: true,
            lastVerifiedAt: new Date(),
            updatedAt: new Date(),
            // Update feature flags from detected features
            eventTrackingEnabled:
              detectedFeatures?.eventTracking ??
              existingAccount.eventTrackingEnabled,
            eventHistoryEnabled:
              detectedFeatures?.historyStorage ??
              existingAccount.eventHistoryEnabled,
            archivingEnabled:
              detectedFeatures?.archiving ?? existingAccount.archivingEnabled,
            archiveArn:
              detectedFeatures?.archiveArn ?? existingAccount.archiveArn,
            configSetName:
              detectedFeatures?.configSetName ?? existingAccount.configSetName,
          })
          .where(eq(awsAccount.id, existingAccount.id));
      } else {
        // Check account limit for new accounts
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

        // Create new account with detected features
        await db.insert(awsAccount).values({
          organizationId: orgWithMembership.id,
          name: `AWS Account ${accountId}`,
          accountId,
          region,
          roleArn,
          // Save the actual external ID from the CloudFormation stack
          externalId,
          isVerified: true,
          lastVerifiedAt: new Date(),
          createdBy: session.user.id,
          // Set feature flags from detected features
          eventTrackingEnabled: detectedFeatures?.eventTracking ?? false,
          eventHistoryEnabled: detectedFeatures?.historyStorage ?? false,
          archivingEnabled: detectedFeatures?.archiving ?? false,
          archiveArn: detectedFeatures?.archiveArn,
          configSetName: detectedFeatures?.configSetName,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Infrastructure connected successfully",
        accountId,
        region,
        roleName,
        features: detectedFeatures,
        configSetName: stackOutputs.ConfigSetName || "wraps-email-tracking",
        tableName: stackOutputs.TableName,
      });
    } catch (error: unknown) {
      log.error(
        { err: serializeError(error) },
        "Error validating infrastructure"
      );

      // Provide user-friendly error messages
      let errorMessage = "Failed to validate AWS connection";

      if (error instanceof Error) {
        if (error.name === "AccessDenied") {
          errorMessage =
            "Access denied. The Wraps backend is not authorized to assume this role. " +
            "Please verify the CloudFormation stack deployed successfully.";
        } else if (error.name === "InvalidClientTokenId") {
          errorMessage =
            "Invalid credentials. Please check your AWS configuration.";
        } else if (error.message?.includes("not authorized to perform")) {
          errorMessage =
            "The role trust policy does not allow Wraps to assume it. " +
            "Please redeploy the CloudFormation stack.";
        }
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/aws/validate-infrastructure",
      method: "POST",
    });
    log.error(
      { err: serializeError(error) },
      "Error validating infrastructure"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
