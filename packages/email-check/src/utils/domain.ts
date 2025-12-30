/**
 * Domain Utilities
 * Domain parsing, IDN (punycode), and validation
 */

import { URL } from "node:url";

/**
 * Convert an internationalized domain name to ASCII (punycode)
 */
export function toAsciiDomain(domain: string): string {
  try {
    // Use URL to handle IDN conversion
    const url = new URL(`http://${domain.toLowerCase()}`);
    return url.hostname;
  } catch {
    return domain.toLowerCase();
  }
}

/**
 * Convert a punycode domain back to Unicode
 * Note: This is a simplified implementation - punycode domains may not fully decode
 */
export function toUnicodeDomain(domain: string): string {
  // If it doesn't contain xn--, it's not punycode
  if (!domain.includes("xn--")) {
    return domain;
  }
  // For now, return as-is since we're mainly concerned with the ASCII form
  return domain;
}

/**
 * Validate domain format
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;

  // Convert to ASCII for validation
  const asciiDomain = toAsciiDomain(domain);

  // Check each label
  const labels = asciiDomain.split(".");
  if (labels.length < 2) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label)) return false;
  }

  return true;
}

/**
 * Extract the organizational domain (eTLD+1)
 * This is a simplified version - a full implementation would use the Public Suffix List
 */
export function getOrganizationalDomain(domain: string): string {
  const parts = domain.toLowerCase().split(".");

  // Simple heuristic: common multi-part TLDs
  const multiPartTlds = [
    "co.uk",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "co.nz",
    "org.nz",
    "ac.nz",
    "co.jp",
    "or.jp",
    "ne.jp",
    "com.au",
    "net.au",
    "org.au",
    "edu.au",
    "com.br",
    "org.br",
    "net.br",
    "co.in",
    "org.in",
    "net.in",
  ];

  // Check if ends with a multi-part TLD
  for (const tld of multiPartTlds) {
    const tldParts = tld.split(".");
    if (parts.length >= tldParts.length + 1) {
      const suffix = parts.slice(-tldParts.length).join(".");
      if (suffix === tld) {
        return parts.slice(-tldParts.length - 1).join(".");
      }
    }
  }

  // Default: last two parts
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }

  return domain;
}

/**
 * Check if two domains are aligned (for DMARC)
 */
export function areDomainsAligned(
  domain1: string,
  domain2: string,
  mode: "strict" | "relaxed"
): boolean {
  const d1 = domain1.toLowerCase();
  const d2 = domain2.toLowerCase();

  if (mode === "strict") {
    return d1 === d2;
  }

  // Relaxed: organizational domains must match
  const org1 = getOrganizationalDomain(d1);
  const org2 = getOrganizationalDomain(d2);
  return org1 === org2;
}

/**
 * Extract domain from email address
 */
export function extractDomainFromEmail(email: string): string | null {
  const match = email.match(/@([^@\s>]+)$/);
  const domain = match?.[1];
  return domain ? domain.toLowerCase() : null;
}

/**
 * Check if string looks like an IP address
 */
export function isIpAddress(str: string): boolean {
  return isIpv4(str) || isIpv6(str);
}

/**
 * Check if string is IPv4
 */
export function isIpv4(str: string): boolean {
  const parts = str.split(".");
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    const num = Number.parseInt(part, 10);
    return !Number.isNaN(num) && num >= 0 && num <= 255 && part === String(num);
  });
}

/**
 * Check if string is IPv6
 */
export function isIpv6(str: string): boolean {
  // Basic IPv6 validation
  const ipv6Pattern =
    /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(?:ffff(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9]))$/;
  return ipv6Pattern.test(str);
}

/**
 * Reverse an IPv4 address for DNSBL lookup
 */
export function reverseIp(ip: string): string {
  if (isIpv4(ip)) {
    return ip.split(".").reverse().join(".");
  }

  // For IPv6, expand and reverse nibbles
  // This is a simplified version
  throw new Error("IPv6 reverse not yet implemented");
}

/**
 * Check if IP is localhost
 */
export function isLocalhost(ip: string): boolean {
  if (isIpv4(ip)) {
    return ip === "127.0.0.1" || ip.startsWith("127.");
  }
  return ip === "::1" || ip === "0:0:0:0:0:0:0:1";
}

/**
 * Check if PTR hostname looks generic (IP-based)
 */
export function looksGenericHostname(hostname: string, ip: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  // Check if hostname contains IP octets in various formats
  const ipParts = ip.split(".");
  if (ipParts.length === 4) {
    // Check for patterns like: 192-168-1-1.isp.com, ip-192-168-1-1.host.com
    const ipPattern = ipParts.join("[-.]");
    if (new RegExp(ipPattern).test(normalizedHostname)) {
      return true;
    }

    // Check for reversed IP patterns
    const reversedPattern = [...ipParts].reverse().join("[-.]");
    if (new RegExp(reversedPattern).test(normalizedHostname)) {
      return true;
    }
  }

  // Common generic patterns
  const genericPatterns = [
    /\b(dynamic|dhcp|dsl|cable|dial|ppp)\b/i,
    /\bhost\d+\b/i,
    /\bnode\d+\b/i,
    /\bip-\d+/i,
    /\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}/,
  ];

  return genericPatterns.some((pattern) => pattern.test(normalizedHostname));
}
