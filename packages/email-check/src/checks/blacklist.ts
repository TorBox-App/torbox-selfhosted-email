/**
 * Blacklist Check
 * Checks domain and IPs against DNS-based blocklists
 */

import {
  BLACKLIST_BATCH_SIZE,
  DOMAIN_BLACKLISTS,
  IP_BLACKLISTS,
  QUICK_BLACKLISTS,
  SPAMHAUS_RETURN_CODES,
} from "../constants.js";
import { batchDnsQuery, resolveARecords } from "../dns/index.js";
import type {
  BlacklistConfig,
  BlacklistListing,
  BlacklistResult,
} from "../types.js";
import { isIpv4, reverseIp } from "../utils/domain.js";

/**
 * Return codes that indicate test/error responses, not actual listings
 * These should be ignored as they are not real blacklist entries
 */
const TEST_RETURN_CODES = new Set([
  "127.0.0.1", // Generic test response / query confirmation
  "127.0.1.255", // Spamhaus DBL test/error response
  "127.255.255.252", // DNS resolver test
  "127.255.255.254", // URIBL test response
  "127.255.255.255", // Reserved/test
]);

/**
 * Check if a return code is a test/error response
 */
function isTestResponse(returnCode: string): boolean {
  return TEST_RETURN_CODES.has(returnCode);
}

export interface BlacklistCheckOptions {
  /** Use quick mode (top 10 blacklists only) */
  quick?: boolean;
  /** Skip blacklist checks entirely */
  skip?: boolean;
  /** Domain to check */
  domain: string;
  /** IPs to check (from MX records) */
  ips?: string[];
}

/**
 * Check domain and IPs against blacklists
 */
export async function checkBlacklist(
  options: BlacklistCheckOptions
): Promise<BlacklistResult> {
  const { quick = false, skip = false, domain, ips = [] } = options;

  const result: BlacklistResult = {
    domainChecks: {
      checked: 0,
      listed: [],
      clean: [],
      errors: [],
      timeouts: [],
    },
    ipChecks: {
      checked: 0,
      listed: [],
      clean: [],
      errors: [],
      timeouts: [],
    },
    overallClean: true,
    quickMode: quick,
  };

  if (skip) {
    return result;
  }

  // Determine which blacklists to check
  const domainBlacklists = quick
    ? QUICK_BLACKLISTS.slice(0, 5)
    : DOMAIN_BLACKLISTS;
  const ipBlacklists = quick ? QUICK_BLACKLISTS : IP_BLACKLISTS;

  // Check domain blacklists
  await checkDomainBlacklists(domain, domainBlacklists, result);

  // Check IP blacklists
  if (ips.length > 0) {
    await checkIpBlacklists(ips, ipBlacklists, result);
  }

  // Determine if overall clean
  result.overallClean =
    result.domainChecks.listed.length === 0 &&
    result.ipChecks.listed.length === 0;

  return result;
}

/**
 * Check domain against domain blacklists
 */
async function checkDomainBlacklists(
  domain: string,
  blacklists: BlacklistConfig[],
  result: BlacklistResult
): Promise<void> {
  const checks = blacklists.map((bl) => ({
    blacklist: bl,
    query: `${domain}.${bl.zone}`,
  }));

  await batchDnsQuery(
    checks,
    async (check) => {
      result.domainChecks.checked++;
      try {
        const records = await resolveARecords(check.query);
        const firstRecord = records[0];
        // Filter out test responses
        if (records.length > 0 && firstRecord && !isTestResponse(firstRecord)) {
          const listing = createListing(
            check.blacklist,
            "domain",
            domain,
            firstRecord
          );
          result.domainChecks.listed.push(listing);
          result.overallClean = false;
        } else {
          result.domainChecks.clean.push(check.blacklist.name);
        }
      } catch (error: any) {
        if (error.message?.includes("timed out")) {
          result.domainChecks.timeouts.push(check.blacklist.name);
        } else if (error.code !== "ENOTFOUND" && error.code !== "ENODATA") {
          result.domainChecks.errors.push(
            `${check.blacklist.name}: ${error.message}`
          );
        } else {
          // ENOTFOUND/ENODATA means not listed
          result.domainChecks.clean.push(check.blacklist.name);
        }
      }
    },
    BLACKLIST_BATCH_SIZE
  );
}

/**
 * Check IPs against IP blacklists
 */
