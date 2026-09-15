/**
 * Unified DNS record creation for multiple providers
 */

import {
  type Change,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
  type ListResourceRecordSetsCommandOutput,
  Route53Client,
} from "@aws-sdk/client-route-53";
import pc from "picocolors";
import {
  createSelectedDNSRecords,
  type ProposedDNSRecord,
} from "../route53.js";
import { isAWSError } from "../shared/errors.js";
import { CloudflareDNSClient } from "./cloudflare.js";
import type { DNSCredentials } from "./credentials.js";
import type { DNSCreationResult, EmailDNSRecordData } from "./types.js";
import { VercelDNSClient } from "./vercel.js";

/**
 * DNS record category type
 */
export type DNSRecordCategory =
  | "dkim"
  | "spf"
  | "dmarc"
  | "tracking"
  | "mailfrom_mx"
  | "mailfrom_spf"
  | "inbound_mx"
  | "inbound_spf";

/**
 * DNS record to be created
 */
export type DNSRecordInfo = {
  name: string;
  type: "CNAME" | "TXT" | "MX";
  value: string;
  priority?: number;
  category: DNSRecordCategory;
};

/**
 * Human-readable descriptions for each DNS record category
 */
export const DNS_RECORD_DESCRIPTIONS: Record<
  DNSRecordCategory,
  { label: string; purpose: string; impact: string }
> = {
  dkim: {
    label: "DKIM (3 CNAMEs)",
    purpose: "Cryptographic signatures proving emails are from your domain",
    impact: "Required — without DKIM, emails will likely land in spam",
  },
  spf: {
    label: "SPF (TXT)",
    purpose: "Authorizes Amazon SES to send email on behalf of your domain",
    impact: "Required — prevents spoofing and improves deliverability",
  },
  dmarc: {
    label: "DMARC (TXT)",
    purpose: "Policy for how receivers handle emails failing DKIM/SPF checks",
    impact: "Recommended — skip if you already have a DMARC policy",
  },
  tracking: {
    label: "Tracking (CNAME)",
    purpose: "Routes open/click tracking through your domain instead of AWS",
    impact: "Optional — improves brand consistency in tracked links",
  },
  mailfrom_mx: {
    label: "MAIL FROM MX",
    purpose: "Routes bounce notifications to SES for proper bounce handling",
    impact: "Recommended — required for full DMARC alignment",
  },
  mailfrom_spf: {
    label: "MAIL FROM SPF (TXT)",
    purpose: "Authorizes SES to send from the MAIL FROM subdomain",
    impact: "Required when using custom MAIL FROM domain",
  },
  inbound_mx: {
    label: "Inbound MX",
    purpose: "Routes incoming email to AWS SES for processing",
    impact: "Required for inbound email receiving",
  },
  inbound_spf: {
    label: "Inbound SPF (TXT)",
    purpose: "Authorizes SES for the inbound receiving domain",
    impact: "Required for inbound email receiving",
  },
};

/**
 * Build the list of DNS records needed for email authentication
 */
export function buildEmailDNSRecords(
  data: EmailDNSRecordData
): DNSRecordInfo[] {
  const {
    domain,
    dkimTokens,
    mailFromDomain,
    customTrackingDomain,
    trackingCnameTarget,
    region,
  } = data;
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
    value: `v=DMARC1; p=quarantine; sp=quarantine; np=reject; rua=mailto:postmaster@${dmarcRuaDomain}`,
    category: "dmarc",
  });

  // Custom tracking domain CNAME (if configured)
  if (customTrackingDomain) {
    records.push({
      name: customTrackingDomain,
      type: "CNAME",
      value: trackingCnameTarget ?? `r.${region}.awstrack.me`,
      category: "tracking",
    });
  }

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
 * Format all DNS records for manual setup with descriptions
 */
