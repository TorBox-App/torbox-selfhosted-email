/**
 * Delete the DNS records `email init` created for outbound sending, and only
 * those records.
 *
 * The delete list is derived from `buildEmailDNSRecords` (minus the apex SPF
 * category — see below) so create and delete can never drift: if a seventh
 * outbound record is ever added there, teardown picks it up for free. Do not
 * hardcode the record list here.
 *
 * Every deletion is matched on name + type + exact value, never name+type
 * alone: a name can carry several TXT or MX records (a customer's own DMARC
 * policy, a verification TXT, an existing MX provider), and deleting "the
 * first one" can remove a record Wraps did not create. Route53 `DELETE`
 * removes an entire record set, so a set carrying non-Wraps values is
 * `UPSERT`ed with Wraps' value subtracted — never bare-`DELETE`d.
 *
 * The apex SPF record (`category: "spf"`) is deliberately excluded: it may
 * carry other providers' includes merged into Wraps', so removing
 * `include:amazonses.com` from it is a *rewrite*, not a deletion. That is a
 * different, riskier operation and stays out of scope here — the apex SPF
 * record is filtered out before it ever reaches a provider branch, so it can
 * never appear in any emitted change.
 */

import {
  type Change,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
  type ListResourceRecordSetsCommandOutput,
  Route53Client,
} from "@aws-sdk/client-route-53";
import { CloudflareDNSClient } from "./cloudflare.js";
import {
  buildEmailDNSRecords,
  type DNSRecordInfo,
  type ExistingRoute53RecordSet,
  listExistingRoute53InboundRecords,
  normalizeRoute53Name,
} from "./create-records.js";
import type { DNSCredentials } from "./credentials.js";
import type { EmailDNSRecordData } from "./types.js";
import { VercelDNSClient } from "./vercel.js";

export type EmailDNSCleanupResult = {
  /** Records deleted, as "TYPE name" strings, for display. */
  deleted: string[];
  /** Records left in place, with the reason. */
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
): Promise<EmailDNSCleanupResult> {
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
 * Read the existing CNAME record set at `name` in a Route53 hosted zone,
 * following pagination until the target name's record is found or the zone
 * is exhausted. Mirrors `listExistingRoute53InboundRecords`'s pagination
 * exactly, narrowed to a single type: that helper only reads MX and TXT, so
 * DKIM and tracking CNAMEs need their own lookup.
 */
async function listRoute53RecordSet(
  client: Route53Client,
  hostedZoneId: string,
  name: string,
  type: "CNAME"
): Promise<ExistingRoute53RecordSet | undefined> {
  const targetName = normalizeRoute53Name(name);

  let startRecordName: string | undefined = name;
  let startRecordType: "CNAME" | undefined;
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
      if (rrset.Type === type) {
        return {
          ttl: rrset.TTL,
          values: (rrset.ResourceRecords ?? [])
            .map((r) => r.Value)
            .filter((v): v is string => Boolean(v)),
        };
      }
    }

    if (movedPastTarget || !response.IsTruncated) {
      break;
    }

    startRecordName = response.NextRecordName;
    startRecordType = response.NextRecordType as "CNAME" | undefined;
    if (!startRecordName) {
      break;
    }
  }
}

/**
 * Build the Route53 Change that removes a single value from a record set,
 * generalising plan 310's MX/TXT removal logic (`buildRoute53InboundMXRemoval`
 * / `buildRoute53InboundTXTRemoval`) across MX, TXT, and CNAME alike — the
 * subtraction rule is identical for all three, once each record's value is
 * expressed in Route53's on-the-wire form (see the call sites below).
 *
 * A record set is `DELETE`d only when Wraps' value is its sole member.
 * When other values are present, the set is `UPSERT`ed with Wraps' value
 * subtracted, preserving the existing TTL — never a bare `DELETE`, which
 * would remove the whole set. When Wraps' value is not present at all
 * (whether because no set exists at that name, or because a different value
 * is there), no change is made and the reason is reported rather than
 * silently doing nothing.
 */
