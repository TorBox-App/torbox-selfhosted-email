/**
 * Preflight check for inbound MX/SPF writes.
 *
 * `createInboundDNSRecordsForProvider` writes an SES MX record and an SPF
 * TXT record with no visibility into what a caller is about to overwrite.
 * This module reads what already exists at the target name first, so a
 * command can warn or refuse before writing over a domain that already
 * receives mail elsewhere (e.g. Google Workspace, Microsoft 365).
 */

import { Route53Client } from "@aws-sdk/client-route-53";
import * as clack from "@clack/prompts";
import { errors } from "../shared/errors.js";
import { isJsonMode } from "../shared/json-output.js";
import { CloudflareDNSClient } from "./cloudflare.js";
import {
  listExistingRoute53InboundRecords,
  normalizeRoute53Name,
} from "./create-records.js";
import type { DNSCredentials } from "./credentials.js";
import { VercelDNSClient } from "./vercel.js";

export type InboundDNSPreflight = {
  /** False when the provider could not be read (manual, or an API failure). */
  checked: boolean;
  /** MX record values already present on the receiving domain. */
  existingMx: string[];
  /** v=spf1 TXT record values already present on the receiving domain. */
  existingSpf: string[];
  /** True when an MX pointing at SES for this region is already present. */
  alreadyPointsAtSes: boolean;
};

function stripQuotes(value: string): string {
  return value.replace(/^"|"$/g, "");
}

function toPreflight(
  mxValues: string[],
  txtValues: string[],
  region: string
): InboundDNSPreflight {
  const existingSpf = txtValues.filter((v) =>
    stripQuotes(v).startsWith("v=spf1")
  );
  const alreadyPointsAtSes = mxValues.some((v) =>
    v.includes(`inbound-smtp.${region}.amazonaws.com`)
  );

  return {
    checked: true,
    existingMx: mxValues,
    existingSpf,
    alreadyPointsAtSes,
  };
}

/**
 * Read the existing MX and SPF TXT records at `receivingDomain`, per
 * provider. Never throws: a read failure or an unreadable provider (manual)
 * returns `checked: false` with empty arrays, which callers must treat as
 * "proceed with a warning" — never as a false "nothing there".
 *
 * `parentDomain` is the registered zone (e.g. Vercel's `/v4/domains/{domain}`
 * resource, or the domain Cloudflare's `zoneId` credential was resolved
 * against) — the same role it plays in `createInboundDNSRecordsForProvider`.
 * `receivingDomain` is very often a subdomain of it
 * (`inbound.ts:152` — `subdomain ? \`${subdomain}.${domain}\` : domain`), and
 * every other `VercelDNSClient` construction in this codebase passes the
 * parent/apex domain, not the receiving one — constructing it with
 * `receivingDomain` would query the wrong Vercel zone for any non-apex
 * target.
 */
export async function checkInboundDNSPreflight(
  credentials: DNSCredentials,
  receivingDomain: string,
  region: string,
  parentDomain: string
): Promise<InboundDNSPreflight> {
  if (credentials.provider === "manual") {
    return {
      checked: false,
      existingMx: [],
      existingSpf: [],
      alreadyPointsAtSes: false,
    };
  }

  if (credentials.provider === "cloudflare") {
    try {
      const client = new CloudflareDNSClient(
        credentials.zoneId,
        credentials.token
      );
      const [mxRecords, txtRecords] = await Promise.all([
        client.listRecords(receivingDomain, "MX"),
        client.listRecords(receivingDomain, "TXT"),
      ]);
      return toPreflight(
        mxRecords.map((r) => r.content),
        txtRecords.map((r) => r.content),
        region
      );
    } catch {
      return {
        checked: false,
        existingMx: [],
        existingSpf: [],
        alreadyPointsAtSes: false,
      };
    }
  }

  if (credentials.provider === "vercel") {
    try {
      const client = new VercelDNSClient(
        parentDomain,
        credentials.token,
        credentials.teamId
      );
      const [mxRecords, txtRecords] = await Promise.all([
        client.listRecords(receivingDomain, "MX"),
        client.listRecords(receivingDomain, "TXT"),
      ]);
      return toPreflight(
        mxRecords.map((r) => r.content),
        txtRecords.map((r) => r.content),
        region
      );
    } catch {
      return {
        checked: false,
        existingMx: [],
        existingSpf: [],
        alreadyPointsAtSes: false,
      };
    }
  }

  // route53
  try {
    const client = new Route53Client({ region });
    const existing = await listExistingRoute53InboundRecords(
      client,
      credentials.hostedZoneId,
      normalizeRoute53Name(receivingDomain)
    );
    return toPreflight(
      existing.get("MX")?.values ?? [],
      existing.get("TXT")?.values ?? [],
      region
    );
  } catch {
    return {
      checked: false,
      existingMx: [],
      existingSpf: [],
      alreadyPointsAtSes: false,
    };
  }
}

