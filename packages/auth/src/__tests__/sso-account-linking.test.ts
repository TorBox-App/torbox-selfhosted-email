/**
 * First SSO login for a user that already exists locally goes through
 * better-auth's implicit-linking gate (`handleOAuthUserInfo`). Three of its
 * clauses can each independently produce "account not linked", and two of
 * them default the wrong way for Wraps:
 *
 * - `requireLocalEmailVerified` defaults to true, but SCIM-provisioned users
 *   are created with `emailVerified: false` by @better-auth/scim, and
 *   email/password signups are unverified too (`requireEmailVerification` is
 *   off). With the default, a domain-verified IdP's entire directory is
 *   locked out of SSO — the torbox.app incident (2026-08).
 *
 * - Errors from the SSO callback default-redirect to better-auth's
 *   `/api/auth/error`, whose sanitizer rejects codes containing spaces and
 *   rewrites "account not linked" into an unmappable `/?error=UNKNOWN`.
 *   `onAPIError.errorURL` must point at the sign-in page, which maps raw
 *   codes to human messages.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@wraps/email", () => ({
  getWrapsClient: vi.fn(),
}));

import { auth } from "../index";

function accountLinking(): {
  enabled?: boolean;
  disableImplicitLinking?: boolean;
  requireLocalEmailVerified?: boolean;
} {
  return auth.options.account?.accountLinking ?? {};
}

describe("SSO account linking", () => {
  it("links trusted-provider logins to unverified local users", () => {
    expect(
      accountLinking().requireLocalEmailVerified,
      "account.accountLinking.requireLocalEmailVerified must be explicitly " +
        "false: better-auth defaults it to true, which refuses to link SSO " +
        "logins onto SCIM-provisioned users (always emailVerified: false) — " +
        "every one of them gets 'account not linked'."
    ).toBe(false);
  });

  it("keeps implicit linking available to the gate", () => {
    // The same gate also refuses on `enabled: false` or
    // `disableImplicitLinking: true`; either would silently re-break SSO for
    // provisioned users while the requireLocalEmailVerified pin still passes.
    expect(accountLinking().enabled).not.toBe(false);
    expect(accountLinking().disableImplicitLinking).not.toBe(true);
  });

  it("routes auth-flow errors to the sign-in page for mapping", () => {
    expect(
      auth.options.onAPIError?.errorURL,
      "onAPIError.errorURL must point at the sign-in page: without it the " +
        "SSO callback falls back to /api/auth/error, whose sanitizer turns " +
        "'account not linked' into an unmappable UNKNOWN."
    ).toBe("/auth");
  });
});
