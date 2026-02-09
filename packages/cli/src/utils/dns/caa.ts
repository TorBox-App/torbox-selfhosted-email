/**
 * CAA (Certificate Authority Authorization) record utilities
 *
 * CAA records control which Certificate Authorities can issue certificates for a domain.
 * AWS ACM uses Amazon as the CA, so we need to ensure amazon.com is allowed.
 *
 * IMPORTANT: Some DNS providers (like Vercel) have implicit CAA records that don't
 * show up in their API. Vercel automatically adds a CAA record for letsencrypt.org
 * but doesn't expose it. So we always add the Amazon CAA record for Vercel to be safe.
 */

import type { DNSCredentials } from "./credentials.js";

/**
 * Result of CAA check
 */
export type CAACheckResult = {
  allowed: boolean;
  hasCAA: boolean;
  existingCAs: string[];
};

/**
 * Ensure Amazon is allowed to issue certificates for a domain
 *
 * For Vercel: Always adds the Amazon CAA record because Vercel has implicit
 * CAA records (for letsencrypt.org) that don't show in their API.
 *
 * For Cloudflare: Checks existing CAA records and adds Amazon if needed.
 *
 * @returns true if Amazon is now allowed, false if we couldn't add the record
 */
export async function ensureAmazonCAAAllowed(
  credentials: DNSCredentials,
  domain: string
): Promise<{
  success: boolean;
  wasAlreadyAllowed: boolean;
  recordCreated: boolean;
  error?: string;
}> {
  if (credentials.provider === "manual" || credentials.provider === "route53") {
    // For manual or Route53, we can't automatically add CAA records
    // Route53 would need separate handling
    return { success: true, wasAlreadyAllowed: true, recordCreated: false };
  }

  try {
    if (credentials.provider === "vercel") {
      const { VercelDNSClient } = await import("./vercel.js");
      const client = new VercelDNSClient(
        domain,
        credentials.token,
        credentials.teamId
      );

      // Check if Amazon CAA already exists in Vercel's records
      const caaStatus = await client.isAmazonCAAAllowed();

      // If Amazon is explicitly in Vercel's records, we're good
      if (caaStatus.hasCAA && caaStatus.allowed) {
        return { success: true, wasAlreadyAllowed: true, recordCreated: false };
      }

      // ALWAYS add Amazon CAA for Vercel because:
      // 1. Vercel has implicit CAA records (letsencrypt.org) not shown in API
      // 2. These implicit records block other CAs like Amazon
      // 3. Adding amazon.com explicitly allows ACM to issue certificates
      const added = await client.addAmazonCAARecord();
      if (added) {
        return { success: true, wasAlreadyAllowed: false, recordCreated: true };
      }

      return {
        success: false,
        wasAlreadyAllowed: false,
        recordCreated: false,
        error: "Failed to create CAA record in Vercel DNS",
      };
    }

    if (credentials.provider === "cloudflare") {
      const { CloudflareDNSClient } = await import("./cloudflare.js");
      const client = new CloudflareDNSClient(
        credentials.zoneId,
        credentials.token
      );

      const caaStatus = await client.isAmazonCAAAllowed();

      if (caaStatus.allowed) {
        return { success: true, wasAlreadyAllowed: true, recordCreated: false };
      }

      // Need to add Amazon CAA record
      const added = await client.addAmazonCAARecord();
      if (added) {
        return { success: true, wasAlreadyAllowed: false, recordCreated: true };
      }

      return {
        success: false,
        wasAlreadyAllowed: false,
        recordCreated: false,
        error: "Failed to create CAA record in Cloudflare DNS",
      };
    }

    return { success: true, wasAlreadyAllowed: true, recordCreated: false };
  } catch (error) {
    return {
      success: false,
      wasAlreadyAllowed: false,
      recordCreated: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
