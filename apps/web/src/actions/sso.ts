"use server";

import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { auth } from "@wraps/auth";
import { and, auditLog, db, eq, ssoProvider, verification } from "@wraps/db";
import { gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verifyOrgAccess } from "@/actions/shared/verify-org-access";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import { createActionLogger } from "@/lib/logger";
import { checkPermission } from "./shared/permissions";
import { orgAction } from "./shared/org-action";

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

export const saveSsoProvider = orgAction(
  {
    name: "saveSsoProvider",
    resource: "sso",
    permission: ["write"],
    orgId: (orgId: string, _data: SaveSsoProviderInput) => orgId,
    onError: "Something went wrong. Please try again.",
  },
  async (
    ctx,
    orgId: string,
    data: SaveSsoProviderInput
  ): Promise<SaveSsoProviderResult> => {
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

    const auditCtx = await getAuditContext();
    after(() =>
      db
        .insert(auditLog)
        .values(
          auditLogEntry(auditCtx, {
            organizationId: orgId,
            actorId: ctx.access.userId,
            actorEmail: ctx.access.userEmail,
            action: "sso.provider_saved",
            resource: "sso_provider",
            metadata: { domain: data.domain, issuer: data.issuer },
          })
        )
        .catch((err) =>
          createActionLogger("saveSsoProvider", { orgSlug: orgId }).warn(
            { err },
            "Best-effort audit log write failed"
          )
        )
    );

    revalidatePath(`/${ctx.access.orgSlug}/settings/sso`);
    return { success: true };
  }
);

export type DeleteSsoProviderResult =
  | { success: true }
  | { success: false; error: string };

export const deleteSsoProvider = orgAction(
  {
    name: "deleteSsoProvider",
    resource: "sso",
    permission: ["write"],
    orgId: (orgId: string, _providerId: string) => orgId,
    onError: "Something went wrong. Please try again.",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<DeleteSsoProviderResult> => {
    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    await ssoApi.deleteSSOProvider({
      body: { providerId },
      headers: hdrs,
    });

    await ctx.audited(
      async (_tx) => undefined,
      () => ({
        action: "sso.provider_deleted" as const,
        resource: "sso_provider",
        resourceId: providerId,
        metadata: { providerId },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/settings/sso`);
    return { success: true };
  }
);

export type RequestDomainVerificationResult =
  | { success: true; token: string; expiresAt: string }
  | { success: false; error: string };

export const requestDomainVerification = orgAction(
  {
    name: "requestDomainVerification",
    resource: "sso",
    permission: ["write"],
    orgId: (orgId: string, _providerId: string) => orgId,
    onError: "Something went wrong. Please try again.",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<RequestDomainVerificationResult> => {
    const provider = await requireProviderOwnership(orgId, providerId);
    if (!provider) return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const result = await ssoApi.requestDomainVerification({
      body: { providerId },
      headers: hdrs,
    });

    await ctx.audited(
      async (_tx) => undefined,
      () => ({
        action: "sso.domain_verification_requested" as const,
        resource: "sso_provider",
        resourceId: providerId,
        metadata: { domain: provider.domain },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/settings/sso`);
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    return { success: true, token: result.domainVerificationToken, expiresAt };
  }
);

export type VerifyDomainResult =
  | { success: true }
  | { success: false; error: string };

export const verifyDomain = orgAction(
  {
    name: "verifyDomain",
    resource: "sso",
    permission: ["write"],
    orgId: (orgId: string, _providerId: string) => orgId,
    onError: "Something went wrong. Please try again.",
  },
  async (ctx, orgId: string, providerId: string): Promise<VerifyDomainResult> => {
    const provider = await requireProviderOwnership(orgId, providerId);
    if (!provider) return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    await ssoApi.verifyDomain({
      body: { providerId },
      headers: hdrs,
    });

    await ctx.audited(
      async (_tx) => undefined,
      () => ({
        action: "sso.domain_verified" as const,
        resource: "sso_provider",
        resourceId: providerId,
        metadata: { domain: provider.domain },
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/settings/sso`);
    return { success: true };
  }
);

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

export const verifyDomainViaSES = orgAction(
  {
    name: "verifyDomainViaSES",
    resource: "sso",
    permission: ["write"],
    orgId: (orgId: string, _providerId: string) => orgId,
    onError: "Failed to verify domain via SES",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<VerifyDomainViaSESResult> => {
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
          revalidatePath(`/${ctx.access.orgSlug}/settings/sso`);
          return { success: true };
        }
      } catch (err) {
        ctx.log.warn(
          { err, accountId: account.id },
          "SES identity check failed for account"
        );
      }
    }

    return {
      success: false,
      error: `${provider.domain} is not verified in any connected AWS account`,
    };
  }
);

export type GenerateScimTokenResult =
  | { success: true; token: string }
  | { success: false; error: string };

export const generateScimToken = orgAction(
  {
    name: "generateScimToken",
    resource: "sso",
    permission: ["write"],
    orgId: (orgId: string, _providerId: string) => orgId,
    onError: "Failed to generate SCIM token",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<GenerateScimTokenResult> => {
    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const result = await ssoApi.generateSCIMToken({
      body: { providerId, organizationId: orgId },
      headers: hdrs,
    });

    await ctx.audited(
      async (_tx) => undefined,
      () => ({
        action: "sso.scim_token_generated" as const,
        resource: "sso_provider",
        resourceId: providerId,
        metadata: {},
      })
    );

    revalidatePath(`/${ctx.access.orgSlug}/settings/sso`);
    return { success: true, token: result.scimToken };
  }
);
