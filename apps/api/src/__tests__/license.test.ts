import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateLicenseKey } from "../lib/license";

const { privateKey: TEST_PRIV_PEM, publicKey: TEST_PUB_PEM } =
  generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }) as { privateKey: string; publicKey: string };

function makeKey(tier: string, expires: string): string {
  const payload = `v1.${tier}.${expires}`;
  const sig = sign(null, Buffer.from(payload), TEST_PRIV_PEM).toString("hex");
  return `${payload}.${sig}`;
}

describe("validateLicenseKey", () => {
  beforeEach(() => vi.stubEnv("WRAPS_LICENSE_PUBLIC_KEY_PEM", TEST_PUB_PEM));
  afterEach(() => vi.unstubAllEnvs());

  it("returns valid:true and tier for a correctly signed, non-expired key", () => {
    const key = makeKey("scale", "2099-12-31");
    const result = validateLicenseKey(key);
    expect(result).toEqual({ valid: true, tier: "scale" });
  });

  it("returns valid:false and tier:null for a tampered signature", () => {
    const key = makeKey("scale", "2099-12-31");
    const tampered = `${key.slice(0, -4)}dead`;
    const result = validateLicenseKey(tampered);
    expect(result).toEqual({ valid: false, tier: null });
  });

  it("returns valid:false and tier:null for an expired key", () => {
    const key = makeKey("scale", "2020-01-01");
    const result = validateLicenseKey(key);
    expect(result).toEqual({ valid: false, tier: null });
  });

  it("returns valid:false for a 128-char non-hex signature", () => {
    const key = `v1.scale.2099-12-31.${"g".repeat(128)}`;
    expect(validateLicenseKey(key)).toEqual({ valid: false, tier: null });
  });

  it("returns valid:false when tier is swapped but original signature retained", () => {
    const original = makeKey("scale", "2099-12-31");
    const [, , expires, sig] = original.split(".");
    const forged = `v1.growth.${expires}.${sig}`;
    expect(validateLicenseKey(forged)).toEqual({ valid: false, tier: null });
  });
});
