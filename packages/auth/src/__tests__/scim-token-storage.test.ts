/**
 * SCIM bearer tokens must not sit in the database in the clear.
 *
 * `scim_provider.scim_token` authenticates a credential that can enumerate an
 * org's directory and deactivate its people. better-auth 1.7 deleted the
 * plugin's own opt-in token-hashing option along with its token-generation
 * endpoint, so Wraps now owns minting and hashing directly — this file
 * exercises that module's real behavior instead of a config literal.
 */

import { describe, expect, it } from "vitest";
import { hashScimToken, mintScimToken } from "../scim-token";

describe("mintScimToken", () => {
  it("returns a 32-character token", () => {
    expect(mintScimToken()).toHaveLength(32);
  });

  it("returns a different token on each call", () => {
    expect(mintScimToken()).not.toBe(mintScimToken());
  });
});

describe("hashScimToken", () => {
  it("never returns the plaintext token", async () => {
    const token = mintScimToken();
    const hashed = await hashScimToken(token);
    expect(hashed).not.toBe(token);
  });

  it("hashes the same token to the same digest", async () => {
    const token = mintScimToken();
    const [first, second] = await Promise.all([
      hashScimToken(token),
      hashScimToken(token),
    ]);
    expect(first).toBe(second);
  });

  it("hashes different tokens to different digests", async () => {
    const [first, second] = await Promise.all([
      hashScimToken(mintScimToken()),
      hashScimToken(mintScimToken()),
    ]);
    expect(first).not.toBe(second);
  });

  it("is base64url — no '=', '+', or '/'", async () => {
    const hashed = await hashScimToken(mintScimToken());
    expect(hashed).not.toMatch(/[=+/]/);
  });
});
