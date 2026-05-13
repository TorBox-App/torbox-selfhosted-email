"use server";

import { createServerValidate } from "@tanstack/react-form-nextjs";
import { auth } from "@wraps/auth";
import { auditLog, db } from "@wraps/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import {
  grantAccessFormOpts,
  grantAccessSchema,
} from "@/lib/forms/grant-access";
import { createActionLogger, serializeError } from "@/lib/logger";
import { checkAWSAccountAccess } from "@/lib/permissions/check-access";
import { grantAWSAccountAccess } from "@/lib/permissions/grant-access";
import { revokeAWSAccountAccess } from "@/lib/permissions/revoke-access";

// Create server validator for grant access
const serverValidateGrant = createServerValidate({
  ...grantAccessFormOpts,
  onServerValidate: ({ value }) => {
    const result = grantAccessSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message || "Validation failed";
    }
  },
});

export type GrantAccessResult =
  | { success: true }
  | { error: string; details?: string };

export async function grantAccessAction(_prev: unknown, formData: FormData) {
  try {
    // 1. Validate form data
    const validatedData = await serverValidateGrant(formData);

    // 2. Get session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: "Unauthorized" };
    }

    // 3. Get AWS account to check organization
    const awsAccountRecord = await db.query.awsAccount.findFirst({
      where: (a, { eq }) => eq(a.id, validatedData.awsAccountId),
    });

    if (!awsAccountRecord) {
      return { error: "AWS account not found" };
    }

    // 4. Check if user has manage permission on this account
    const access = await checkAWSAccountAccess({
      userId: session.user.id,
      organizationId: awsAccountRecord.organizationId,
      awsAccountId: validatedData.awsAccountId,
      permission: "manage",
    });

    if (!access.authorized) {
      return {
        error: "Access denied",
        details: access.reason,
      };
    }

    // 5. Verify target user is in the same organization
    const targetMembership = await db.query.member.findFirst({
      where: (m, { and, eq }) =>
        and(
          eq(m.userId, validatedData.userId),
          eq(m.organizationId, awsAccountRecord.organizationId)
        ),
    });

    if (!targetMembership) {
      return {
        error: "User not found in organization",
      };
    }

    // 6. Grant access + audit log atomically
    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await grantAWSAccountAccess(
        {
          userId: validatedData.userId,
          awsAccountId: validatedData.awsAccountId,
          permissions: validatedData.permissions,
          grantedBy: session.user.id,
          expiresAt: validatedData.expiresAt
            ? new Date(validatedData.expiresAt)
            : undefined,
        },
        tx
      );
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: awsAccountRecord.organizationId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "permissions.granted",
          resource: "aws_account_permission",
          resourceId: validatedData.awsAccountId,
          metadata: {
            awsAccountId: validatedData.awsAccountId,
            targetUserId: validatedData.userId,
            permissions: validatedData.permissions,
          },
        })
      );
    });

    // 7. Revalidate
    revalidatePath("/");
    revalidatePath(`/${awsAccountRecord.organizationId}`);

    return { success: true } as const;
  } catch (e) {
    // Handle TanStack Form validation errors
    if (
      e &&
      typeof e === "object" &&
      "formState" in e &&
      typeof (e as { formState?: unknown }).formState === "object"
    ) {
      return (e as { formState: unknown }).formState;
    }

    // Handle other errors
    const message = e instanceof Error ? e.message : "Internal error";
    const log = createActionLogger("grantAccessAction", {});
    log.error({ err: serializeError(e) }, "Failed to grant access");
    return { error: "Internal error", details: message };
  }
}

export type RevokeAccessResult =
  | { success: true }
  | { error: string; details?: string };

export async function revokeAccessAction(
  userId: string,
  awsAccountId: string
): Promise<RevokeAccessResult> {
  try {
    // 1. Get session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: "Unauthorized" };
    }

    // 2. Get AWS account to check organization
    const awsAccountRecord = await db.query.awsAccount.findFirst({
      where: (a, { eq }) => eq(a.id, awsAccountId),
    });

    if (!awsAccountRecord) {
      return { error: "AWS account not found" };
    }

    // 3. Check if user has manage permission
    const access = await checkAWSAccountAccess({
      userId: session.user.id,
      organizationId: awsAccountRecord.organizationId,
      awsAccountId,
      permission: "manage",
    });

    if (!access.authorized) {
      return {
        error: "Access denied",
        details: access.reason,
      };
    }

    // 4. Revoke access + audit log atomically
    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await revokeAWSAccountAccess({ userId, awsAccountId }, tx);
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: awsAccountRecord.organizationId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "permissions.revoked",
          resource: "aws_account_permission",
          resourceId: awsAccountId,
          metadata: {
            awsAccountId,
            targetUserId: userId,
          },
        })
      );
    });

    // 5. Revalidate
    revalidatePath("/");
    revalidatePath(`/${awsAccountRecord.organizationId}`);

    return { success: true };
  } catch (error) {
    const log = createActionLogger("revokeAccessAction", {});
    log.error(
      { err: serializeError(error), userId, awsAccountId },
      "Failed to revoke access"
    );
    return { error: "Something went wrong. Please try again." };
  }
}
