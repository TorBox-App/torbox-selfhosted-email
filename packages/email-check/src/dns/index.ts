/**
 * DNS Abstraction Layer
 * Provides a unified interface for DNS operations
 */

export type { NodeDnsOptions } from "./node.js";
export { createNodeDnsProvider, nodeDns } from "./node.js";

import type { DnsProvider } from "../types.js";
import { nodeDns } from "./node.js";

// Global DNS provider - defaults to Node.js
let currentProvider: DnsProvider = nodeDns;

/**
 * Set the global DNS provider
 */
export function setDnsProvider(provider: DnsProvider): void {
  currentProvider = provider;
}

/**
 * Get the current DNS provider
 */
export function getDnsProvider(): DnsProvider {
  return currentProvider;
}

/**
 * Resolve TXT records, concatenating multi-string records
 */
export async function resolveTxtRecords(domain: string): Promise<string[]> {
  const records = await currentProvider.resolveTxt(domain);
  // Concatenate multi-string TXT records (RFC 7208 split records)
  return records.map((parts) => parts.join(""));
}

/**
 * Resolve MX records sorted by priority
 */
export async function resolveMxRecords(
  domain: string
): Promise<{ exchange: string; priority: number }[]> {
  return currentProvider.resolveMx(domain);
}

/**
 * Resolve A records
 */
export async function resolveARecords(domain: string): Promise<string[]> {
  return currentProvider.resolveA(domain);
}

/**
 * Resolve AAAA records
 */
export async function resolveAaaaRecords(domain: string): Promise<string[]> {
  return currentProvider.resolveAaaa(domain);
}

/**
 * Resolve PTR records for an IP
 */
export async function resolvePtrRecords(ip: string): Promise<string[]> {
  return currentProvider.resolvePtr(ip);
}

/**
 * Resolve CAA records
 */
export async function resolveCaaRecords(domain: string) {
  return currentProvider.resolveCaa(domain);
}

/**
 * Resolve CNAME records
 */
export async function resolveCnameRecords(domain: string): Promise<string[]> {
  return currentProvider.resolveCname(domain);
}

/**
 * Find SPF record from TXT records
 */
export async function findSpfRecord(domain: string): Promise<string[]> {
  const txtRecords = await resolveTxtRecords(domain);
  return txtRecords.filter((r) => r.startsWith("v=spf1 ") || r === "v=spf1");
}

/**
 * Find DKIM record for a selector
 */
export async function findDkimRecord(
  domain: string,
  selector: string
): Promise<string | null> {
  const dkimDomain = `${selector}._domainkey.${domain}`;
  const txtRecords = await resolveTxtRecords(dkimDomain);
  const dkimRecord = txtRecords.find(
    (r) => r.startsWith("v=DKIM1") || r.includes("p=")
  );
  return dkimRecord || null;
}

/**
 * Find DMARC record
 */
export async function findDmarcRecord(domain: string): Promise<string | null> {
  const dmarcDomain = `_dmarc.${domain}`;
  const txtRecords = await resolveTxtRecords(dmarcDomain);
  const dmarcRecord = txtRecords.find((r) => r.startsWith("v=DMARC1"));
  return dmarcRecord || null;
}

/**
 * Batch DNS queries with concurrency control
 */
export async function batchDnsQuery<T, R>(
  items: T[],
  queryFn: (item: T) => Promise<R>,
  concurrency = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(queryFn));
    results.push(...batchResults);
  }

  return results;
}
