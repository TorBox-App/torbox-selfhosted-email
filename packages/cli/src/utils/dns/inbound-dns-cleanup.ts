/**
 * Delete the DNS records `inbound add` created, and only those records.
 *
 * The delete list is derived from `buildInboundDNSRecords` so create and
 * delete can never drift — if a third inbound record is ever added there,
 * removal picks it up for free. Do not hardcode the two records here.
 *
 * Every deletion is matched on name + type + exact value, never name+type
 * alone: a name can carry several TXT or MX records (a customer's own SPF,
 * a `google-site-verification` value, an existing MX provider), and deleting
 * "the first one" can remove a record Wraps did not create.
 */

import {
  type Change,
  ChangeResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { CloudflareDNSClient } from "./cloudflare.js";
import {
  buildInboundDNSRecords,
  type DNSRecordInfo,
  type ExistingRoute53RecordSet,
  listExistingRoute53InboundRecords,
} from "./create-records.js";
import type { DNSCredentials } from "./credentials.js";
import { VercelDNSClient } from "./vercel.js";

export type InboundDNSCleanupResult = {
  /** Records deleted, as "TYPE name" strings, for display. */
  deleted: string[];
  /** Records left in place, with the reason (value did not match, provider unreadable). */
  skipped: Array<{ record: string; reason: string }>;
  /** False when the provider cannot be cleaned automatically (manual / unknown). */
  supported: boolean;
  errors: string[];
};

/** Minimal shape both provider clients expose for value-matched deletion. */
type ValueMatchedDeleteClient = {
  deleteRecordsByValue(
    name: string,
    type: string,
    value: string
  ): Promise<{ deleted: number; error?: string }>;
};

async function deleteViaValueMatchedClient(
  client: ValueMatchedDeleteClient,
  records: DNSRecordInfo[]
): Promise<InboundDNSCleanupResult> {
  const deleted: string[] = [];
  const skipped: Array<{ record: string; reason: string }> = [];
  const errors: string[] = [];

  for (const record of records) {
    const label = `${record.type} ${record.name}`;
    const result = await client.deleteRecordsByValue(
      record.name,
      record.type,
      record.value
    );

    if (result.error) {
      errors.push(`${label}: ${result.error}`);
    } else if (result.deleted > 0) {
      for (let i = 0; i < result.deleted; i++) {
        deleted.push(label);
      }
    } else {
      skipped.push({
        record: label,
        reason: "no record with the value Wraps created",
      });
    }
  }

  return { deleted, skipped, supported: true, errors };
}

/**
 * Build the Route53 Change that removes the inbound MX record's SES value.
 *
 * Mirrors plan 309's create-side merge logic in reverse: an MX record set is
 * removed entirely only when the SES value is its sole member. When other
 * values are present (e.g. a customer's own Google Workspace MX records),
 * emit an UPSERT with the SES value subtracted — never a bare DELETE, which
 * would remove the whole record set.
 */
function buildRoute53InboundMXRemoval(
  record: DNSRecordInfo,
  existing: ExistingRoute53RecordSet | undefined
): { change: Change | null; skippedReason?: string } {
  const sesValue = `${record.priority} ${record.value}`;

  if (!existing) {
    // No MX set at all at this name — nothing to report, there was never
    // anything to remove.
    return { change: null };
  }

  if (!existing.values.includes(sesValue)) {
    return {
      change: null,
      skippedReason: `The MX record set at ${record.name} does not contain the value Wraps created (${sesValue}) — leaving it in place.`,
    };
  }

  const remaining = existing.values.filter((value) => value !== sesValue);

  if (remaining.length === 0) {
    return {
      change: {
        Action: "DELETE",
        ResourceRecordSet: {
          Name: record.name,
          Type: "MX",
          TTL: existing.ttl ?? 1800,
          ResourceRecords: existing.values.map((value) => ({ Value: value })),
        },
      },
    };
  }

  return {
    change: {
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: record.name,
        Type: "MX",
        TTL: existing.ttl ?? 1800,
        ResourceRecords: remaining.map((value) => ({ Value: value })),
      },
    },
  };
}

/**
 * Build the Route53 Change that removes the inbound SPF TXT record's SES
 * value.
 *
 * Only ever removes the exact `v=spf1 include:amazonses.com ~all` value
 * created by `inbound add`. If the record at that name is missing the SES
 * value entirely but does carry a *different* v=spf1 value, it was not
 * created by Wraps (or was hand-edited since) — skip it and say why rather
 * than touching a customer's own SPF policy.
 */
