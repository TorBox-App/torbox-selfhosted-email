/**
 * SCIM bearer tokens must not sit in the database in the clear.
 *
 * `scim_provider.scim_token` authenticates a credential that can enumerate an
 * org's directory and deactivate its people. @better-auth/scim defaults to
 * storing it verbatim, so this is an opt-in we have to keep opted into.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@wraps/email", () => ({
  getWrapsClient: vi.fn(),
}));

import { auth } from "../index";

/**
 * The values @better-auth/scim's `storeSCIMToken` actually branches on. Its
 * final `return scimToken` is a silent fallthrough: an unrecognised string —
 * a typo like "hash", or a mode renamed in a future release — stores the token
 * in plain text with no error anywhere. Pinning the accepted set turns that
 * into a test failure instead of a quiet downgrade.
 */
const ONE_WAY_MODES = ["hashed", "encrypted"];

function scimPluginOptions(): { storeSCIMToken?: unknown } {
  const plugins = auth.options.plugins as { id: string; options?: unknown }[];
  const plugin = plugins.find((p) => p.id === "scim");
  if (!plugin) {
    throw new Error("Expected the scim plugin to be registered");
  }
  return (plugin.options ?? {}) as { storeSCIMToken?: unknown };
}

describe("SCIM token storage", () => {
  it("does not store SCIM tokens in plain text", () => {
    const { storeSCIMToken } = scimPluginOptions();

    expect(
      storeSCIMToken,
      "scim({ storeSCIMToken }) is unset or unrecognised, so @better-auth/scim " +
        "falls through to storing the bearer token verbatim in " +
        "scim_provider.scim_token."
    ).toBeDefined();
    expect(ONE_WAY_MODES).toContain(storeSCIMToken);
  });

  it("uses hashing rather than reversible encryption", () => {
    // "encrypted" is reversible by anyone holding BETTER_AUTH_SECRET, and
    // nothing in Wraps ever reads a SCIM token back — the UI issues it once and
    // offers rotation. Hashing is the weaker capability, so prefer it.
    expect(scimPluginOptions().storeSCIMToken).toBe("hashed");
  });
});
