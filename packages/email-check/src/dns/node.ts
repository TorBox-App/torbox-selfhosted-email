/**
 * Node.js DNS Provider
 * Uses Node.js dns/promises for DNS resolution
 */

import { promises as dns, Resolver } from "node:dns";
import { DEFAULT_TIMEOUT } from "../constants.js";
import type { CaaRecord, DnsProvider } from "../types.js";

export type NodeDnsOptions = {
  timeout?: number;
  servers?: string[];
};

/**
 * Create a Node.js DNS provider
 */
export function createNodeDnsProvider(
  options: NodeDnsOptions = {}
): DnsProvider {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const resolver = new Resolver();

  // Set custom DNS servers if provided
  if (options.servers && options.servers.length > 0) {
    resolver.setServers(options.servers);
  }

  /**
   * Wrap a DNS query with timeout
   */
  async function withTimeout<T>(
    promise: Promise<T>,
    operation: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`DNS ${operation} timed out after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Resolve TXT records for a domain
   * Returns array of arrays (each TXT record can have multiple strings)
   */
  async function resolveTxt(domain: string): Promise<string[][]> {
    try {
      const records = await withTimeout(
        dns.resolveTxt(domain),
        `TXT lookup for ${domain}`
      );
      return records;
    } catch (error: any) {
      if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Resolve MX records for a domain
   */
  async function resolveMx(
    domain: string
  ): Promise<{ exchange: string; priority: number }[]> {
    try {
      const records = await withTimeout(
        dns.resolveMx(domain),
        `MX lookup for ${domain}`
      );
      return records.sort((a, b) => a.priority - b.priority);
    } catch (error: any) {
      if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Resolve A records (IPv4) for a domain
   */
  async function resolveA(domain: string): Promise<string[]> {
    try {
      const records = await withTimeout(
        dns.resolve4(domain),
        `A lookup for ${domain}`
      );
      return records;
    } catch (error: any) {
      if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Resolve AAAA records (IPv6) for a domain
   */
  async function resolveAaaa(domain: string): Promise<string[]> {
    try {
      const records = await withTimeout(
        dns.resolve6(domain),
        `AAAA lookup for ${domain}`
      );
      return records;
    } catch (error: any) {
      if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Resolve PTR records for an IP
   */
  async function resolvePtr(ip: string): Promise<string[]> {
    try {
      const records = await withTimeout(
        dns.reverse(ip),
        `PTR lookup for ${ip}`
      );
      return records;
    } catch (error: any) {
      if (
        error.code === "ENODATA" ||
        error.code === "ENOTFOUND" ||
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Resolve CAA records for a domain
   */
  async function resolveCaa(domain: string): Promise<CaaRecord[]> {
    try {
      const records = await withTimeout(
        dns.resolveCaa(domain),
        `CAA lookup for ${domain}`
      );
      // Node.js CaaRecord has issue/issuewild/iodef as separate properties
      return records.map((r) => {
        let tag: CaaRecord["tag"] = "issue";
        let value = "";

        if (r.issue !== undefined) {
          tag = "issue";
          value = r.issue;
        } else if (r.issuewild !== undefined) {
          tag = "issuewild";
          value = r.issuewild;
        } else if (r.iodef !== undefined) {
          tag = "iodef";
          value = r.iodef;
        }

        return {
          flags: r.critical,
          tag,
          value,
        };
      });
    } catch (error: any) {
      if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Resolve CNAME records for a domain
   */
  async function resolveCname(domain: string): Promise<string[]> {
    try {
      const records = await withTimeout(
        dns.resolveCname(domain),
        `CNAME lookup for ${domain}`
      );
      return records;
    } catch (error: any) {
      if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
        return [];
      }
      throw error;
    }
  }

  return {
    resolveTxt,
    resolveMx,
    resolveA,
    resolveAaaa,
    resolvePtr,
    resolveCaa,
    resolveCname,
  };
}

/**
 * Default Node.js DNS provider
 */
export const nodeDns = createNodeDnsProvider();
