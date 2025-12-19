/**
 * SMS-specific types for Wraps
 */

import type { ArchiveRetention, FeatureCost, Provider } from "./shared.js";

/**
 * SMS event types that can be tracked
 */
export type SMSEventType =
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "QUEUED"
  | "CARRIER_UNREACHABLE"
  | "BLOCKED"
  | "INVALID"
  | "OPTED_OUT"
  | "TTL_EXPIRED";

/**
 * Phone number type for AWS End User Messaging
 * @see https://docs.aws.amazon.com/sms-voice/latest/userguide/phone-numbers.html
 */
export type PhoneNumberType =
  | "simulator" // Testing only, no real messages ($1/mo, 100 msg/day)
  | "toll-free" // Toll-free number ($2/mo, 3 MPS, requires registration)
  | "10dlc" // 10-digit long code ($2/mo + campaign fees, up to 75 MPS)
  | "short-code"; // Dedicated short code ($995+/mo, 100+ MPS, separate application)

/**
 * Feature-based SMS configuration
 */
export type WrapsSMSConfig = {
  // Origination identity
  phoneNumber?: string;
  phoneNumberType?: PhoneNumberType;
  senderId?: string; // Alphanumeric sender ID (supported in some countries)

  // Tracking configuration
  tracking?: {
    enabled: boolean;
    deliveryReports?: boolean;
    linkTracking?: boolean; // Track clicks on links in SMS
  };

  // Event tracking and storage
  eventTracking?: {
    enabled: boolean;
    eventBridge?: boolean;
    events?: SMSEventType[];
    dynamoDBHistory?: boolean;
    archiveRetention?: ArchiveRetention;
  };

  // Message archiving (full message content storage)
  messageArchiving?: {
    enabled: boolean;
    retention: ArchiveRetention;
  };

  // Advanced options
  dedicatedShortCode?: boolean;
  sendingEnabled?: boolean;
  optOutManagement?: boolean; // Automatic opt-out handling

  // Fraud protection
  protectConfiguration?: {
    enabled: boolean;
    allowedCountries?: string[]; // ISO country codes (e.g., ["US", "CA"])
    blockedCountries?: string[]; // ISO country codes to block
    aitFiltering?: boolean; // Enable AIT (Artificially Inflated Traffic) filtering
  };
};

/**
 * Configuration preset types for SMS
 */
export type SMSConfigPreset =
  | "starter"
  | "production"
  | "enterprise"
  | "custom";

/**
 * Feature cost breakdown for SMS
 */
export type SMSFeatureCostBreakdown = {
  phoneNumber?: FeatureCost;
  tracking?: FeatureCost;
  eventTracking?: FeatureCost;
  dynamoDBHistory?: FeatureCost;
  messageArchiving?: FeatureCost;
  dedicatedShortCode?: FeatureCost;
  total: FeatureCost;
};

/**
 * SMS stack configuration (used by Pulumi)
 */
export type SMSStackConfig = {
  provider: Provider;
  region: string;
  vercel?: {
    teamSlug: string;
    projectName: string;
  };
  smsConfig: WrapsSMSConfig;
};

/**
 * SMS stack outputs from Pulumi
 */
export type SMSStackOutputs = {
  roleArn: string;
  phoneNumber?: string;
  phoneNumberArn?: string;
  phoneNumberType?: PhoneNumberType;
  poolId?: string;
  configSetName?: string;
  tableName?: string;
  region: string;
  lambdaFunctions?: string[];
  snsTopicArn?: string;
  queueUrl?: string;
  dlqUrl?: string;
  optOutListArn?: string;
};

/**
 * Command options for SMS init
 */
export type SMSInitOptions = {
  provider?: Provider;
  region?: string;
  phoneNumber?: string;
  preset?: SMSConfigPreset;
  yes?: boolean;
};

/**
 * Available features for Wraps SMS infrastructure
 */
export type WrapsSMSFeature =
  | "configSet"
  | "deliveryReports"
  | "messageHistory"
  | "eventProcessor"
  | "optOutManagement"
  | "dashboardAccess";

/**
 * SMS feature metadata
 */
export type WrapsSMSFeatureMetadata = {
  id: WrapsSMSFeature;
  name: string;
  description: string;
  requires?: WrapsSMSFeature[];
  resources: string[];
};

/**
 * Command options for SMS connect
 */
export type SMSConnectOptions = {
  provider?: Provider;
  region?: string;
  yes?: boolean;
};

/**
 * Command options for SMS verify
 */
export type SMSVerifyOptions = {
  phoneNumber: string;
};

/**
 * Command options for SMS upgrade
 */
export type SMSUpgradeOptions = {
  region?: string;
  yes?: boolean;
};

/**
 * Command options for SMS update
 */
export type SMSUpdateOptions = {
  region?: string;
  yes?: boolean;
};

/**
 * Command options for SMS destroy
 */
export type SMSDestroyOptions = {
  force?: boolean;
  preview?: boolean;
};

/**
 * Command options for SMS test
 */
export type SMSTestOptions = {
  to?: string;
  message?: string;
};

/**
 * Command options for SMS status
 */
export type SMSStatusOptions = {
  account?: string;
};

/**
 * Command options for SMS verify-number
 */
export type SMSVerifyNumberOptions = {
  phoneNumber?: string;
  code?: string;
  list?: boolean;
  delete?: boolean;
  resend?: boolean;
};
