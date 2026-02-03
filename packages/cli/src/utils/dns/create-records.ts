/**
 * Unified DNS record creation for multiple providers
 */

import {
  ChangeResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";
import {
  createSelectedDNSRecords,
  type ProposedDNSRecord,
} from "../route53.js";
import { CloudflareDNSClient } from "./cloudflare.js";
import type { DNSCredentials } from "./credentials.js";
import type { DNSCreationResult, EmailDNSRecordData } from "./types.js";
import { VercelDNSClient } from "./vercel.js";

/**
 * DNS record to be created
 */
export type DNSRecordInfo = {
  name: string;
  type: "CNAME" | "TXT" | "MX";
  value: string;
  priority?: number;
  category:
    | "dkim"
    | "spf"
    | "dmarc"
    | "tracking"
    | "mailfrom_mx"
    | "mailfrom_spf"
    | "inbound_mx"
    | "inbound_spf";
};

/**
 * Build the list of DNS records needed for email authentication
 */
export function buildEmailDNSRecords(
  data: EmailDNSRecordData
): DNSRecordInfo[] {
  const { domain, dkimTokens, mailFromDomain, region } = data;
  const records: DNSRecordInfo[] = [];

  // DKIM CNAME records (3 records)
  for (const token of dkimTokens) {
    records.push({
      name: `${token}._domainkey.${domain}`,
      type: "CNAME",
      value: `${token}.dkim.amazonses.com`,
      category: "dkim",
    });
  }

  // SPF TXT record for the domain
  records.push({
    name: domain,
    type: "TXT",
    value: "v=spf1 include:amazonses.com ~all",
    category: "spf",
  });

  // DMARC TXT record
  const dmarcRuaDomain = mailFromDomain || domain;
  records.push({
    name: `_dmarc.${domain}`,
    type: "TXT",
    value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${dmarcRuaDomain}`,
    category: "dmarc",
  });

  // MAIL FROM domain records (if configured)
  if (mailFromDomain) {
    // MX record for bounce handling
    records.push({
      name: mailFromDomain,
      type: "MX",
      value: `feedback-smtp.${region}.amazonses.com`,
      priority: 10,
      category: "mailfrom_mx",
    });

    // SPF TXT record for MAIL FROM subdomain
    records.push({
      name: mailFromDomain,
      type: "TXT",
      value: "v=spf1 include:amazonses.com ~all",
      category: "mailfrom_spf",
    });
  }

  return records;
}

/**
 * Build the list of DNS records needed for inbound email receiving
 */
export function buildInboundDNSRecords(
  receivingDomain: string,
  region: string
): DNSRecordInfo[] {
  const records: DNSRecordInfo[] = [];

  // MX record to route inbound email to SES
  records.push({
    name: receivingDomain,
    type: "MX",
    value: `inbound-smtp.${region}.amazonaws.com`,
    priority: 10,
    category: "inbound_mx",
  });

  // SPF record for the receiving domain
  records.push({
    name: receivingDomain,
    type: "TXT",
    value: "v=spf1 include:amazonses.com ~all",
    category: "inbound_spf",
  });

  return records;
}

/**
 * Format DNS records for display (manual setup)
 */
export function formatDNSRecordsForDisplay(
  records: DNSRecordInfo[]
): Array<{ name: string; type: string; value: string }> {
  return records.map((r) => ({
    name: r.name,
    type: r.type,
    value: r.priority ? `${r.priority} ${r.value}` : r.value,
  }));
}

/**
 * Create DNS records using the appropriate provider
 */
export async function createDNSRecordsForProvider(
  credentials: DNSCredentials,
  data: EmailDNSRecordData,
  selectedCategories?: Set<ProposedDNSRecord["category"]>
): Promise<DNSCreationResult> {
  switch (credentials.provider) {
    case "route53": {
      // Use existing Route53 function with category selection
      const categories: Set<ProposedDNSRecord["category"]> =
        selectedCategories ||
        new Set([
          "dkim",
          "spf",
          "dmarc",
          "mailfrom_mx",
          "mailfrom_spf",
          "inbound_mx",
          "inbound_spf",
        ] as ProposedDNSRecord["category"][]);

      try {
        await createSelectedDNSRecords(
          credentials.hostedZoneId,
          data.domain,
          data.dkimTokens,
          data.region,
          categories,
          undefined, // customTrackingDomain - not used here
          data.mailFromDomain
        );

        // Count records created based on selected categories
        let recordsCreated = 0;
        if (categories.has("dkim")) {
          recordsCreated += data.dkimTokens.length;
        }
        if (categories.has("spf")) {
          recordsCreated += 1;
        }
        if (categories.has("dmarc")) {
          recordsCreated += 1;
        }
        if (data.mailFromDomain) {
          if (categories.has("mailfrom_mx")) {
            recordsCreated += 1;
          }
          if (categories.has("mailfrom_spf")) {
            recordsCreated += 1;
          }
        }

        return {
          success: true,
          recordsCreated,
        };
      } catch (error) {
        return {
          success: false,
          recordsCreated: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
        };
      }
    }

    case "vercel": {
      const client = new VercelDNSClient(
        data.domain,
        credentials.token,
        credentials.teamId
      );
      return client.createEmailRecords(data);
    }

    case "cloudflare": {
      const client = new CloudflareDNSClient(
        credentials.zoneId,
        credentials.token
      );
      return client.createEmailRecords(data);
    }

    case "manual": {
      // Manual mode - user handles DNS themselves
      // Return success with 0 records created
      return {
        success: true,
        recordsCreated: 0,
      };
    }
  }
}

/**
 * Create inbound DNS records (MX + SPF) using the appropriate provider
 * @param parentDomain - The root domain (e.g., "wraps.dev") needed for Vercel DNS zone
 */
export async function createInboundDNSRecordsForProvider(
  credentials: DNSCredentials,
  receivingDomain: string,
  region: string,
  parentDomain: string
): Promise<DNSCreationResult> {
  const records = buildInboundDNSRecords(receivingDomain, region);

  switch (credentials.provider) {
    case "route53": {
      try {
        const client = new Route53Client({ region });
        await client.send(
          new ChangeResourceRecordSetsCommand({
            HostedZoneId: credentials.hostedZoneId,
            ChangeBatch: {
              Changes: records.map((r) => ({
                Action: "UPSERT" as const,
                ResourceRecordSet: {
                  Name: r.name,
                  Type: r.type,
                  TTL: 1800,
                  ResourceRecords: [
                    {
                      Value:
                        r.type === "MX"
                          ? `${r.priority} ${r.value}`
                          : r.type === "TXT"
                            ? `"${r.value}"`
                            : r.value,
                    },
                  ],
                },
              })),
            },
          })
        );
        return { success: true, recordsCreated: records.length };
      } catch (error) {
        return {
          success: false,
          recordsCreated: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
        };
      }
    }

    case "cloudflare": {
      const client = new CloudflareDNSClient(
        credentials.zoneId,
        credentials.token
      );
      return client.createRecords(records);
    }

    case "vercel": {
      const client = new VercelDNSClient(
        parentDomain,
        credentials.token,
        credentials.teamId
      );
      return client.createRecords(records);
    }

    case "manual":
      return { success: true, recordsCreated: 0 };
  }
}

/**
 * Get the display name for a DNS provider
 */
export function getDNSProviderDisplayName(
  provider: DNSCredentials["provider"]
): string {
  switch (provider) {
    case "route53":
      return "AWS Route53";
    case "vercel":
      return "Vercel DNS";
    case "cloudflare":
      return "Cloudflare";
    case "manual":
      return "Manual";
  }
}

/**
 * Get the URL for creating API tokens for a provider
 */
export function getDNSProviderTokenUrl(
  provider: "vercel" | "cloudflare"
): string {
  switch (provider) {
    case "vercel":
      return "https://vercel.com/account/tokens";
    case "cloudflare":
      return "https://dash.cloudflare.com/profile/api-tokens";
  }
}