/**
 * A single, shared decision from a preflight result — the three inbound DNS
 * write call sites (`inboundInit`, `inboundAdd`, `replyInit`) share this
 * wording rather than each writing its own copy of the safety check.
 */
export type InboundDNSConflict = {
  severity: "ok" | "spf-conflict" | "mx-conflict" | "unverified";
  message: string;
};

/**
 * Describe what a preflight result means for the write that is about to
 * happen at `receivingDomain`. This is read-only — it never blocks a write
 * by itself; callers decide what to do with the severity (warn, confirm, or
 * refuse).
 */
export function describeInboundDNSConflict(
  preflight: InboundDNSPreflight,
  receivingDomain: string
): InboundDNSConflict {
  if (!preflight.checked) {
    return {
      severity: "unverified",
      message: `Could not verify existing DNS records for ${receivingDomain}. Confirm the domain has no MX record before continuing.`,
    };
  }

  if (preflight.existingMx.length > 0 && !preflight.alreadyPointsAtSes) {
    return {
      severity: "mx-conflict",
      message: `${receivingDomain} already routes mail to: ${preflight.existingMx.join(", ")}. Adding an SES MX record alongside it can divert or duplicate inbound mail.`,
    };
  }

  if (preflight.existingSpf.length > 0) {
    return {
      severity: "spf-conflict",
      message: `${receivingDomain} already has an SPF record: ${preflight.existingSpf.join(", ")}. Wraps will not add a second one — two v=spf1 records on one name is invalid (RFC 7208 §4.5) and fails SPF for all mail from this name. Add "include:amazonses.com" to the existing record yourself.`,
    };
  }

  return { severity: "ok", message: "" };
}

/**
 * Preflight the inbound MX/SPF write and, on a conflict, decide whether to
 * proceed. Shared by `inboundInit`, `inboundAdd` (and its reply-threading
 * write), and `replyInit` — one decision instead of three near-identical
 * copies.
 *
 * - `ok` / `spf-conflict` / `unverified`: never blocks. SPF safety is
 *   enforced by `createInboundDNSRecordsForProvider` itself (it never writes
 *   a second `v=spf1`); this only warns.
 * - `mx-conflict`: interactively, confirm before proceeding (default no) —
 *   post-309 the existing records are preserved on every provider, so the
 *   prompt says "alongside", never "replace". Non-interactively (`--yes` or
 *   `--json`), refuse by throwing — an automated caller must never be able
 *   to silently divert a customer's existing mail.
 *
 * Callers that treat the DNS write as best-effort (`replyInit`, which
 * already wraps it in a try/catch that degrades any failure to a warning)
 * get that degradation for free — the throw is just the one this function
 * raises for `inboundInit`/`inboundAdd` too. Keep that difference at the
 * call site; do not fork this function to soften it.
 */
export async function guardInboundDNSWrite(params: {
  credentials: DNSCredentials;
  receivingDomain: string;
  region: string;
  parentDomain: string;
  yes: boolean;
}): Promise<void> {
  const preflight = await checkInboundDNSPreflight(
    params.credentials,
    params.receivingDomain,
    params.region,
    params.parentDomain
  );
  const conflict = describeInboundDNSConflict(
    preflight,
    params.receivingDomain
  );

  if (conflict.severity === "ok") {
    return;
  }

  if (
    conflict.severity === "unverified" ||
    conflict.severity === "spf-conflict"
  ) {
    clack.log.warn(conflict.message);
    return;
  }

  // mx-conflict
  if (params.yes || isJsonMode()) {
    throw errors.inboundMxConflict(
      params.receivingDomain,
      params.parentDomain,
      preflight.existingMx
    );
  }

  clack.log.warn(conflict.message);
  const confirmed = await clack.confirm({
    message: `Continue adding the SES MX record to ${params.receivingDomain}?`,
    initialValue: false,
  });
  if (clack.isCancel(confirmed) || !confirmed) {
    clack.cancel("Operation cancelled.");
    process.exit(0);
  }
}
