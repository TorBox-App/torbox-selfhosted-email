/**
 * Verify a Vercel Blob URL's pathname belongs to the given org's logo namespace.
 * Uploads are stored under `organization-logos/{orgId}/...`; this must hold
 * before allowing a delete, otherwise any owner/admin could delete another
 * org's blob by URL (cross-tenant IDOR).
 */
export function isOwnedOrgLogo(url: string, orgId: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname.includes(`organization-logos/${orgId}/`);
  } catch {
    return false;
  }
}
