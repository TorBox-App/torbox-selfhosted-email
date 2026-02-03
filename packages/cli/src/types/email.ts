/**
 * Email-specific types for Wraps
 */

import type { ArchiveRetention, FeatureCost, Provider } from "./shared.js";

/**
 * AWS regions that support SES email receiving (Receipt Rules)
 */
export const SES_RECEIVING_REGIONS = [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
] as const;

export type SESReceivingRegion = (typeof SES_RECEIVING_REGIONS)[number];

/**
 * SES event types that can be tracked
 */
export type SESEventType =
  | "SEND"
  | "DELIVERY"
  | "OPEN"
  | "CLICK"
  | "BOUNCE"
  | "COMPLAINT"
  | "REJECT"
  | "RENDERING_FAILURE"
  | "DELIVERY_DELAY"
  | "SUBSCRIPTION";

/**
 * Suppression list reasons
 */
export type SuppressionReason = "BOUNCE" | "COMPLAINT";

/**
 * Feature-based email configuration
 */
export type WrapsEmailConfig = {
  // Domain configuration
  domain?: string;
  mailFromDomain?: string;
  mailFromSubdomain?: string; // Subdomain for MAIL FROM (e.g., "mail" -> mail.domain.com)

  // Tracking configuration
  tracking?: {
    enabled: boolean;
    opens?: boolean;
    clicks?: boolean;
    customRedirectDomain?: string;
    httpsEnabled?: boolean; // Enable HTTPS with CloudFront + ACM
    wafEnabled?: boolean; // Enable WAF with rate limiting for HTTPS tracking CDN
  };

  // Security
  tlsRequired?: boolean;

  // Reputation and deliverability
  reputationMetrics?: boolean;
  suppressionList?: {
    enabled: boolean;
    reasons: SuppressionReason[];
  };

  // Event tracking and storage
  eventTracking?: {
    enabled: boolean;
    eventBridge?: boolean;
    events?: SESEventType[];
    dynamoDBHistory?: boolean;
    archiveRetention?: ArchiveRetention;
  };

  // Email archiving (full email content storage)
  emailArchiving?: {
    enabled: boolean;
    retention: ArchiveRetention;
  };

  // SMTP credentials for legacy systems (PHP, WordPress, etc.)
  smtpCredentials?: {
    enabled: boolean;
    createdAt?: string; // Track when credentials were created
  };

  // Alerting configuration
  alerts?: AlertConfig;

  // Inbound email receiving
  inbound?: {
    enabled: boolean;
    subdomain: string; // e.g., "inbound" → inbound.domain.com
    receivingDomain?: string; // computed: subdomain.domain
    bucketName?: string; // wraps-inbound-{accountId}-{region}
    retention?: ArchiveRetention;
    webhookUrl?: string; // user's webhook endpoint for email.received
    webhookSecret?: string; // generated API key for webhook auth
  };

  // Advanced options
  ipPool?: string;
  dedicatedIp?: boolean;
  sendingEnabled?: boolean;
};

/**
 * Configuration preset types for email
 */
export type EmailConfigPreset =
  | "starter"
  | "production"
  | "enterprise"
  | "custom";

/**
 * Feature cost breakdown for email
 */
export type EmailFeatureCostBreakdown = {
  tracking?: FeatureCost;
  reputationMetrics?: FeatureCost;
  eventTracking?: FeatureCost;
  dynamoDBHistory?: FeatureCost;
  emailArchiving?: FeatureCost;
  dedicatedIp?: FeatureCost;
  waf?: FeatureCost;
  smtpCredentials?: FeatureCost;
  alerts?: FeatureCost;
  total: FeatureCost;
};

/**
 * Email stack configuration (used by Pulumi)
 */
export type EmailStackConfig = {
  provider: Provider;
  region: string;
  vercel?: {
    teamSlug: string;
    projectName: string;
  };
  emailConfig: WrapsEmailConfig;
  // Webhook configuration for Wraps platform integration
  webhook?: {
    awsAccountNumber: string; // The user's 12-digit AWS account ID
    webhookSecret: string; // API key for webhook authentication
    webhookUrl?: string; // Override webhook URL (defaults to api.wraps.dev)
  };
};

/**
 * Email stack outputs from Pulumi
 */
export type EmailStackOutputs = {
  roleArn: string;
  configSetName?: string;
  tableName?: string;
  region: string;
  lambdaFunctions?: string[];
  domain?: string;
  dkimTokens?: string[];
  dnsAutoCreated?: boolean;
  eventBusName?: string;
  queueUrl?: string;
  dlqUrl?: string;
  customTrackingDomain?: string;
  httpsTrackingEnabled?: boolean;
  cloudFrontDomain?: string;
  acmCertificateValidationRecords?: Array<{
    name: string;
    type: string;
    value: string;
  }>;
  mailFromDomain?: string;
  archiveArn?: string;
  archivingEnabled?: boolean;
  archiveRetention?: ArchiveRetention;
  // SMTP credentials (shown once, not stored)
  smtpUserArn?: string;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpEndpoint?: string;
  // Alerting outputs
  alertsEnabled?: boolean;
  alertTopicArn?: string;
  // Inbound email outputs
  inboundBucketName?: string;
  inboundBucketArn?: string;
  inboundLambdaArn?: string;
  inboundReceivingDomain?: string;
};

