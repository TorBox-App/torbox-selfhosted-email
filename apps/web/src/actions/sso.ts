"use server";

import { auth } from "@wraps/auth";
import { and, db, eq, ssoProvider } from "@wraps/db";
import { revalidatePath } from "next/cache";
import { verifyOrgAccess } from "@/actions/shared/verify-org-access";
import { createActionLogger, serializeError } from "@/lib/logger";

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
    if (!["owner", "admin"].includes(access.role)) {
      return { success: false, error: "Only admins can configure SSO" };
    }

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

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    return { success: true };
  } catch (error) {
    const log = createActionLogger("saveSsoProvider", { orgSlug: orgId });
    log.error({ err: serializeError(error) }, "Failed to save SSO provider");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to save SSO provider",
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
    if (!["owner", "admin"].includes(access.role)) {
      return { success: false, error: "Only admins can delete SSO provider" };
    }

    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    await ssoApi.deleteSSOProvider({
      body: { providerId },
      headers: hdrs,
    });

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    return { success: true };
  } catch (error) {
    const log = createActionLogger("deleteSsoProvider", { orgSlug: orgId });
    log.error({ err: serializeError(error) }, "Failed to delete SSO provider");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete SSO provider",
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

    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const result = await ssoApi.requestDomainVerification({
      body: { providerId },
      headers: hdrs,
    });

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return { success: true, token: result.domainVerificationToken, expiresAt };
  } catch (error) {
    const log = createActionLogger("requestDomainVerification", {
      orgSlug: orgId,
    });
    log.error(
      { err: serializeError(error) },
      "Failed to request domain verification"
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to request domain verification",
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

    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    await ssoApi.verifyDomain({
      body: { providerId },
      headers: hdrs,
    });

    revalidatePath(`/${access.orgSlug}/settings/sso`);
    return { success: true };
  } catch (error) {
    const log = createActionLogger("verifyDomain", { orgSlug: orgId });
    log.error({ err: serializeError(error) }, "Failed to verify domain");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify domain",
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
    if (!["owner", "admin"].includes(access.role)) {
      return { success: false, error: "Only admins can generate SCIM tokens" };
    }

    if (!(await requireProviderOwnership(orgId, providerId)))
      return { success: false, error: "Provider not found" };

    const hdrs = await import("next/headers").then((m) => m.headers());
    const result = await ssoApi.generateSCIMToken({
      body: { providerId, organizationId: orgId },
      headers: hdrs,
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