export function formatManualDNSInstructions(records: DNSRecordInfo[]): string {
  const categories = [...new Set(records.map((r) => r.category))];
  const lines: string[] = [];

  for (const cat of categories) {
    const catRecords = records.filter((r) => r.category === cat);
    const desc = DNS_RECORD_DESCRIPTIONS[cat];

    lines.push(pc.bold(desc.label));
    lines.push(pc.dim(desc.purpose));
    lines.push(pc.dim(desc.impact));
    lines.push("");

    for (const record of catRecords) {
      const value = record.priority
        ? `${record.priority} ${record.value}`
        : record.value;
      lines.push(`  ${pc.cyan(record.type.padEnd(6))} ${record.name}`);
      lines.push(`  ${pc.dim("→")}      ${pc.green(value)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Create DNS records using the appropriate provider.
 *
 * `options.replaceExisting`: Route53's UPSERT already replaces a record with
 * the same name+type, but Vercel's and Cloudflare's `createRecord` always
 * POSTs a new one — calling it again for a name that already exists (e.g.
 * swapping the tracking CNAME from awstrack.me to a CloudFront domain once
 * HTTPS activates) would leave two records instead of one. Pass `true` to
 * delete any existing record with the same name+type first.
 */
export async function createDNSRecordsForProvider(
  credentials: DNSCredentials,
  data: EmailDNSRecordData,
  selectedCategories?: Set<ProposedDNSRecord["category"]>,
  options?: { replaceExisting?: boolean }
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
          "tracking",
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
          data.customTrackingDomain,
          data.mailFromDomain,
          data.trackingCnameTarget
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
        if (data.customTrackingDomain && categories.has("tracking")) {
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
      if (selectedCategories) {
        const records = buildEmailDNSRecords(data);
        const filtered = records.filter((r) =>
          selectedCategories.has(r.category)
        );
        if (options?.replaceExisting) {
          for (const record of filtered) {
            await client.deleteRecordIfExists(record.name, record.type);
          }
        }
        return client.createRecords(filtered);
      }
      return client.createEmailRecords(data);
    }

    case "cloudflare": {
      const client = new CloudflareDNSClient(
        credentials.zoneId,
        credentials.token
      );
      if (selectedCategories) {
        const records = buildEmailDNSRecords(data);
        const filtered = records.filter((r) =>
          selectedCategories.has(r.category)
        );
        if (options?.replaceExisting) {
          for (const record of filtered) {
            await client.deleteRecordIfExists(record.name, record.type);
          }
        }
        return client.createRecords(filtered);
      }
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

/** Existing Route53 record set data relevant to the inbound write. */
export type ExistingRoute53RecordSet = {
  ttl?: number;
  values: string[];
};

/**
 * Strip a single trailing dot and lowercase, so `example.com` and
 * `Example.com.` (as Route53 returns it) compare equal.
 */
export function normalizeRoute53Name(name: string): string {
  return name.replace(/\.$/, "").toLowerCase();
}

/**
 * Read the existing MX and TXT record sets at `name` in a Route53 hosted
 * zone, following pagination until the target name's records are found or
 * the zone is exhausted.
 *
 * Route53 `UPSERT` replaces an entire record set — it does not append — so
 * the inbound write must know what is already there (e.g. a customer's
 * existing Google Workspace MX records) before composing its own UPSERT.
 */
export async function listExistingRoute53InboundRecords(
  client: Route53Client,
  hostedZoneId: string,
  name: string
): Promise<Map<"MX" | "TXT", ExistingRoute53RecordSet>> {
  const targetName = normalizeRoute53Name(name);
  const found = new Map<"MX" | "TXT", ExistingRoute53RecordSet>();

  let startRecordName: string | undefined = name;
  let startRecordType: "MX" | "TXT" | undefined;
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response: ListResourceRecordSetsCommandOutput = await client.send(
      new ListResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        StartRecordName: startRecordName,
        StartRecordType: startRecordType,
      })
    );

    const rrsets = response.ResourceRecordSets ?? [];
    let movedPastTarget = false;

    for (const rrset of rrsets) {
      if (!(rrset.Name && rrset.Type)) {
        continue;
      }
      if (normalizeRoute53Name(rrset.Name) !== targetName) {
        movedPastTarget = true;
        break;
      }
      if (rrset.Type === "MX" || rrset.Type === "TXT") {
        found.set(rrset.Type, {
          ttl: rrset.TTL,
          values: (rrset.ResourceRecords ?? [])
            .map((r) => r.Value)
            .filter((v): v is string => Boolean(v)),
        });
      }
    }

    if (movedPastTarget || !response.IsTruncated) {
      break;
    }

    startRecordName = response.NextRecordName;
    startRecordType = response.NextRecordType as "MX" | "TXT" | undefined;
    if (!startRecordName) {
      break;
    }
  }

  return found;
}

/**
 * Build the Route53 Change for the inbound MX record, merging with any
 * existing MX values rather than replacing them.
 * Returns null when no change is needed (the SES value is already present).
 */
function buildRoute53InboundMXChange(
  record: DNSRecordInfo,
  existing: ExistingRoute53RecordSet | undefined
): Change | null {
  const sesValue = `${record.priority} ${record.value}`;

  if (!existing) {
    return {
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: record.name,
        Type: "MX",
        TTL: 1800,
        ResourceRecords: [{ Value: sesValue }],
      },
    };
  }

  if (existing.values.includes(sesValue)) {
    return null;
  }

  const union = Array.from(new Set([...existing.values, sesValue]));
  return {
    Action: "UPSERT",
    ResourceRecordSet: {
      Name: record.name,
      Type: "MX",
      TTL: existing.ttl ?? 1800,
      ResourceRecords: union.map((value) => ({ Value: value })),
    },
  };
}

/**
 * Build the Route53 Change for the inbound SPF TXT record.
 *
 * Never appends a second `v=spf1` value — two SPF records on one name is a
 * PermError under RFC 7208 §4.5, so an existing SPF record is left alone and
 * reported back via `skippedReason` rather than merged or replaced.
 * A non-SPF TXT (e.g. a `google-site-verification=` value) is preserved by
 * unioning it with the new SPF value.
 */
function buildRoute53InboundTXTChange(
  record: DNSRecordInfo,
  existing: ExistingRoute53RecordSet | undefined
): { change: Change | null; skippedReason?: string } {
  const hasExistingSpf = (existing?.values ?? []).some((value) =>
    value.replace(/^"|"$/g, "").startsWith("v=spf1")
  );

  if (hasExistingSpf) {
    return {
      change: null,
      skippedReason: `Skipped SPF record for ${record.name}: an SPF (v=spf1) TXT record already exists there, and two v=spf1 records on one name is invalid (RFC 7208). Add "include:amazonses.com" to the existing record yourself.`,
    };
  }

  const sesValue = `"${record.value}"`;

  if (!existing) {
    return {
      change: {
        Action: "UPSERT",
        ResourceRecordSet: {
          Name: record.name,
          Type: "TXT",
          TTL: 1800,
          ResourceRecords: [{ Value: sesValue }],
        },
      },
    };
  }

  if (existing.values.includes(sesValue)) {
    return { change: null };
  }

  const union = Array.from(new Set([...existing.values, sesValue]));
  return {
    change: {
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: record.name,
        Type: "TXT",
        TTL: existing.ttl ?? 1800,
        ResourceRecords: union.map((value) => ({ Value: value })),
      },
    },
  };
}

/**
 * Translate a Route53 failure into a DNSCreationResult with a specific,
 * actionable message. A matching `error.name` is trustworthy; per the AWS
 * SDK v3 caveat, a non-matching name proves nothing, so unrecognised errors
 * fall through to a generic (but clearly labelled) message rather than being
 * misclassified.
 */
function classifyRoute53Error(
  error: unknown,
  operation: "ListResourceRecordSets" | "ChangeResourceRecordSets",
  hostedZoneId: string
): DNSCreationResult {
  if (!isAWSError(error)) {
    return {
      success: false,
      recordsCreated: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }

  if (error.name === "NoSuchHostedZone") {
    return {
      success: false,
      recordsCreated: 0,
      errors: [`Route53 hosted zone ${hostedZoneId} was not found.`],
    };
  }

  if (error.name === "AccessDenied" || error.name === "AccessDeniedException") {
    const permission =
      operation === "ListResourceRecordSets"
        ? "route53:ListResourceRecordSets"
        : "route53:ChangeResourceRecordSets";
    return {
      success: false,
      recordsCreated: 0,
      errors: [
        `Missing IAM permission ${permission} on hosted zone ${hostedZoneId}.`,
      ],
    };
  }

  if (error.name === "InvalidChangeBatch") {
    return {
      success: false,
      recordsCreated: 0,
      errors: [error.message],
    };
  }

  if (error.name === "PriorRequestNotComplete" || error.name === "Throttling") {
    return {
      success: false,
      recordsCreated: 0,
      errors: [`Route53 is busy (${error.name}) — retry in a moment.`],
    };
  }

  return {
    success: false,
    recordsCreated: 0,
    errors: [`Unclassified Route53 ${operation} failure: ${error.message}`],
  };
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
      const client = new Route53Client({ region });

      let existing: Map<"MX" | "TXT", ExistingRoute53RecordSet>;
      try {
        existing = await listExistingRoute53InboundRecords(
          client,
          credentials.hostedZoneId,
          receivingDomain
        );
      } catch (error) {
        return classifyRoute53Error(
          error,
          "ListResourceRecordSets",
          credentials.hostedZoneId
        );
      }

      const changes: Change[] = [];
      const skipped: string[] = [];

      for (const record of records) {
        if (record.type === "MX") {
          const change = buildRoute53InboundMXChange(
            record,
            existing.get("MX")
          );
          if (change) {
            changes.push(change);
          }
        } else if (record.type === "TXT") {
          const { change, skippedReason } = buildRoute53InboundTXTChange(
            record,
            existing.get("TXT")
          );
          if (change) {
            changes.push(change);
          }
          if (skippedReason) {
            skipped.push(skippedReason);
          }
        }
      }

      if (changes.length === 0) {
        return {
          success: true,
          recordsCreated: 0,
          ...(skipped.length > 0 ? { errors: skipped } : {}),
        };
      }

      try {
        await client.send(
          new ChangeResourceRecordSetsCommand({
            HostedZoneId: credentials.hostedZoneId,
            ChangeBatch: { Changes: changes },
          })
        );
        return {
          success: true,
          recordsCreated: changes.length,
          ...(skipped.length > 0 ? { errors: skipped } : {}),
        };
      } catch (error) {
        return classifyRoute53Error(
          error,
          "ChangeResourceRecordSets",
          credentials.hostedZoneId
        );
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
