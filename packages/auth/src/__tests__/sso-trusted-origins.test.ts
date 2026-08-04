/**
 * The SSO plugin fetches nothing it does not already trust:
 * `registerSSOProvider` runs the issuer's discovery URL — and every endpoint
 * URL inside the returned document — through `isTrustedOrigin`, and throws
 * `discovery_untrusted_origin` on the first miss.
 *
 * An IdP missing from `trustedOrigins` therefore cannot be registered at all:
 * no `sso_provider` row, so no SCIM either, since the dashboard only offers
 * SCIM on top of a verified SSO provider. These tests pin the hosts real IdPs
 * actually serve from, which is not the same set as their issuer hosts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@wraps/email", () => ({ getWrapsClient: vi.fn() }));

async function isTrustedOrigin(url: string): Promise<boolean> {
  const { auth } = await import("../index");
  const ctx = await (
    auth as unknown as {
      $context: Promise<{ isTrustedOrigin: (u: string) => boolean }>;
    }
  ).$context;
  return ctx.isTrustedOrigin(url);
}

describe("SSO trusted origins", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it.each([
    // Okta, standard tenant domain.
    "https://acme.okta.com/.well-known/openid-configuration",
    "https://acme.okta.com/oauth2/v1/token",
    "https://acme.oktapreview.com/.well-known/openid-configuration",
    // Okta's non-US cells are ordinary paid tenants, not preview or edge cases.
    "https://acme.okta-emea.com/.well-known/openid-configuration",
    "https://acme.okta-gov.com/.well-known/openid-configuration",
    // Microsoft Entra ID — issuer carries a tenant path, origin is constant.
    "https://login.microsoftonline.com/tenant-id/v2.0/.well-known/openid-configuration",
    // Auth0 regional tenants.
    "https://acme.eu.auth0.com/.well-known/openid-configuration",
  ])("trusts %s", async (url) => {
    expect(await isTrustedOrigin(url)).toBe(true);
  });

  /**
   * Google's discovery document does not keep its endpoints on the issuer host.
   * Trusting only `accounts.google.com` let discovery start and then fail on
   * `token_endpoint`, which reads to an admin as SSO being broken rather than
   * unconfigured.
   */
  it.each([
    "https://accounts.google.com/.well-known/openid-configuration",
    "https://oauth2.googleapis.com/token",
    "https://openidconnect.googleapis.com/v1/userinfo",
    "https://www.googleapis.com/oauth2/v3/certs",
  ])("trusts every host in Google's discovery document: %s", async (url) => {
    expect(await isTrustedOrigin(url)).toBe(true);
  });

  it("does not trust an arbitrary host by default", async () => {
    expect(
      await isTrustedOrigin("https://evil.example.com/.well-known/jwks.json")
    ).toBe(false);
  });

  describe("WRAPS_SSO_TRUSTED_ORIGINS", () => {
    it("trusts an operator-supplied origin", async () => {
      vi.stubEnv("WRAPS_SSO_TRUSTED_ORIGINS", "https://login.acme.com");
      expect(
        await isTrustedOrigin(
          "https://login.acme.com/.well-known/openid-configuration"
        )
      ).toBe(true);
    });

    it("accepts a comma-separated list with surrounding whitespace", async () => {
      vi.stubEnv(
        "WRAPS_SSO_TRUSTED_ORIGINS",
        " https://login.acme.com , https://keycloak.acme.com "
      );
      expect(
        await isTrustedOrigin("https://keycloak.acme.com/realms/acme/protocol")
      ).toBe(true);
    });

    it("accepts wildcard patterns for an internal IdP's subdomains", async () => {
      vi.stubEnv("WRAPS_SSO_TRUSTED_ORIGINS", "https://*.internal.acme.com");
      expect(
        await isTrustedOrigin("https://sso.internal.acme.com/oauth2/token")
      ).toBe(true);
    });

    /**
     * `.env.selfhost` is hand-edited, so a trailing slash is the likeliest
     * typo. better-auth compares origins, which never carry one.
     */
    it("tolerates a trailing slash", async () => {
      vi.stubEnv("WRAPS_SSO_TRUSTED_ORIGINS", "https://login.acme.com/");
      expect(
        await isTrustedOrigin(
          "https://login.acme.com/.well-known/openid-configuration"
        )
      ).toBe(true);
    });

    it("drops entries that are not http(s) origins", async () => {
      vi.stubEnv("WRAPS_SSO_TRUSTED_ORIGINS", "login.acme.com,,   ");
      const { auth } = await import("../index");
      expect(auth.options.trustedOrigins).not.toContain("login.acme.com");
      expect(auth.options.trustedOrigins).not.toContain("");
    });
  });
});
