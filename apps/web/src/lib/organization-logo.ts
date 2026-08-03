/**
 * Shared helpers for organization logo storage.
 *
 * Logos are written under `organization-logos/{orgId}/{filename}` — to Vercel
 * Blob on the platform app, or to the self-hosted uploads bucket served behind
 * /api/images. The upload route, the serving route, and the client uploader
 * all need the same rules, so they live here rather than beside any one route.
 */

const LOGO_KEY_PREFIX = "organization-logos/";
const SELF_HOSTED_IMAGE_PREFIX = "/api/images/";

/**
 * Exact key shape written by /api/upload/organization-logo: the logos prefix,
 * an org id, and one filename segment. Anchored, and no segment can contain a
 * separator — so a key that matches can only name an object inside a single
 * org's namespace. Both the serving route and the delete guards test against
 * this, which is what keeps them tenant-safe without depending on what
 * sanitizeLogoFilename happens to emit.
 */
export const LOGO_KEY_PATTERN = /^organization-logos\/[\w.-]+\/[\w.-]+$/;

const SERVING_ROUTE_PREFIX = /^\/api\/images\//;
const PATH_SEPARATOR = /[\\/]/;
const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

/**
 * Securely check if a URL is from Vercel Blob storage.
 * Uses proper URL parsing to prevent bypass attacks like:
 * - https://evil.com/vercel-storage.com
 * - https://vercel-storage.com.evil.com
 */
export function isVercelBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * True when the URL points at a deployment's own image-serving route
 * (/api/images/organization-logos/...), i.e. an object in a self-hosted
 * uploads bucket rather than Vercel Blob. Matches on the path only: a logo
 * URL keeps the app URL it was uploaded under, which may differ from the
 * host the dashboard is being viewed on today.
 */
export function isSelfHostedImageUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname.startsWith(`${SELF_HOSTED_IMAGE_PREFIX}${LOGO_KEY_PREFIX}`);
  } catch {
    return false;
  }
}

/**
 * Extract the S3 object key from a self-hosted image URL.
 * Assumes isSelfHostedImageUrl(url) held.
 */
export function imageUrlToKey(url: string): string {
  return new URL(url).pathname.replace(SERVING_ROUTE_PREFIX, "");
}

/**
 * Ownership guard for the self-hosted backend: the URL must resolve to a
 * well-formed logo key inside this org's prefix. Must hold before a delete,
 * otherwise any owner/admin could delete another org's object by URL
 * (cross-tenant IDOR).
 */
export function isOwnedSelfHostedLogo(url: string, orgId: string): boolean {
  if (!isSelfHostedImageUrl(url)) {
    return false;
  }
  const key = imageUrlToKey(url);
  return (
    LOGO_KEY_PATTERN.test(key) && key.startsWith(`${LOGO_KEY_PREFIX}${orgId}/`)
  );
}

/**
 * Ownership guard for Vercel Blob. `put()` stores the key at the root of the
 * pathname (addRandomSuffix only appends to the filename), so the org prefix
 * is anchored there — a match anywhere else in the path is not this org's.
 */
export function isOwnedBlobLogo(url: string, orgId: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname.startsWith(`/${LOGO_KEY_PREFIX}${orgId}/`);
  } catch {
    return false;
  }
}

/**
 * Sanitize an uploaded filename for use in an S3 key and URL path. Strips
 * path separators (no traversal into another prefix) and anything outside a
 * URL-safe set, so the result is always a single LOGO_KEY_PATTERN segment.
 */
export function sanitizeLogoFilename(name: string): string {
  const base = name.split(PATH_SEPARATOR).pop() ?? "logo";
  return base.replace(UNSAFE_FILENAME_CHARS, "-") || "logo";
}
