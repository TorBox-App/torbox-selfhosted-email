import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SIGNING_SECRET, validateLicenseKey } from "../lib/license";

function makeKey(
  tier: string,
  expires: string,
  secret = SIGNING_SECRET
): string {
  const payload = `v1.${tier}.${expires}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `v1.${tier}.${expires}.${hmac}`;
}

describe("validateLicenseKey", () => {
  it("returns valid:true and tier for a correctly signed, non-expired key", () => {
    const key = makeKey("scale", "2099-12-31");
    const result = validateLicenseKey(key);
    expect(result).toEqual({ valid: true, tier: "scale" });
  });

  it("returns valid:false and tier:null for a tampered HMAC", () => {
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
});
