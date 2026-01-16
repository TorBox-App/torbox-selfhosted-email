/**
 * DNS Provider utilities for CLI
 *
 * Supports:
 * - AWS Route53 (via existing route53.ts)
 * - Cloudflare
 * - Vercel
 */

// Providers
export { CloudflareDNSClient } from "./cloudflare.js";
// Types
export type {
  DNSConfig,
  DNSCreationResult,
  DNSProvider,
  DNSProviderClient,
  DNSRecord,
  EmailDNSRecordData,
} from "./types.js";
export { VercelDNSClient } from "./vercel.js";

// Route53 is exported from the parent utils directory
// import { createDNSRecords, findHostedZone } from "../route53.js";
