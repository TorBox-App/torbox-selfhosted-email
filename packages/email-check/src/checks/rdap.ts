/**
 * RDAP Check
 * Fetches domain registration data via RDAP (Registration Data Access Protocol)
 */

import type { DomainAgeResult } from "../types.js";

// IANA RDAP bootstrap file
const RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";

// Cache for RDAP bootstrap data (TLD -> RDAP server URL)
let rdapBootstrapCache: Map<string, string> | null = null;
let bootstrapCacheTime = 0;
const BOOTSTRAP_CACHE_TTL = 3_600_000; // 1 hour

interface RdapBootstrap {
  services: [string[], string[]][];
  version: string;
}

interface RdapDomainResponse {
  objectClassName?: string;
  handle?: string;
  ldhName?: string;
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: { ldhName: string }[];
  secureDNS?: {
    delegationSigned?: boolean;
  };
}

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapEntity {
  objectClassName?: string;
  roles?: string[];
  vcardArray?: [string, ...any[]];
  publicIds?: { type: string; identifier: string }[];
}

/**
 * Check domain age via RDAP
 */
export async function checkDomainAge(
  domain: string,
  options: { quick?: boolean; timeout?: number } = {}
): Promise<DomainAgeResult> {
  const { quick = false, timeout = 10_000 } = options;

  const result: DomainAgeResult = {
    createdAt: null,
    expiresAt: null,
    updatedAt: null,
    ageInDays: null,
    daysUntilExpiry: null,
    registrar: null,
    registrantOrganization: null,
    registrantCountry: null,
    nameservers: [],
    dnssecEnabled: false,
    source: "unavailable",
    privacyEnabled: false,
    errors: [],
  };

  if (quick) {
    result.errors.push("Skipped in quick mode");
    return result;
  }

  try {
    // Get TLD from domain
    const tld = getTld(domain);
    if (!tld) {
      result.errors.push("Could not determine TLD");
      return result;
    }

    // Find RDAP server for this TLD
    const rdapServer = await findRdapServer(tld, timeout);
    if (!rdapServer) {
      result.errors.push(`No RDAP server found for .${tld}`);
      return result;
    }

    // Query RDAP for domain info
    const rdapData = await queryRdap(rdapServer, domain, timeout);
    if (!rdapData) {
      result.errors.push("RDAP query returned no data");
      return result;
    }

    // Parse RDAP response
    parseRdapResponse(rdapData, result);
    result.source = "rdap";
  } catch (error: any) {
    result.errors.push(error.message || "RDAP lookup failed");
  }

  return result;
}

/**
 * Get TLD from domain
 */
function getTld(domain: string): string | null {
  const parts = domain.toLowerCase().split(".");
  if (parts.length < 2) return null;

  // Handle common second-level TLDs
  const lastTwo = parts.slice(-2).join(".");
  const secondLevelTlds = [
    "co.uk",
    "org.uk",
    "me.uk",
    "ac.uk",
    "com.au",
    "net.au",
    "org.au",
    "co.nz",
    "org.nz",
    "co.jp",
    "or.jp",
    "com.br",
    "org.br",
  ];

  if (secondLevelTlds.includes(lastTwo) && parts.length > 2) {
    return lastTwo;
  }

  return parts[parts.length - 1] || null;
}

/**
 * Find RDAP server for a TLD using IANA bootstrap
 */
