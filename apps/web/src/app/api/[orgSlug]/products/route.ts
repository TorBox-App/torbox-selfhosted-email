import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { queryEmailEvents } from "@/lib/aws/dynamodb";
import { getSMSPhoneNumbers } from "@/lib/aws/sms-voice";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export type ProductStatus = {
  id: "email" | "sms";
  name: string;
  enabled: boolean;
  hasInfrastructure: boolean;
  needsRoleUpdate: boolean;
};

export type ProductsStatusResponse = {
  products: ProductStatus[];
  hasAwsAccounts: boolean;
};

/**
 * Checks if SMS infrastructure is deployed for any of the given AWS accounts.
 * Returns true if any account has phone numbers registered.
 */
async function checkSMSInfrastructure(
  accountIds: string[]
): Promise<{ hasInfrastructure: boolean; needsRoleUpdate: boolean }> {
  for (const accountId of accountIds) {
    try {
      const phoneNumbers = await getSMSPhoneNumbers(accountId);
      if (phoneNumbers.length > 0) {
        return { hasInfrastructure: true, needsRoleUpdate: false };
      }
    } catch (error) {
      // If we get an access denied error, the role doesn't have SMS permissions
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("AccessDenied") ||
        errorMessage.includes("not authorized")
      ) {
        return { hasInfrastructure: false, needsRoleUpdate: true };
      }
      // Other errors (like no infrastructure) - continue checking other accounts
    }
  }
  return { hasInfrastructure: false, needsRoleUpdate: false };
}

/**
 * Checks if Email infrastructure is deployed for any of the given AWS accounts.
 * Tries to query the wraps-email-history DynamoDB table to detect infrastructure.
 */
async function checkEmailInfrastructure(
  accountIds: string[]
): Promise<{ hasInfrastructure: boolean; needsRoleUpdate: boolean }> {
  for (const accountId of accountIds) {
    try {
      // Try to query the email history table - this will succeed if table exists
      // and role has permissions, fail with ResourceNotFoundException if no table,
      // or fail with AccessDenied if role lacks permissions
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      await queryEmailEvents({
        awsAccountId: accountId,
        startTime: oneDayAgo,
        endTime: now,
        limit: 1, // Just check if we can query, don't need actual data
      });
      // If we get here, table exists and we have access
      return { hasInfrastructure: true, needsRoleUpdate: false };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "";

      // AccessDenied means role exists but lacks email permissions
      if (
        errorMessage.includes("AccessDenied") ||
        errorMessage.includes("not authorized")
      ) {
        return { hasInfrastructure: false, needsRoleUpdate: true };
      }

      // ResourceNotFoundException means no DynamoDB table (no email infrastructure)
      if (
        errorName === "ResourceNotFoundException" ||
        errorMessage.includes("Requested resource not found")
      ) {
        // Continue checking other accounts
        continue;
      }

      // Other errors - continue checking other accounts
    }
  }
  return { hasInfrastructure: false, needsRoleUpdate: false };
}

export async function GET(request: Request, context: RouteContext) {
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

    // Get all AWS accounts for this organization
    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
    });

    if (accounts.length === 0) {
      return NextResponse.json<ProductsStatusResponse>({
        products: [
          {
            id: "email",
            name: "Email",
            enabled: false,
            hasInfrastructure: false,
            needsRoleUpdate: false,
          },
          {
            id: "sms",
            name: "SMS",
            enabled: false,
            hasInfrastructure: false,
            needsRoleUpdate: false,
          },
        ],
        hasAwsAccounts: false,
      });
    }

    const accountIds = accounts.map((a) => a.id);

    // Check infrastructure for each product
    const [emailStatus, smsStatus] = await Promise.all([
      checkEmailInfrastructure(accountIds),
      checkSMSInfrastructure(accountIds),
    ]);

    const products: ProductStatus[] = [
      {
        id: "email",
        name: "Email",
        enabled: emailStatus.hasInfrastructure,
        hasInfrastructure: emailStatus.hasInfrastructure,
        needsRoleUpdate: emailStatus.needsRoleUpdate,
      },
      {
        id: "sms",
        name: "SMS",
        enabled: smsStatus.hasInfrastructure,
        hasInfrastructure: smsStatus.hasInfrastructure,
        needsRoleUpdate: smsStatus.needsRoleUpdate,
      },
    ];

    return NextResponse.json<ProductsStatusResponse>({
      products,
      hasAwsAccounts: true,
    });
  } catch (error) {
    console.error("Error fetching products status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
