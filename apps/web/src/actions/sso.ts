"use server";

import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@wraps/auth";
import { and, auditLog, db, eq, ssoProvider, verification } from "@wraps/db";
import { gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { verifyOrgAccess } from "@/actions/shared/verify-org-access";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import { createActionLogger, serializeError } from "@/lib/logger";
import { checkPermission } from "./shared/permissions";

type SsoScimApi = {
  registerSSOProvider(opts: {
    body: {
      providerId: string;
      issuer: string;
      domain: string;
      organizationId: string;
      oidcConfig: { clientId: string; clientSecret: string };
    };
    headers: Headers;
  }): Promise<void>;
  deleteSSOProvider(opts: {
    body: { providerId: string };
    headers: Headers;
  }): Promise<void>;
  requestDomainVerification(opts: {
    body: { providerId: string };
    headers: Headers;
  }): Promise<{ domainVerificationToken: string }>;
  verifyDomain(opts: {
    body: { providerId: string };
    headers: Headers;
  }): Promise<void>;
  generateSCIMToken(opts: {
    body: { providerId: string; organizationId: string };
    headers: Headers;
  }): Promise<{ scimToken: string }>;
};

const ssoApi = auth.api as unknown as SsoScimApi;

async function requireProviderOwnership(orgId: string, providerId: string) {
  return db.query.ssoProvider.findFirst({
    where: and(
      eq(ssoProvider.providerId, providerId),
      eq(ssoProvider.organizationId, orgId)
    ),
  });
}

type SaveSsoProviderInput = {
  domain: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
};

export type SaveSsoProviderResult =
  | { success: true }
  | { success: false; error: string };

export async function saveSsoProvider(
  orgId: string,
  data: SaveSsoProviderInput
): Promise<SaveSsoProviderResult> {
  try {
    const access = await verifyOrgAccess(orgId);
    if (!access) return { success: false, error: "Unauthorized" };
    const ssoWriteError = checkPermission(access.role, "sso", ["write"]);
    if (ssoWriteError) return ssoWriteError;

    const hdrs = await import("next/headers").then((m) => m.headers());
    await ssoApi.registerSSOProvider({
      body: {
        providerId: data.domain,
        issuer: data.issuer,
        domain: data.domain,
        organizationId: orgId,
        oidcConfig: {
          clientId: data.clientId,
          clientSecret: data.clientSecret,
        },
      },
      headers: hdrs,
    });

    getAuditContext()
      .then((auditCtx) =>
        db.insert(auditLog).values(
          auditLogEntry(auditCtx, {
            organizationId: orgId,
            actorId: access.userId,
            actorEmail: access.userEmail,
            action: "sso.provider_saved",
            resource: "sso_provider",
            metadata: { domain: data.domain, issuer: data.issuer },
          })
        )
      )
      .catch(() => {});

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    return { success: true };
  } catch (error) {
    const log = createActionLogger("saveSsoProvider", { orgSlug: orgId });
    log.error({ err: serializeError(error) }, "Failed to save SSO provider");
    Sentry.captureException(error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export type DeleteSsoProviderResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteSsoProvider(
  orgId: string,
  providerId: string
): Promise<DeleteSsoProviderResult> {
  try {
    const access = await verifyOrgAccess(orgId);
    if (!access) return { success: false, error: "Unauthorized" };
    const ssoWriteError = checkPermission(access.role, "sso", ["write"]);
    if (ssoWriteError) return ssoWriteError;

    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    await ssoApi.deleteSSOProvider({
      body: { providerId },
      headers: hdrs,
    });

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "sso.provider_deleted",
          resource: "sso_provider",
          resourceId: providerId,
          metadata: { providerId },
        })
      );
    });

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    return { success: true };
  } catch (error) {
    const log = createActionLogger("deleteSsoProvider", { orgSlug: orgId });
    log.error({ err: serializeError(error) }, "Failed to delete SSO provider");
    Sentry.captureException(error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export type RequestDomainVerificationResult =
  | { success: true; token: string; expiresAt: string }
  | { success: false; error: string };

export async function requestDomainVerification(
  orgId: string,
  providerId: string
): Promise<RequestDomainVerificationResult> {
  try {
    const access = await verifyOrgAccess(orgId);
    if (!access) return { success: false, error: "Unauthorized" };
    const permError = checkPermission(access.role, "sso", ["write"]);
    if (permError) return permError;

    const provider = await requireProviderOwnership(orgId, providerId);
    if (!provider) return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const result = await ssoApi.requestDomainVerification({
      body: { providerId },
      headers: hdrs,
    });

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "sso.domain_verification_requested",
          resource: "sso_provider",
          resourceId: providerId,
          metadata: { domain: provider.domain },
        })
      );
    });

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    return { success: true, token: result.domainVerificationToken, expiresAt };
  } catch (error) {
    const log = createActionLogger("requestDomainVerification", {
      orgSlug: orgId,
    });
    log.error(
      { err: serializeError(error) },
      "Failed to request domain verification"
    );
    Sentry.captureException(error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export type VerifyDomainResult =
  | { success: true }
  | { success: false; error: string };

export async function verifyDomain(
  orgId: string,
  providerId: string
): Promise<VerifyDomainResult> {
  try {
    const access = await verifyOrgAccess(orgId);
    if (!access) return { success: false, error: "Unauthorized" };
    const permError = checkPermission(access.role, "sso", ["write"]);
    if (permError) return permError;

    const provider = await requireProviderOwnership(orgId, providerId);
    if (!provider) return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    await ssoApi.verifyDomain({
      body: { providerId },
      headers: hdrs,
    });

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "sso.domain_verified",
          resource: "sso_provider",
          resourceId: providerId,
          metadata: { domain: provider.domain },
        })
      );
    });

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    return { success: true };
  } catch (error) {
    const log = createActionLogger("verifyDomain", { orgSlug: orgId });
    log.error({ err: serializeError(error) }, "Failed to verify domain");
    Sentry.captureException(error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export type GetExistingVerificationTokenResult = {
  token: string;
  expiresAt: string;
} | null;

export async function getExistingVerificationToken(
  orgId: string,
  providerId: string
): Promise<GetExistingVerificationTokenResult> {
  const access = await verifyOrgAccess(orgId);
  if (!access) return null;
  if (checkPermission(access.role, "sso", ["write"])) return null;
  if (!(await requireProviderOwnership(orgId, providerId))) return null;

  const identifier = `_better-auth-token-${providerId}`;
  const pending = await db.query.verification.findFirst({
    where: and(
      eq(verification.identifier, identifier),
      gt(verification.expiresAt, new Date())
    ),
  });
  if (!pending) return null;
  return { token: pending.value, expiresAt: pending.expiresAt.toISOString() };
}

export type VerifyDomainViaSESResult =
  | { success: true }
  | { success: false; error: string };

export async function verifyDomainViaSES(
  orgId: string,
  providerId: string
): Promise<VerifyDomainViaSESResult> {
  const log = createActionLogger("verifyDomainViaSES", { orgSlug: orgId });
  try {
    const access = await verifyOrgAccess(orgId);
    if (!access) return { success: false, error: "Unauthorized" };
    const permError = checkPermission(access.role, "sso", ["write"]);
    if (permError) return permError;

    const provider = await requireProviderOwnership(orgId, providerId);
    if (!provider) return { success: false, error: "Provider not found" };
    if (provider.domainVerified)
      return { success: false, error: "Domain is already verified" };

    const accounts = await db.query.awsAccount.findMany({
      where: (a, { eq: eqOp }) => eqOp(a.organizationId, orgId),
    });

    if (!accounts.length)
      return {
        success: false,
        error:
          "No AWS accounts connected. Add an AWS account to use this verification method.",
      };

    for (const account of accounts) {
      try {
        const credentials = await getOrAssumeRole({
          roleArn: account.roleArn,
          externalId: account.externalId,
        });
        const sesClient = new SESv2Client({
          region: account.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          },
        });
        const identity = await sesClient.send(
          new GetEmailIdentityCommand({ EmailIdentity: provider.domain })
        );
        if (identity.VerifiedForSendingStatus) {
          await db
            .update(ssoProvider)
            .set({ domainVerified: true, updatedAt: new Date() })
            .where(
              and(
                eq(ssoProvider.providerId, providerId),
                eq(ssoProvider.organizationId, orgId)
              )
            );
          revalidatePath(`/${access.orgSlug}/settings/sso`);
          return { success: true };
        }
      } catch (err) {
        log.warn(
          { err: serializeError(err), accountId: account.id },
          "SES identity check failed for account"
        );
      }
    }

    return {
      success: false,
      error: `${provider.domain} is not verified in any connected AWS account`,
    };
  } catch (error) {
    log.error(
      { err: serializeError(error) },
      "Failed to verify domain via SES"
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to verify domain via SES",
    };
  }
}

export type GenerateScimTokenResult =
  | { success: true; token: string }
  | { success: false; error: string };

export async function generateScimToken(
  orgId: string,
  providerId: string
): Promise<GenerateScimTokenResult> {
  try {
    const access = await verifyOrgAccess(orgId);
    if (!access) return { success: false, error: "Unauthorized" };
    const ssoWriteError = checkPermission(access.role, "sso", ["write"]);
    if (ssoWriteError) return ssoWriteError;

    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const result = await ssoApi.generateSCIMToken({
      body: { providerId, organizationId: orgId },
      headers: hdrs,
    });

    const auditCtx = await getAuditContext();
    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values(
        auditLogEntry(auditCtx, {
          organizationId: orgId,
          actorId: access.userId,
          actorEmail: access.userEmail,
          action: "sso.scim_token_generated",
          resource: "sso_provider",
          resourceId: providerId,
          metadata: {},
        })
      );
    });

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    return { success: true, token: result.scimToken };
  } catch (error) {
    const log = createActionLogger("generateScimToken", { orgSlug: orgId });
    log.error({ err: serializeError(error) }, "Failed to generate SCIM token");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate SCIM token",
    };
  }
}
