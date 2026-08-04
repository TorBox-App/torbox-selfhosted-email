"use server";

import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { auth } from "@wraps/auth";
import {
  and,
  auditLog,
  db,
  eq,
  scimProvider,
  ssoProvider,
  verification,
} from "@wraps/db";
import { APIError } from "better-auth/api";
import { gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verifyOrgAccess } from "@/actions/shared/verify-org-access";
import { auditLogEntry, getAuditContext } from "@/lib/audit";
import { getOrAssumeRole } from "@/lib/aws/credential-cache";
import { createActionLogger } from "@/lib/logger";
import { orgAction } from "./shared/org-action";
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

/**
 * The SCIM provider id must NOT equal the SSO provider id.
 *
 * Since better-auth 1.6, `/scim/generate-token` rejects any providerId that
 * already exists in `sso_provider` ("Provider id collides with another account
 * provider"). We only ever offer SCIM for an org that has a verified SSO
 * provider, so passing the SSO provider id — as we did through 1.5 — now fails
 * 100% of the time.
 *
 * Keyed by organization, not by domain: the SCIM `account` rows the plugin
 * writes are looked up by this exact providerId, so it has to survive the org
 * changing or re-adding its SSO domain. Otherwise every previously provisioned
 * user goes invisible to the IdP.
 */
function scimProviderIdFor(orgId: string) {
  return `scim-${orgId}`;
}

/**
 * Better-auth's untrusted-origin message ends in "is not trusted by your
 * trusted origins configuration", which names a server-side array the admin
 * hitting this button cannot see and has no way to guess at. Every IdP outside
 * the built-in allowlist in `packages/auth` lands here — an Okta custom domain,
 * a self-hosted Keycloak — so say what actually has to happen instead.
 */
function explainAuthError(message: string): string {
  if (!message.includes("trusted origins configuration")) return message;
  const url = /"([^"]+)"/.exec(message)?.[1];
  return `Wraps is not allowed to reach ${url ?? "this identity provider"}. Add its origin to WRAPS_SSO_TRUSTED_ORIGINS (comma-separated) on the dashboard deployment and redeploy, then save this provider again.`;
}

/**
 * Better-auth throws `APIError` with an operator-facing message ("You are not a
 * member of the organization", "Insufficient role for this operation"). These
 * are the plugin's own HTTP error strings, not internal detail, and they are
 * the only signal an admin gets while wiring up an IdP — so surface them
 * instead of letting orgAction flatten them into a generic failure.
 */
async function callAuthApi<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof APIError) {
      const message = (err.body as { message?: string } | undefined)?.message;
      return { ok: false, error: explainAuthError(message ?? err.message) };
    }
    throw err;
  }
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
    feature: "sso",
  },
  async (
    ctx,
    orgId: string,
    data: SaveSsoProviderInput
  ): Promise<SaveSsoProviderResult> => {
    const hdrs = await import("next/headers").then((m) => m.headers());
    const registered = await callAuthApi(() =>
      ssoApi.registerSSOProvider({
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
      })
    );
    if (!registered.ok) return { success: false, error: registered.error };

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
    feature: "sso",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<DeleteSsoProviderResult> => {
    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const deleted = await callAuthApi(() =>
      ssoApi.deleteSSOProvider({
        body: { providerId },
        headers: hdrs,
      })
    );
    if (!deleted.ok) return { success: false, error: deleted.error };

    await ctx.audited(
      async (_tx) => {},
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
    feature: "sso",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<RequestDomainVerificationResult> => {
    const provider = await requireProviderOwnership(orgId, providerId);
    if (!provider) return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const requested = await callAuthApi(() =>
      ssoApi.requestDomainVerification({
        body: { providerId },
        headers: hdrs,
      })
    );
    if (!requested.ok) return { success: false, error: requested.error };
    const result = requested.value;

    await ctx.audited(
      async (_tx) => {},
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
    feature: "sso",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<VerifyDomainResult> => {
    const provider = await requireProviderOwnership(orgId, providerId);
    if (!provider) return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const verified = await callAuthApi(() =>
      ssoApi.verifyDomain({
        body: { providerId },
        headers: hdrs,
      })
    );
    if (!verified.ok) return { success: false, error: verified.error };

    await ctx.audited(
      async (_tx) => {},
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
    feature: "sso",
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
    feature: "sso",
  },
  async (
    ctx,
    orgId: string,
    providerId: string
  ): Promise<GenerateScimTokenResult> => {
    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const generated = await callAuthApi(() =>
      ssoApi.generateSCIMToken({
        body: { providerId: scimProviderIdFor(orgId), organizationId: orgId },
        headers: hdrs,
      })
    );
    if (!generated.ok) return { success: false, error: generated.error };
    const result = generated.value;

    // Tokens minted before better-auth 1.6 used the SSO provider id. The plugin
    // only revokes the row matching the id it is generating for, so a legacy row
    // would survive rotation and keep its token valid — drop it ourselves. After
    // the new token exists, so a failed rotation leaves the old one working.
    await db
      .delete(scimProvider)
      .where(
        and(
          eq(scimProvider.organizationId, orgId),
          eq(scimProvider.providerId, providerId)
        )
      );

    await ctx.audited(
      async (_tx) => {},
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
