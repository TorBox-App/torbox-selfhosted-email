/**
 * MX Check
 * Validates MX records for a domain
 */

import {
  resolveAaaaRecords,
  resolveARecords,
  resolveMxRecords,
  resolvePtrRecords,
} from "../dns/index.js";
import type { MxRecord, MxResult } from "../types.js";
import { isIpAddress, isLocalhost } from "../utils/domain.js";

/**
 * Check MX records for a domain
 */
export async function checkMx(domain: string): Promise<MxResult> {
  const result: MxResult = {
    exists: false,
    records: [],
    hasRedundancy: false,
    warnings: [],
  };

  try {
    const mxRecords = await resolveMxRecords(domain);

    if (mxRecords.length === 0) {
      result.warnings.push("No MX records found");
      return result;
    }

    result.exists = true;

    // Check each MX record
    for (const mx of mxRecords) {
      const mxResult = await checkMxRecord(mx);
      result.records.push(mxResult);
    }

    // Check for redundancy
    const uniquePriorities = new Set(mxRecords.map((r) => r.priority));
    result.hasRedundancy = mxRecords.length > 1 && uniquePriorities.size > 1;

    // Add warnings
    const unresolving = result.records.filter((r) => !r.resolves);
    if (unresolving.length > 0) {
      result.warnings.push(`${unresolving.length} MX record(s) do not resolve`);
    }

    const ipMx = result.records.filter((r) => r.isIpAddress);
    if (ipMx.length > 0) {
      result.warnings.push(
        "MX records should point to hostnames, not IP addresses"
      );
    }

    const localhostMx = result.records.filter((r) => r.isLocalhost);
    if (localhostMx.length > 0) {
      result.warnings.push("MX record points to localhost");
    }
  } catch (error: any) {
    result.warnings.push(`Error checking MX: ${error.message}`);
  }

  return result;
}

/**
 * Check a single MX record
 */
async function checkMxRecord(mx: {
  exchange: string;
  priority: number;
}): Promise<MxRecord> {
  const result: MxRecord = {
    priority: mx.priority,
    exchange: mx.exchange,
    resolves: false,
    ipv4Addresses: [],
    ipv6Addresses: [],
    isLocalhost: false,
    isIpAddress: isIpAddress(mx.exchange),
    reverseHostnames: [],
  };

  // If exchange is an IP (bad practice), handle it
  if (result.isIpAddress) {
    result.isLocalhost = isLocalhost(mx.exchange);
    result.resolves = true; // It "resolves" in a sense
    if (mx.exchange.includes(":")) {
      result.ipv6Addresses = [mx.exchange];
    } else {
      result.ipv4Addresses = [mx.exchange];
    }
    return result;
  }

  try {
    // Resolve A records
    const ipv4 = await resolveARecords(mx.exchange);
    result.ipv4Addresses = ipv4;

    // Resolve AAAA records
    const ipv6 = await resolveAaaaRecords(mx.exchange);
    result.ipv6Addresses = ipv6;

    result.resolves = ipv4.length > 0 || ipv6.length > 0;

    // Check for localhost
    for (const ip of [...ipv4, ...ipv6]) {
      if (isLocalhost(ip)) {
        result.isLocalhost = true;
        break;
      }
    }

    // Get PTR records for all IPs
    const allIps = [...ipv4, ...ipv6];
    for (const ip of allIps.slice(0, 3)) {
      // Limit to first 3 IPs
      try {
        const ptrs = await resolvePtrRecords(ip);
        result.reverseHostnames.push(...ptrs);
      } catch {
        // PTR lookup failed, that's ok
      }
    }
  } catch (_error: any) {
    // DNS resolution failed
  }

  return result;
}

/**
 * Format MX results for display
 */
export function formatMxResults(result: MxResult): string {
  if (!result.exists || result.records.length === 0) {
    return "No MX records found";
  }

  const validCount = result.records.filter((r) => r.resolves).length;
  const total = result.records.length;

  const lines: string[] = [
    `${total} record${total !== 1 ? "s" : ""}, ${validCount === total ? "all resolving" : `${validCount}/${total} resolving`}`,
  ];

  // List records (first few)
  const toShow = result.records.slice(0, 3);
  const summary = toShow.map((r) => `${r.exchange} (${r.priority})`).join(", ");

  if (result.records.length > 3) {
    lines.push(`${summary}, ...`);
  } else {
    lines.push(summary);
  }

  return lines.join("\n");
}