async function checkIpBlacklists(
  ips: string[],
  blacklists: BlacklistConfig[],
  result: BlacklistResult
): Promise<void> {
  // Filter to IPv4 only for now (IPv6 blacklist queries are more complex)
  const ipv4Ips = ips.filter(isIpv4);

  for (const ip of ipv4Ips) {
    const reversedIp = reverseIp(ip);
    const checks = blacklists.map((bl) => ({
      blacklist: bl,
      query: `${reversedIp}.${bl.zone}`,
      ip,
    }));

    await batchDnsQuery(
      checks,
      async (check) => {
        result.ipChecks.checked++;
        try {
          const records = await resolveARecords(check.query);
          const firstRecord = records[0];
          // Filter out test responses
          if (
            records.length > 0 &&
            firstRecord &&
            !isTestResponse(firstRecord)
          ) {
            const listing = createListing(
              check.blacklist,
              "ip",
              check.ip,
              firstRecord
            );
            result.ipChecks.listed.push(listing);
            result.overallClean = false;
          } else {
            result.ipChecks.clean.push(check.blacklist.name);
          }
        } catch (error: any) {
          if (error.message?.includes("timed out")) {
            result.ipChecks.timeouts.push(check.blacklist.name);
          } else if (error.code !== "ENOTFOUND" && error.code !== "ENODATA") {
            result.ipChecks.errors.push(
              `${check.blacklist.name}: ${error.message}`
            );
          } else {
            result.ipChecks.clean.push(check.blacklist.name);
          }
        }
      },
      BLACKLIST_BATCH_SIZE
    );
  }
}

/**
 * Create a blacklist listing
 */
function createListing(
  blacklist: BlacklistConfig,
  type: "domain" | "ip",
  target: string,
  returnCode: string
): BlacklistListing {
  return {
    blacklist: blacklist.name,
    zone: blacklist.zone,
    priority: blacklist.priority || "medium",
    type,
    target,
    returnCode,
    meaning: getMeaning(blacklist.zone, returnCode),
    delistUrl: getDelistUrl(blacklist.zone),
  };
}

/**
 * Get meaning of return code
 */
function getMeaning(zone: string, returnCode: string): string {
  if (zone.includes("spamhaus")) {
    return SPAMHAUS_RETURN_CODES[returnCode] || `Listed (${returnCode})`;
  }

  // Common return codes
  if (returnCode === "127.0.0.2") {
    return "Listed as spam source";
  }
  if (returnCode === "127.0.0.3") {
    return "Listed as spam source (elevated threat)";
  }

  return `Listed (${returnCode})`;
}

/**
 * Get delist URL for a blacklist
 */
function getDelistUrl(zone: string): string | null {
  const delistUrls: Record<string, string> = {
    "zen.spamhaus.org": "https://check.spamhaus.org/",
    "dbl.spamhaus.org": "https://check.spamhaus.org/",
    "sbl.spamhaus.org": "https://check.spamhaus.org/",
    "xbl.spamhaus.org": "https://check.spamhaus.org/",
    "pbl.spamhaus.org": "https://check.spamhaus.org/",
    "b.barracudacentral.org": "https://www.barracudacentral.org/lookups",
    "bl.spamcop.net": "https://www.spamcop.net/bl.shtml",
    "cbl.abuseat.org": "https://cbl.abuseat.org/lookup.cgi",
    "dnsbl.sorbs.net": "http://www.sorbs.net/lookup.shtml",
  };

  return delistUrls[zone] || null;
}

/**
 * Format blacklist results for display
 */
export function formatBlacklistResults(result: BlacklistResult): string {
  const domainListed = result.domainChecks.listed.length;
  const ipListed = result.ipChecks.listed.length;
  const totalListed = domainListed + ipListed;

  const domainChecked = result.domainChecks.checked;
  const ipChecked = result.ipChecks.checked;

  if (totalListed === 0) {
    const mode = result.quickMode ? "(quick mode)" : "";
    return `Clean on all ${domainChecked + ipChecked} lists ${mode}`.trim();
  }

  const lines: string[] = [
    `Listed on ${totalListed} blacklist${totalListed !== 1 ? "s" : ""}`,
  ];

  // Show domain listings
  for (const listing of result.domainChecks.listed) {
    lines.push(`• ${listing.blacklist}: ${listing.meaning}`);
    if (listing.delistUrl) {
      lines.push(`  Delist: ${listing.delistUrl}`);
    }
  }

  // Show IP listings
  for (const listing of result.ipChecks.listed) {
    lines.push(
      `• ${listing.blacklist} (${listing.target}): ${listing.meaning}`
    );
    if (listing.delistUrl) {
      lines.push(`  Delist: ${listing.delistUrl}`);
    }
  }

  return lines.join("\n");
}
