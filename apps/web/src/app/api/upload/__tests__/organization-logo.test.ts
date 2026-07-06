import { describe, expect, it } from "vitest";
import { isOwnedOrgLogo } from "../organization-logo/organization-logo-utils";

describe("isOwnedOrgLogo", () => {
  it("returns true when the blob pathname belongs to the given org", () => {
    const url =
      "https://x.public.blob.vercel-storage.com/organization-logos/ORG_A/abc-logo.png";
    expect(isOwnedOrgLogo(url, "ORG_A")).toBe(true);
  });

  it("returns false for a cross-tenant org id", () => {
    const url =
      "https://x.public.blob.vercel-storage.com/organization-logos/ORG_A/abc-logo.png";
    expect(isOwnedOrgLogo(url, "ORG_B")).toBe(false);
  });

  it("returns false for a non-blob URL", () => {
    const url = "https://evil.com/logo.png";
    expect(isOwnedOrgLogo(url, "ORG_A")).toBe(false);
  });

  it("returns false for a malformed URL", () => {
    expect(isOwnedOrgLogo("not-a-url", "ORG_A")).toBe(false);
  });
});
