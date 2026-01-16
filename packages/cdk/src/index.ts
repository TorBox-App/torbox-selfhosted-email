/**
 * @wraps.dev/cdk - AWS CDK construct for deploying Wraps email infrastructure
 *
 * Following SST's pattern of composition over presets:
 * - Minimal required config - just provide what you need
 * - Sensible defaults for everything else
 * - Direct resource access for customization
 * - Grant methods for easy IAM permissions
 *
 * @example
 * ```typescript
 * import { WrapsEmail } from "@wraps.dev/cdk";
 *
 * // Minimal - just Vercel OIDC for sending
 * const email = new WrapsEmail(this, "Email", {
 *   vercel: { teamSlug: "my-team", projectName: "my-app" },
 * });
 *
 * // With domain and event tracking
 * const email = new WrapsEmail(this, "Email", {
 *   vercel: { teamSlug: "my-team", projectName: "my-app" },
 *   domain: "example.com",
 *   events: {
 *     types: ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "OPEN", "CLICK"],
 *     storeHistory: true,
 *     retention: "6months",
 *   },
 * });
 *
 * // Grant send permissions
 * email.grantSend(myLambda);
 *
 * // Access underlying resources
 * email.resources.table?.tableArn;
 * email.resources.queue?.queueUrl;
 * ```
 *
 * @packageDocumentation
 */

// Utility functions
export { applyDefaults, retentionToDays } from "./defaults.js";
// Main construct
export { WrapsEmail } from "./email.js";
// Types
export type {
  ArchiveRetention,
  ArchivingConfig,
  EventsConfig,
  OIDCConfig,
  ResolvedConfig,
  ResolvedTrackingConfig,
  // Enum types
  SESEventType,
  SMTPConfig,
  SuppressionListConfig,
  SuppressionReason,
  TrackingConfig,
  // Sub-config types
  VercelOIDCConfig,
  WebhookConfig,
  // Props and config types
  WrapsEmailProps,
  // Resource types
  WrapsEmailResources,
} from "./types.js";
