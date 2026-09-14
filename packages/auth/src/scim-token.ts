import { base64Url } from "@better-auth/utils/base64";
import { createHash } from "@better-auth/utils/hash";
import { db, eq, scimProvider } from "@wraps/db";
import { generateRandomString } from "better-auth/crypto";

/**
 * Mint/hash/verify helpers for SCIM bearer tokens.
 *
 * better-auth 1.7's SCIM plugin deleted both its token-generation endpoint
 * and its opt-in token-hashing config option — the application now owns
 * minting, hashing, and lookup entirely. This is a fresh, self-consistent
 * token design, not a reimplementation of 1.6.23's composite
 * `token:providerId:organizationId` format: there are no live customer
 * tokens in this format to stay compatible with (see plan 222's "READ
 * FIRST"), so a clean 32-character opaque token is simpler and just as
 * secure.
 *
 * A SCIM token is a bearer credential that can enumerate an org's directory
 * and deactivate its people, so it must never sit in `scim_provider.scim_token`
 * in the clear. Hashing (not reversible encryption) is the right primitive:
 * nothing in Wraps ever needs to read a token back — the UI already treats
 * them as show-once — and encryption would only add a way to recover one via
 * `BETTER_AUTH_SECRET`. Plain SHA-256, not a password hash: the token is 32
 * characters of CSPRNG output, so there is nothing to brute force and no
 * password-style stretching to justify.
 *
 * One-way, so this invalidates any token whose hash cannot be reproduced —
 * in particular, rotating in Settings -> SSO & SCIM issues a working one.
 */

/**
 * Returns a fresh plaintext SCIM token. Never persisted as-is — the caller's
 * next step is always `hashScimToken`.
 *
 * The token is a single opaque high-entropy string with no embedded
 * structure: the verifier finds the row by hash, so the token itself carries
 * no provider or org id.
 */
export function mintScimToken(): string {
  return generateRandomString(32);
}

/**
 * Hashes a SCIM token for storage/lookup: SHA-256, base64url, unpadded.
 */
export async function hashScimToken(token: string): Promise<string> {
  const digest = await createHash("SHA-256").digest(
    new TextEncoder().encode(token)
  );
  return base64Url.encode(new Uint8Array(digest), { padding: false });
}

/**
 * Looks up the `scim_provider` row whose stored hash matches the given
 * plaintext token, or `null` if none matches.
 *
 * There is no unique index on `scim_provider.scim_token` — the only index on
 * the table is `scim_provider_org_idx` on `organization_id`
 * (`migrations/0053_soft_carnage.sql:30`). That is fine here: two rows can
 * only collide if the same 32-character CSPRNG token is minted twice, and
 * `findFirst` is well-defined regardless. Adding a unique index would be a
 * change to a pre-existing table, which plan 221 explicitly does not do —
 * noted as a follow-up, not fixed here.
 */
export async function findScimProviderByToken(token: string) {
  const digest = await hashScimToken(token);
  const row = await db.query.scimProvider.findFirst({
    where: eq(scimProvider.scimToken, digest),
  });
  return row ?? null;
}
