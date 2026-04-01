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
