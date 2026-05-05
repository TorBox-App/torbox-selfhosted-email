import { createHash } from "node:crypto";

const PREFIX = "wraps-email-";
const MAX_LENGTH = 64;
const MAX_SLUG = MAX_LENGTH - PREFIX.length; // 52
const MAX_SLUG_WITH_HASH = MAX_SLUG - 9; // 43: leave room for "-" + 8-char hash

export function domainToConfigSetName(domain: string): string {
  const slug = domain.toLowerCase().replace(/\./g, "-");

  // Domains containing a hyphen are ambiguous: "my-domain.com" and "my.domain.com"
  // both produce slug "my-domain-com". Add a hash to disambiguate.
  const needsHash = domain.includes("-") || slug.length > MAX_SLUG;

  if (!needsHash) {
    return `${PREFIX}${slug}`;
  }

  const hash = createHash("sha256").update(domain).digest("hex").slice(0, 8);
  const rawSlugPart =
    slug.length > MAX_SLUG_WITH_HASH ? slug.slice(0, MAX_SLUG_WITH_HASH) : slug;
  const slugPart = rawSlugPart.replace(/-+$/, "");
  return `${PREFIX}${slugPart}-${hash}`;
}
