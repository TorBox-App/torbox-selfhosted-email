import type { SESEventType, SuppressionReason } from "./types.js";

/**
 * Default SES event types to track
 */
export const DEFAULT_EVENT_TYPES: SESEventType[] = [
  "SEND",
  "DELIVERY",
  "BOUNCE",
  "COMPLAINT",
  "OPEN",
  "CLICK",
];

/**
 * All available SES event types
 */
export const ALL_EVENT_TYPES: SESEventType[] = [
  "SEND",
  "DELIVERY",
  "OPEN",
  "CLICK",
  "BOUNCE",
  "COMPLAINT",
  "REJECT",
  "RENDERING_FAILURE",
  "DELIVERY_DELAY",
  "SUBSCRIPTION",
];

/**
 * Default suppression reasons
 */
export const DEFAULT_SUPPRESSION_REASONS: SuppressionReason[] = [
  "BOUNCE",
  "COMPLAINT",
];

/**
 * Default configuration set name
 */
export const DEFAULT_CONFIG_SET_NAME = "wraps-email-tracking";

/**
 * Default MAIL FROM subdomain
 */
export const DEFAULT_MAIL_FROM_SUBDOMAIN = "mail";

/**
 * Default retention period for email history
 */
export const DEFAULT_HISTORY_RETENTION = "90days";

/**
 * Vercel OIDC provider URL
 */
export const VERCEL_OIDC_URL = "https://oidc.vercel.com";

/**
 * Vercel OIDC thumbprint
 */
export const VERCEL_OIDC_THUMBPRINT =
  "a031c46782e6e6c662c2c87c76da9aa62ccabd8e";

/**
 * Resource naming prefix
 */
export const RESOURCE_PREFIX = "wraps-email";

/**
 * Tags applied to all resources
 */
export const DEFAULT_TAGS = {
  ManagedBy: "wraps",
} as const;

/**
 * Prefix for ExternalId values baked into customer IAM trust policies.
 * NEVER change this — existing customer roles depend on it for sts:AssumeRole.
 */
export const EXTERNAL_ID_PREFIX = "wraps_";
