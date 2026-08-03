import { describe, expect, it } from "vitest";
import { sanitizeLogoUrl } from "../validate";

describe("sanitizeLogoUrl", () => {
  it("accepts an https blob URL and returns it unchanged", () => {
    const url =
      "https://abc123.public.blob.vercel-storage.com/organization-logos/org_1/logo.png";
    expect(sanitizeLogoUrl(url)).toBe(url);
  });

  it("accepts a self-hosted https serving URL", () => {
    const url =
      "https://demo.example.com/api/images/organization-logos/org_1/123-logo.png";
    expect(sanitizeLogoUrl(url)).toBe(url);
  });

  it("rejects http (mixed content on a public page)", () => {
    expect(sanitizeLogoUrl("http://example.com/logo.png")).toBeNull();
  });

  it("rejects a javascript: URL", () => {
    expect(sanitizeLogoUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects a data: URL", () => {
    expect(sanitizeLogoUrl("data:image/svg+xml;base64,AAAA")).toBeNull();
  });

  it("rejects a protocol-relative URL", () => {
    expect(sanitizeLogoUrl("//example.com/logo.png")).toBeNull();
  });

  it("rejects unparseable and empty strings", () => {
    expect(sanitizeLogoUrl("not a url")).toBeNull();
    expect(sanitizeLogoUrl("")).toBeNull();
    expect(sanitizeLogoUrl("   ")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(sanitizeLogoUrl(null)).toBeNull();
    expect(sanitizeLogoUrl(undefined)).toBeNull();
    expect(sanitizeLogoUrl(42)).toBeNull();
    expect(sanitizeLogoUrl({})).toBeNull();
  });

  it("rejects an https URL longer than 2048 characters", () => {
    const tooLong = `https://example.com/${"a".repeat(2048)}.png`;
    expect(tooLong.length).toBeGreaterThan(2048);
    expect(sanitizeLogoUrl(tooLong)).toBeNull();
  });

  it("trims surrounding whitespace on an otherwise-valid URL", () => {
    expect(sanitizeLogoUrl("  https://example.com/logo.png  ")).toBe(
      "https://example.com/logo.png"
    );
  });
});