/**
 * Command options for email init
 */
export type EmailInitOptions = {
  provider?: Provider;
  region?: string;
  domain?: string;
  preset?: EmailConfigPreset;
  yes?: boolean;
  preview?: boolean;
};

/**
 * Alert severity levels
 */
export type AlertSeverity = "warning" | "critical";

/**
 * Alert threshold configuration
 * All rates are expressed as decimals (e.g., 0.02 = 2%)
 */
export type AlertThresholds = {
  /** Bounce rate warning threshold (default: 0.02 = 2%) */
  bounceRateWarning?: number;
  /** Bounce rate critical threshold (default: 0.04 = 4%) */
  bounceRateCritical?: number;
  /** Complaint rate warning threshold (default: 0.0005 = 0.05%) */
  complaintRateWarning?: number;
  /** Complaint rate critical threshold (default: 0.0008 = 0.08%) */
  complaintRateCritical?: number;
  /** DLQ message count to trigger alarm (default: 1) */
  dlqMessageThreshold?: number;
};

/**
 * Default alert thresholds - designed to warn BEFORE AWS/Gmail take action
 *
 * AWS thresholds: Bounce 5% warning, 10% suspend | Complaint 0.1% warning, 0.5% suspend
 * Gmail: Blocks at 0.3% complaint rate
 *
 * Our thresholds give you time to fix issues before hitting these limits.
 */
export const DEFAULT_ALERT_THRESHOLDS: Required<AlertThresholds> = {
  bounceRateWarning: 0.02, // 2% - gives time before AWS 5% warning
  bounceRateCritical: 0.04, // 4% - urgent, approaching AWS warning
  complaintRateWarning: 0.0005, // 0.05% - half of AWS warning threshold
  complaintRateCritical: 0.0008, // 0.08% - urgent, approaching AWS 0.1% warning
  dlqMessageThreshold: 1, // Any failed message processing
};

/**
 * Alerting configuration
 */
export type AlertConfig = {
  /** Enable alerting (default: true for production/enterprise presets) */
  enabled: boolean;
  /** Email address for alert notifications */
  notificationEmail?: string;
  /** Webhook URL for alert notifications (Slack, Discord, PagerDuty, etc.) */
  webhookUrl?: string;
  /** Custom thresholds (uses sensible defaults if not specified) */
  thresholds?: AlertThresholds;
  /** Alert on DLQ messages (event processing failures) */
  dlqAlerts?: boolean;
};

/**
 * Available features for Wraps email infrastructure
 */
export type WrapsEmailFeature =
  | "configSet"
  | "bounceHandling"
  | "complaintHandling"
  | "emailHistory"
  | "eventProcessor"
  | "dashboardAccess";

/**
 * Email feature metadata
 */
export type WrapsEmailFeatureMetadata = {
  id: WrapsEmailFeature;
  name: string;
  description: string;
  requires?: WrapsEmailFeature[];
  resources: string[];
};

/**
 * Command options for email connect
 */
export type EmailConnectOptions = {
  provider?: Provider;
  region?: string;
  yes?: boolean;
  preview?: boolean;
};

/**
 * Command options for email verify
 */
export type EmailVerifyOptions = {
  domain: string;
};

/**
 * Command options for email upgrade
 */
export type EmailUpgradeOptions = {
  region?: string;
  yes?: boolean;
  preview?: boolean;
};

/**
 * Command options for email update
 */
/**
 * Command options for email config
 */
export type EmailConfigOptions = {
  region?: string;
  yes?: boolean;
  preview?: boolean;
};

/** @deprecated Use EmailConfigOptions instead */
export type EmailUpdateOptions = EmailConfigOptions;

/**
 * Command options for email restore
 */
export type EmailRestoreOptions = {
  region?: string;
  force?: boolean; // Destructive operation - restores previous configuration
  preview?: boolean;
};

/**
 * Command options for email inbound init
 */
export type EmailInboundInitOptions = {
  region?: string;
  subdomain?: string;
  webhookUrl?: string;
  yes?: boolean;
  preview?: boolean;
};

/**
 * Command options for email inbound destroy
 */
export type EmailInboundDestroyOptions = {
  region?: string;
  force?: boolean;
};

/**
 * Command options for email inbound status
 */
export type EmailInboundStatusOptions = {
  region?: string;
};

/**
 * Command options for email inbound verify
 */
export type EmailInboundVerifyOptions = {
  region?: string;
};

/**
 * Command options for email inbound test
 */
export type EmailInboundTestOptions = {
  region?: string;
};
