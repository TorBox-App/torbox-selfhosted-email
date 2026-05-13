import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateLicenseKey } from "../../utils/license.js";

const { privateKey: TEST_PRIV_PEM, publicKey: TEST_PUB_PEM } =
  generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }) as { privateKey: string; publicKey: string };

function expectedSig(tier: string, expires: string): string {
  const payload = `v1.${tier}.${expires}`;
  return sign(null, Buffer.from(payload), TEST_PRIV_PEM).toString("hex");
}

describe("generateLicenseKey", () => {
  beforeEach(() => {
    vi.stubEnv("WRAPS_LICENSE_PRIVATE_KEY", TEST_PRIV_PEM);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns key in v1.<tier>.<expires>.<128-hex> format", () => {
    const key = generateLicenseKey("scale", "2099-01-01");
    const parts = key.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(parts[1]).toBe("scale");
    expect(parts[2]).toBe("2099-01-01");
    expect(parts[3]).toMatch(/^[0-9a-f]{128}$/);
  });

  it("Ed25519 signature matches expected", () => {
    const key = generateLicenseKey("starter", "2099-06-30");
    const sig = key.split(".")[3];
    expect(sig).toBe(expectedSig("starter", "2099-06-30"));
  });

  it("throws for invalid tier", () => {
    expect(() => generateLicenseKey("enterprise", "2099-01-01")).toThrow(
      /invalid tier/i
    );
  });

  it("throws for past expiry date", () => {
    expect(() => generateLicenseKey("scale", "2020-01-01")).toThrow(
      /expiry date must be in the future/i
    );
  });

  it("throws when WRAPS_LICENSE_PRIVATE_KEY is not set", () => {
    vi.unstubAllEnvs();
    expect(() => generateLicenseKey("scale", "2099-01-01")).toThrow(
      "WRAPS_LICENSE_PRIVATE_KEY is not set"
    );
  });
});