async function findRdapServer(
  tld: string,
  timeout: number
): Promise<string | null> {
  // Check cache
  const now = Date.now();
  if (rdapBootstrapCache && now - bootstrapCacheTime < BOOTSTRAP_CACHE_TTL) {
    return rdapBootstrapCache.get(tld.toLowerCase()) || null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(RDAP_BOOTSTRAP_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const bootstrap: RdapBootstrap = await response.json();

    // Build cache
    rdapBootstrapCache = new Map();
    bootstrapCacheTime = now;

    for (const [tlds, urls] of bootstrap.services) {
      const serverUrl = urls[0];
      if (serverUrl) {
        for (const t of tlds) {
          rdapBootstrapCache.set(t.toLowerCase(), serverUrl);
        }
      }
    }

    return rdapBootstrapCache.get(tld.toLowerCase()) || null;
  } catch {
    return null;
  }
}

/**
 * Query RDAP server for domain info
 */
async function queryRdap(
  serverUrl: string,
  domain: string,
  timeout: number
): Promise<RdapDomainResponse | null> {
  try {
    // Normalize server URL
    let url = serverUrl;
    if (!url.endsWith("/")) url += "/";
    url += `domain/${domain}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json, application/json" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Parse RDAP response into DomainAgeResult
 */
function parseRdapResponse(
  data: RdapDomainResponse,
  result: DomainAgeResult
): void {
  const now = new Date();

  // Parse events
  if (data.events) {
    for (const event of data.events) {
      const date = event.eventDate;
      switch (event.eventAction) {
        case "registration":
          result.createdAt = date;
          break;
        case "expiration":
          result.expiresAt = date;
          break;
        case "last changed":
        case "last update of RDAP database":
          if (!result.updatedAt) {
            result.updatedAt = date;
          }
          break;
      }
    }
  }

  // Calculate age and expiry
  if (result.createdAt) {
    const created = new Date(result.createdAt);
    result.ageInDays = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  if (result.expiresAt) {
    const expires = new Date(result.expiresAt);
    result.daysUntilExpiry = Math.floor(
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Parse nameservers
  if (data.nameservers) {
    result.nameservers = data.nameservers
      .map((ns) => ns.ldhName?.toLowerCase())
      .filter((ns): ns is string => !!ns);
  }

  // Check DNSSEC
  if (data.secureDNS?.delegationSigned) {
    result.dnssecEnabled = true;
  }

  // Parse entities for registrar and registrant info
  if (data.entities) {
    for (const entity of data.entities) {
      const roles = entity.roles || [];

      if (roles.includes("registrar")) {
        // Get registrar name from vCard
        const name = extractVcardName(entity.vcardArray);
        if (name) result.registrar = name;
      }

      if (roles.includes("registrant")) {
        // Check for privacy service
        const name = extractVcardName(entity.vcardArray);
        if (name) {
          result.registrantOrganization = name;
          // Common privacy service indicators
          const privacyIndicators = [
            "privacy",
            "proxy",
            "whoisguard",
            "domains by proxy",
            "contact privacy",
            "redacted",
            "withheld",
          ];
          const nameLower = name.toLowerCase();
          result.privacyEnabled = privacyIndicators.some((p) =>
            nameLower.includes(p)
          );
        }

        // Get country from vCard
        const country = extractVcardCountry(entity.vcardArray);
        if (country) result.registrantCountry = country;
      }
    }
  }
}

/**
 * Extract name from vCard array
 */
function extractVcardName(vcardArray?: [string, ...any[]]): string | null {
  if (!vcardArray || vcardArray[0] !== "vcard") return null;

  const properties = vcardArray[1];
  if (!Array.isArray(properties)) return null;

  for (const prop of properties) {
    if (!Array.isArray(prop)) continue;
    const [name, , , value] = prop;

    // Try fn (formatted name) first, then org
    if (name === "fn" && typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (name === "org" && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

/**
 * Extract country from vCard array
 */
function extractVcardCountry(vcardArray?: [string, ...any[]]): string | null {
  if (!vcardArray || vcardArray[0] !== "vcard") return null;

  const properties = vcardArray[1];
  if (!Array.isArray(properties)) return null;

  for (const prop of properties) {
    if (!Array.isArray(prop)) continue;
    const [name, , , value] = prop;

    if (name === "adr" && Array.isArray(value)) {
      // ADR format: [PO Box, Extended, Street, City, Region, Postal, Country]
      const country = value[6];
      if (typeof country === "string" && country.trim()) {
        return country.trim();
      }
    }
  }

  return null;
}

/**
 * Format domain age result for display
 */
export function formatDomainAgeResult(result: DomainAgeResult): string {
  if (result.source === "unavailable") {
    return result.errors[0] || "Domain age unavailable";
  }

  const parts: string[] = [];

  if (result.ageInDays !== null) {
    if (result.ageInDays < 30) {
      parts.push(`Registered ${result.ageInDays} days ago (NEW DOMAIN)`);
    } else if (result.ageInDays < 365) {
      const months = Math.floor(result.ageInDays / 30);
      parts.push(`Registered ${months} month${months !== 1 ? "s" : ""} ago`);
    } else {
      const years = Math.floor(result.ageInDays / 365);
      parts.push(`Registered ${years} year${years !== 1 ? "s" : ""} ago`);
    }
  }

  if (result.daysUntilExpiry !== null) {
    if (result.daysUntilExpiry < 0) {
      parts.push("EXPIRED");
    } else if (result.daysUntilExpiry < 30) {
      parts.push(`Expires in ${result.daysUntilExpiry} days`);
    } else if (result.daysUntilExpiry < 90) {
      parts.push(`Expires soon (${result.daysUntilExpiry} days)`);
    }
  }

  if (result.registrar) {
    parts.push(`Registrar: ${result.registrar}`);
  }

  return parts.join(" • ") || "Domain age available";
}
