import { createHmac, timingSafeEqual } from "node:crypto";

// Embedded constant — self-hosted customers who have the source can see this.
// Wraps controls key issuance; the security model is authorization, not obscurity.
// Rotate via new SIGNING_SECRET + re-issuing all active keys.
export const SIGNING_SECRET =
  "wraps-1-f2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2";

const VALID_TIERS = ["starter", "growth", "scale"] as const;
type ValidTier = (typeof VALID_TIERS)[number];

export type LicenseResult = {
  valid: boolean;
  tier: ValidTier | null;
};

/**
 * Validate a Wraps license key.
 *
 * Format: v1.<tier>.<expires_YYYY-MM-DD>.<hmac_hex>
 * HMAC payload: "v1.<tier>.<expires_YYYY-MM-DD>"
 *
 * Pure function — caller provides the key string (reads no env vars).
 */
export function validateLicenseKey(key: string | undefined): LicenseResult {
  if (!key) {
    return { valid: false, tier: null };
  }

  const parts = key.split(".");

  // Format requires exactly: v1, tier, expires (YYYY-MM-DD), hmac — 4 segments
  if (parts.length !== 4 || parts[0] !== "v1") {
    return { valid: false, tier: null };
  }

  const [, tier, expires, hmac] = parts;

  if (!(VALID_TIERS as readonly string[]).includes(tier)) {
    return { valid: false, tier: null };
  }

  // Validate expires is a parseable date
  const expiryDate = new Date(expires);
  if (Number.isNaN(expiryDate.getTime())) {
    return { valid: false, tier: null };
  }

  // Lexicographic comparison on YYYY-MM-DD — license valid through end of expiry day
  const today = new Date().toISOString().slice(0, 10);
  if (expires < today) {
    return { valid: false, tier: null };
  }

  // Verify HMAC with timing-safe comparison
  const payload = `v1.${tier}.${expires}`;
  const expectedHex = createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(hmac, "hex");

  if (
    actualBuf.length !== expectedBuf.length ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return { valid: false, tier: null };
  }

  return { valid: true, tier: tier as ValidTier };
}
