/**
 * @wraps/core - Shared types, utilities, and Lambda code for Wraps IaC packages
 *
 * This package provides common functionality used by @wraps.dev/pulumi and @wraps.dev/cdk:
 * - Shared types (SESEventType, ArchiveRetention, config interfaces)
 * - Constants (default event types, resource naming)
 * - Utilities (SMTP password derivation, retention conversion)
 * - Lambda source code for event processing
 *
 * @packageDocumentation
 */

// Constants
export {
  ALL_EVENT_TYPES,
  DEFAULT_CONFIG_SET_NAME,
  DEFAULT_EVENT_TYPES,
  DEFAULT_HISTORY_RETENTION,
  DEFAULT_MAIL_FROM_SUBDOMAIN,
  DEFAULT_SUPPRESSION_REASONS,
  DEFAULT_TAGS,
  RESOURCE_PREFIX,
  VERCEL_OIDC_THUMBPRINT,
  VERCEL_OIDC_URL,
} from "./constants.js";
// Retention utilities
export {
  calculateTTL,
  retentionToAWSPeriod,
  retentionToDays,
} from "./retention.js";
// SMTP utilities
export {
  convertToSMTPPassword,
  getSMTPConnectionDetails,
  getSMTPEndpoint,
  type SMTPConnectionDetails,
} from "./smtp.js";
// Types
export type {
  ArchiveRetention,
  ArchivingConfig,
  EventsConfig,
  OIDCConfig,
  // Resolved config types
  ResolvedTrackingConfig,
  // Event types
  SESEventType,
  SMTPConfig,
  SuppressionListConfig,
  SuppressionReason,
  // Feature config types
  TrackingConfig,
  // OIDC config types
  VercelOIDCConfig,
  WebhookConfig,
} from "./types.js";

/**
 * Path to the pre-bundled email event processor Lambda code directory.
 * Use this when configuring Lambda functions in Pulumi or CDK.
 *
 * @example
 * ```typescript
 * import { LAMBDA_EVENT_PROCESSOR_PATH } from "@wraps/core";
 * import * as lambda from "aws-cdk-lib/aws-lambda";
 *
 * new lambda.Function(this, "Processor", {
 *   code: lambda.Code.fromAsset(LAMBDA_EVENT_PROCESSOR_PATH),
 *   // ...
 * });
 * ```
 */
export const LAMBDA_EVENT_PROCESSOR_PATH = new URL(
  "../lambda/event-processor",
  import.meta.url
).pathname;

/**
 * Path to the pre-bundled SMS event processor Lambda code directory.
 * Use this when configuring Lambda functions in Pulumi or CDK.
 *
 * @example
 * ```typescript
 * import { LAMBDA_SMS_EVENT_PROCESSOR_PATH } from "@wraps/core";
 * import * as lambda from "aws-cdk-lib/aws-lambda";
 *
 * new lambda.Function(this, "SMSProcessor", {
 *   code: lambda.Code.fromAsset(LAMBDA_SMS_EVENT_PROCESSOR_PATH),
 *   // ...
 * });
 * ```
 */
export const LAMBDA_SMS_EVENT_PROCESSOR_PATH = new URL(
  "../lambda/sms-event-processor",
  import.meta.url
).pathname;
