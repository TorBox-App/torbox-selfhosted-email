/**
 * DNS Provider utilities for CLI
 *
 * Supports:
 * - AWS Route53 (via existing route53.ts)
 * - Cloudflare
 * - Vercel
 */

// Provider clients
export { CloudflareDNSClient } from "./cloudflare.js";
// Unified record creation
export {
  buildEmailDNSRecords,
  buildInboundDNSRecords,
  createDNSRecordsForProvider,
  createInboundDNSRecordsForProvider,
  DNS_RECORD_DESCRIPTIONS,
  type DNSRecordCategory,
  type DNSRecordInfo,
  formatDNSRecordsForDisplay,
  formatManualDNSInstructions,
  getDNSProviderDisplayName,
  getDNSProviderTokenUrl,
} from "./create-records.js";
// Credentials management
export {
  type CredentialValidationResult,
  type DNSCredentials,
  detectAvailableDNSProviders,
  findCloudflareZoneId,
  getDNSCredentials,
  getDNSProviderEnvVars,
  getDNSProviderOptionalEnvVars,
  hasCloudflareToken,
  hasVercelToken,
} from "./credentials.js";
// Outbound email DNS cleanup (delete-side of buildEmailDNSRecords)
export {
  deleteEmailDNSRecordsForProvider,
  type EmailDNSCleanupResult,
} from "./email-dns-cleanup.js";
// Inbound DNS cleanup (delete-side of buildInboundDNSRecords)
export {
  deleteInboundDNSRecordsForProvider,
  type InboundDNSCleanupResult,
} from "./inbound-dns-cleanup.js";
// Inbound DNS preflight
export {
  checkInboundDNSPreflight,
  describeInboundDNSConflict,
  guardInboundDNSWrite,
  type InboundDNSConflict,
  type InboundDNSPreflight,
} from "./inbound-preflight.js";
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
