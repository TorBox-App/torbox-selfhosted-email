import { createPublicKey, verify } from "node:crypto";

const PROD_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAkhqfyiWd3VYixEy5TiQVa8JS/ut0Guns972lfgNBtgo=\n-----END PUBLIC KEY-----\n";

const VALID_TIERS = ["starter", "growth", "scale"] as const;
type ValidTier = (typeof VALID_TIERS)[number];

export type LicenseResult = {
  valid: boolean;
  tier: ValidTier | null;
};

function getPublicKey() {
  return createPublicKey(
    process.env.WRAPS_LICENSE_PUBLIC_KEY_PEM ?? PROD_PUBLIC_KEY_PEM
  );
}

/**
 * Validate a Wraps license key.
 *
 * Format: v1.<tier>.<expires_YYYY-MM-DD>.<ed25519_sig_hex>
 * Signed payload: "v1.<tier>.<expires_YYYY-MM-DD>"
 *
 * Pure function — caller provides the key string (reads no env vars except at verify time).
 */
export function validateLicenseKey(key: string | undefined): LicenseResult {
  if (!key) {
    return { valid: false, tier: null };
  }

  const parts = key.split(".");

  // Format requires exactly: v1, tier, expires (YYYY-MM-DD), sig — 4 segments
  if (parts.length !== 4 || parts[0] !== "v1") {
    return { valid: false, tier: null };
  }

  const [, tier, expires, sigHex] = parts;

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

  // Ed25519 signature is 64 bytes = 128 hex chars
  if (sigHex.length !== 128) {
    return { valid: false, tier: null };
  }

  try {
    const payload = Buffer.from(`v1.${tier}.${expires}`);
    const sig = Buffer.from(sigHex, "hex");
    if (!verify(null, payload, getPublicKey(), sig)) {
      return { valid: false, tier: null };
    }
  } catch {
    return { valid: false, tier: null };
  }

  return { valid: true, tier: tier as ValidTier };
}