function buildRoute53InboundTXTRemoval(
  record: DNSRecordInfo,
  existing: ExistingRoute53RecordSet | undefined
): { change: Change | null; skippedReason?: string } {
  const sesValue = `"${record.value}"`;

  if (!existing) {
    return { change: null };
  }

  if (existing.values.includes(sesValue)) {
    const remaining = existing.values.filter((value) => value !== sesValue);

    if (remaining.length === 0) {
      return {
        change: {
          Action: "DELETE",
          ResourceRecordSet: {
            Name: record.name,
            Type: "TXT",
            TTL: existing.ttl ?? 1800,
            ResourceRecords: existing.values.map((value) => ({
              Value: value,
            })),
          },
        },
      };
    }

    return {
      change: {
        Action: "UPSERT",
        ResourceRecordSet: {
          Name: record.name,
          Type: "TXT",
          TTL: existing.ttl ?? 1800,
          ResourceRecords: remaining.map((value) => ({ Value: value })),
        },
      },
    };
  }

  const hasDifferentSpf = existing.values.some((value) =>
    value.replace(/^"|"$/g, "").startsWith("v=spf1")
  );

  if (hasDifferentSpf) {
    return {
      change: null,
      skippedReason: `The SPF (v=spf1) TXT record at ${record.name} does not match what Wraps created — leaving it in place.`,
    };
  }

  return { change: null };
}

async function deleteRoute53InboundRecords(
  hostedZoneId: string,
  receivingDomain: string,
  region: string,
  records: DNSRecordInfo[]
): Promise<InboundDNSCleanupResult> {
  const client = new Route53Client({ region });

  let existing: Map<"MX" | "TXT", ExistingRoute53RecordSet>;
  try {
    existing = await listExistingRoute53InboundRecords(
      client,
      hostedZoneId,
      receivingDomain
    );
  } catch (error) {
    return {
      deleted: [],
      skipped: [],
      supported: true,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }

  const changes: Change[] = [];
  const deleted: string[] = [];
  const skipped: Array<{ record: string; reason: string }> = [];

  const mxRecord = records.find((r) => r.type === "MX");
  const txtRecord = records.find((r) => r.type === "TXT");

  if (mxRecord) {
    const result = buildRoute53InboundMXRemoval(mxRecord, existing.get("MX"));
    if (result.change) {
      changes.push(result.change);
      deleted.push(`MX ${mxRecord.name}`);
    } else if (result.skippedReason) {
      skipped.push({
        record: `MX ${mxRecord.name}`,
        reason: result.skippedReason,
      });
    }
  }

  if (txtRecord) {
    const result = buildRoute53InboundTXTRemoval(
      txtRecord,
      existing.get("TXT")
    );
    if (result.change) {
      changes.push(result.change);
      deleted.push(`TXT ${txtRecord.name}`);
    } else if (result.skippedReason) {
      skipped.push({
        record: `TXT ${txtRecord.name}`,
        reason: result.skippedReason,
      });
    }
  }

  if (changes.length === 0) {
    return { deleted, skipped, supported: true, errors: [] };
  }

  try {
    await client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        ChangeBatch: { Changes: changes },
      })
    );
    return { deleted, skipped, supported: true, errors: [] };
  } catch (error) {
    return {
      deleted: [],
      skipped,
      supported: true,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Delete the inbound DNS records (MX + SPF) `inbound add` created for
 * `receivingDomain`, using the appropriate provider.
 *
 * @param parentDomain - The root domain (e.g., "wraps.dev") needed for Vercel DNS zone
 */
export async function deleteInboundDNSRecordsForProvider(
  credentials: DNSCredentials,
  receivingDomain: string,
  region: string,
  parentDomain: string
): Promise<InboundDNSCleanupResult> {
  const records = buildInboundDNSRecords(receivingDomain, region);

  switch (credentials.provider) {
    case "cloudflare": {
      const client = new CloudflareDNSClient(
        credentials.zoneId,
        credentials.token
      );
      return deleteViaValueMatchedClient(client, records);
    }

    case "vercel": {
      const client = new VercelDNSClient(
        parentDomain,
        credentials.token,
        credentials.teamId
      );
      return deleteViaValueMatchedClient(client, records);
    }

    case "route53":
      return deleteRoute53InboundRecords(
        credentials.hostedZoneId,
        receivingDomain,
        region,
        records
      );

    case "manual":
      return { deleted: [], skipped: [], supported: false, errors: [] };
  }
}
