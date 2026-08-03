import { describe, expect, it } from "vitest";
import {
  imageUrlToKey,
  isOwnedBlobLogo,
  isOwnedSelfHostedLogo,
  isSelfHostedImageUrl,
  isVercelBlobUrl,
  sanitizeLogoFilename,
} from "../organization-logo";

describe("isOwnedBlobLogo", () => {
  it("returns true when the blob pathname belongs to the given org", () => {
    const url =
      "https://x.public.blob.vercel-storage.com/organization-logos/ORG_A/abc-logo.png";
    expect(isOwnedBlobLogo(url, "ORG_A")).toBe(true);
  });

  it("returns false for a cross-tenant org id", () => {
    const url =
      "https://x.public.blob.vercel-storage.com/organization-logos/ORG_A/abc-logo.png";
    expect(isOwnedBlobLogo(url, "ORG_B")).toBe(false);
  });

  it("returns false when the org prefix is not at the root of the path", () => {
    const url =
      "https://x.public.blob.vercel-storage.com/organization-logos/ORG_A/x/organization-logos/ORG_B/logo.png";
    expect(isOwnedBlobLogo(url, "ORG_B")).toBe(false);
  });

  it("returns false for a non-blob URL", () => {
    expect(isOwnedBlobLogo("https://evil.com/logo.png", "ORG_A")).toBe(false);
  });

  it("returns false for a malformed URL", () => {
    expect(isOwnedBlobLogo("not-a-url", "ORG_A")).toBe(false);
  });
});

describe("isOwnedSelfHostedLogo", () => {
  it("returns true for a self-hosted /api/images URL owned by the org", () => {
    const url =
      "https://demo.example.com/api/images/organization-logos/ORG_A/123-logo.png";
    expect(isOwnedSelfHostedLogo(url, "ORG_A")).toBe(true);
  });

  it("returns false for a cross-tenant self-hosted URL", () => {
    const url =
      "https://demo.example.com/api/images/organization-logos/ORG_A/123-logo.png";
    expect(isOwnedSelfHostedLogo(url, "ORG_B")).toBe(false);
  });

  it("returns false when another org's key merely contains this org's prefix", () => {
    // The guard must not depend on filenames never containing a separator —
    // an anchored key check is what keeps a crafted URL from naming a
    // victim's object.
    const url =
      "https://demo.example.com/api/images/organization-logos/ORG_A/123-organization-logos/ORG_B/logo.png";
    expect(isOwnedSelfHostedLogo(url, "ORG_B")).toBe(false);
  });

  it("returns false for a key with extra path segments", () => {
    const url =
      "https://demo.example.com/api/images/organization-logos/ORG_A/nested/logo.png";
    expect(isOwnedSelfHostedLogo(url, "ORG_A")).toBe(false);
  });

  it("returns false for a Vercel Blob URL", () => {
    const url =
      "https://x.public.blob.vercel-storage.com/organization-logos/ORG_A/abc-logo.png";
    expect(isOwnedSelfHostedLogo(url, "ORG_A")).toBe(false);
  });

  it("returns false for a malformed URL", () => {
    expect(isOwnedSelfHostedLogo("not-a-url", "ORG_A")).toBe(false);
  });
});

describe("isVercelBlobUrl", () => {
  it("returns true for a blob host", () => {
    expect(
      isVercelBlobUrl("https://x.public.blob.vercel-storage.com/a/b.png")
    ).toBe(true);
  });

  it("returns false for a lookalike host", () => {
    expect(isVercelBlobUrl("https://vercel-storage.com.evil.com/a.png")).toBe(
      false
    );
  });

  it("returns false for a path that mentions the blob host", () => {
    expect(isVercelBlobUrl("https://evil.com/vercel-storage.com")).toBe(false);
  });
});

describe("isSelfHostedImageUrl", () => {
  it("returns true for an /api/images logo URL", () => {
    expect(
      isSelfHostedImageUrl(
        "https://demo.example.com/api/images/organization-logos/ORG_A/1.png"
      )
    ).toBe(true);
  });

  it("returns false for a Vercel Blob URL", () => {
    expect(
      isSelfHostedImageUrl(
        "https://x.public.blob.vercel-storage.com/organization-logos/ORG_A/abc.png"
      )
    ).toBe(false);
  });

  it("returns false for an /api/images URL outside the logos prefix", () => {
    expect(
      isSelfHostedImageUrl("https://demo.example.com/api/images/secrets/key")
    ).toBe(false);
  });

  it("returns false for a malformed URL", () => {
    expect(isSelfHostedImageUrl("not-a-url")).toBe(false);
  });
});

describe("imageUrlToKey", () => {
  it("extracts the S3 key from the serving URL", () => {
    expect(
      imageUrlToKey(
        "https://demo.example.com/api/images/organization-logos/ORG_A/123-logo.png"
      )
    ).toBe("organization-logos/ORG_A/123-logo.png");
  });
});

describe("sanitizeLogoFilename", () => {
  it("keeps safe names unchanged", () => {
    expect(sanitizeLogoFilename("logo-2.png")).toBe("logo-2.png");
  });

  it("replaces spaces and unsafe characters", () => {
    expect(sanitizeLogoFilename("my logo (final).PNG")).toBe(
      "my-logo--final-.PNG"
    );
  });

  it("strips path separators so the key cannot escape the org prefix", () => {
    expect(sanitizeLogoFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeLogoFilename("..\\..\\evil.png")).toBe("evil.png");
  });

  it("falls back to a literal name when nothing safe remains", () => {
    expect(sanitizeLogoFilename("")).toBe("logo");
    expect(sanitizeLogoFilename("///")).toBe("logo");
  });
});