function buildRoute53RemovalChange(params: {
  name: string;
  type: "MX" | "TXT" | "CNAME";
  sesValue: string;
  existing: ExistingRoute53RecordSet | undefined;
}): { change: Change | null; skippedReason?: string } {
  const { name, type, sesValue, existing } = params;
  const values = existing?.values ?? [];

  if (!values.includes(sesValue)) {
    return {
      change: null,
      skippedReason: `The ${type} record set at ${name} does not contain the value Wraps created — leaving it in place.`,
    };
  }

  const remaining = values.filter((value) => value !== sesValue);

  if (remaining.length === 0) {
    return {
      change: {
        Action: "DELETE",
        ResourceRecordSet: {
          Name: name,
          Type: type,
          TTL: existing?.ttl ?? 1800,
          ResourceRecords: values.map((value) => ({ Value: value })),
        },
      },
    };
  }

  return {
    change: {
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: name,
        Type: type,
        TTL: existing?.ttl ?? 1800,
        ResourceRecords: remaining.map((value) => ({ Value: value })),
      },
    },
  };
}

/** Express a record's value the way Route53 stores it, per type. */
function route53Value(record: DNSRecordInfo): string {
  if (record.type === "MX") {
    return `${record.priority} ${record.value}`;
  }
  if (record.type === "TXT") {
    return `"${record.value}"`;
  }
  return record.value;
}

async function deleteRoute53EmailRecords(
  hostedZoneId: string,
  region: string,
  records: DNSRecordInfo[]
): Promise<EmailDNSCleanupResult> {
  const client = new Route53Client({ region });

  const mxTxtNames = new Set<string>();
  const cnameNames = new Set<string>();
  for (const record of records) {
    if (record.type === "CNAME") {
      cnameNames.add(record.name);
    } else {
      mxTxtNames.add(record.name);
    }
  }

  const mxTxtByName = new Map<
    string,
    Map<"MX" | "TXT", ExistingRoute53RecordSet>
  >();
  const cnameByName = new Map<string, ExistingRoute53RecordSet | undefined>();

  try {
    for (const name of mxTxtNames) {
      mxTxtByName.set(
        name,
        await listExistingRoute53InboundRecords(client, hostedZoneId, name)
      );
    }
    for (const name of cnameNames) {
      cnameByName.set(
        name,
        await listRoute53RecordSet(client, hostedZoneId, name, "CNAME")
      );
    }
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

  for (const record of records) {
    const label = `${record.type} ${record.name}`;
    const existing: ExistingRoute53RecordSet | undefined =
      record.type === "CNAME"
        ? cnameByName.get(record.name)
        : mxTxtByName.get(record.name)?.get(record.type);

    const result = buildRoute53RemovalChange({
      name: record.name,
      type: record.type,
      sesValue: route53Value(record),
      existing,
    });

    if (result.change) {
      changes.push(result.change);
      deleted.push(label);
    } else if (result.skippedReason) {
      skipped.push({ record: label, reason: result.skippedReason });
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
 * Delete the outbound email DNS records (DKIM, DMARC, tracking CNAME, MAIL
 * FROM MX+SPF) `email init` created, using the appropriate provider. Never
 * touches the apex SPF record — see the module doc comment.
 */
export async function deleteEmailDNSRecordsForProvider(
  credentials: DNSCredentials,
  data: EmailDNSRecordData
): Promise<EmailDNSCleanupResult> {
  const records = buildEmailDNSRecords(data).filter(
    (record) => record.category !== "spf"
  );

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
        data.domain,
        credentials.token,
        credentials.teamId
      );
      return deleteViaValueMatchedClient(client, records);
    }

    case "route53":
      return deleteRoute53EmailRecords(
        credentials.hostedZoneId,
        data.region,
        records
      );

    case "manual":
      return { deleted: [], skipped: [], supported: false, errors: [] };
  }
}
