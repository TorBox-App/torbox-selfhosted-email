import { describe, expect, it } from "vitest";
import { isValidListingResponse } from "../checks/blacklist.js";
import { IP_BLACKLISTS } from "../constants.js";

describe("isValidListingResponse", () => {
  it("accepts listings in 127.0.0.0/8", () => {
    for (const code of ["127.0.0.2", "127.0.0.3", "127.0.0.10", "127.0.1.2"]) {
      expect(isValidListingResponse(code)).toBe(true);
    }
  });

  it("rejects answers outside 127.0.0.0/8", () => {
    for (const code of [
      "208.98.40.36",
      "208.98.43.100",
      "208.98.40.223",
      "0.0.0.0",
      "1.2.3.4",
    ]) {
      expect(isValidListingResponse(code)).toBe(false);
    }
  });

  it("does not treat a 127-prefixed substring elsewhere as valid", () => {
    expect(isValidListingResponse("10.127.0.2")).toBe(false);
  });
});

describe("IP_BLACKLISTS", () => {
  it("does not ship the dead cbl.anti-spam.org.cn zone", () => {
    const zones = IP_BLACKLISTS.map((b) => b.zone);
    expect(zones).not.toContain("cbl.anti-spam.org.cn");
  });

  it("has no duplicate zones", () => {
    const zones = IP_BLACKLISTS.map((b) => b.zone);
    expect(new Set(zones).size).toBe(zones.length);
  });
});
