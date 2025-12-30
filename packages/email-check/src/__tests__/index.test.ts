import { describe, expect, it } from "vitest";
import { isValidDomain, toAsciiDomain } from "../utils/domain.js";

describe("email-check", () => {
  describe("domain utils", () => {
    it("validates domains correctly", () => {
      expect(isValidDomain("example.com")).toBe(true);
      expect(isValidDomain("sub.example.com")).toBe(true);
      expect(isValidDomain("invalid")).toBe(false);
      expect(isValidDomain("")).toBe(false);
    });

    it("converts IDN domains to ASCII", () => {
      expect(toAsciiDomain("example.com")).toBe("example.com");
      expect(toAsciiDomain("EXAMPLE.COM")).toBe("example.com");
    });
  });
});
