/**
 * Central type exports for Wraps CLI
 * This file maintains backwards compatibility while supporting multi-service architecture
 */

// Re-export CDN types
export type {
  CdnConfigPreset,
  CdnDestroyOptions,
  CdnFeatureCostBreakdown,
  CdnInitOptions,
  CdnRetention,
  CdnStackConfig,
  CdnStackOutputs,
  CdnStatusOptions,
  CdnUpgradeOptions,
  CdnVerifyOptions,
  CloudFrontPriceClass,
  GeoRestriction,
  WrapsCdnConfig,
  WrapsCdnFeature,
  WrapsCdnFeatureMetadata,
} from "./cdn.js";
// Re-export email types
export type {
  AdditionalDomain,
  AlertConfig,
  AlertSeverity,
  AlertThresholds,
  DomainPurpose,
  EmailConfigOptions,
  EmailConfigPreset,
  EmailConnectOptions,
  EmailDomainsConfigOptions,
  EmailFeatureCostBreakdown,
  EmailInboundAddOptions,
  EmailInboundDestroyOptions,
  EmailInboundInitOptions,
  EmailInboundRemoveOptions,
  EmailInboundStatusOptions,
  EmailInboundTestOptions,
  EmailInboundVerifyOptions,
  EmailInitOptions,
  EmailReplyDecodeOptions,
  EmailReplyDestroyOptions,
  EmailReplyInitOptions,
  EmailReplyRotateOptions,
  EmailReplyStatusOptions,
  EmailRestoreOptions,
  EmailStackConfig,
  EmailStackOutputs,
  EmailTestOptions,
  EmailUpdateOptions,
  EmailUpgradeOptions,
  EmailVerifyOptions,
  InboundDomain,
  SESEventType,
  SESReceivingRegion,
  SuppressionReason,
  WrapsEmailConfig,
  WrapsEmailFeature,
  WrapsEmailFeatureMetadata,
} from "./email.js";
export { DEFAULT_ALERT_THRESHOLDS, SES_RECEIVING_REGIONS } from "./email.js";
// Re-export license types
export type { LicenseGenerateOptions } from "./license.js";
// Re-export selfhost types
export type {
  SelfhostConfig,
  SelfhostDeployOptions,
  SelfhostStackConfig,
  SelfhostStackOutputs,
  SelfhostStatusOptions,
  SelfhostUpgradeOptions,
} from "./selfhost.js";
// Re-export shared types
export type {
  ArchiveRetention,
  ConsoleOptions,
  DashboardOptions,
  DestroyOptions,
  FeatureCost,
  PlatformConnectOptions,
  Provider,
  ServiceType,
  StatusOptions,
  UpdateRoleOptions,
} from "./shared.js";
// Re-export SMS types
export type {
  PhoneNumberType,
  SMSConfigPreset,
  SMSConnectOptions,
  SMSDestroyOptions,
  SMSEventType,
  SMSFeatureCostBreakdown,
  SMSInitOptions,
  SMSStackConfig,
  SMSStackOutputs,
  SMSStatusOptions,
  SMSTestOptions,
  SMSUpdateOptions,
  SMSUpgradeOptions,
  SMSVerifyNumberOptions,
  SMSVerifyOptions,
  WrapsSMSConfig,
  WrapsSMSFeature,
  WrapsSMSFeatureMetadata,
} from "./sms.js";

// Backwards compatibility aliases (deprecated, use specific types instead)
// Import specific types for legacy aliases
import type {
  EmailConfigPreset,
  EmailConnectOptions,
  EmailFeatureCostBreakdown,
  EmailInitOptions,
  EmailStackOutputs,
  EmailUpdateOptions,
  EmailUpgradeOptions,
  EmailVerifyOptions,
  WrapsEmailFeature,
  WrapsEmailFeatureMetadata,
} from "./email.js";

/** @deprecated Use EmailConfigPreset instead */
export type ConfigPreset = EmailConfigPreset;

/** @deprecated Use EmailFeatureCostBreakdown instead */
export type FeatureCostBreakdown = EmailFeatureCostBreakdown;

/** @deprecated Use EmailStackOutputs instead */
export type StackOutputs = EmailStackOutputs;

/** @deprecated Use EmailInitOptions instead */
export type InitOptions = EmailInitOptions;

/** @deprecated Use WrapsEmailFeature instead */
export type WrapsFeature = WrapsEmailFeature;

/** @deprecated Use WrapsEmailFeatureMetadata instead */
export type WrapsFeatureMetadata = WrapsEmailFeatureMetadata;

/** @deprecated Use EmailConnectOptions instead */
export type ConnectOptions = EmailConnectOptions;

/** @deprecated Use EmailVerifyOptions instead */
export type VerifyOptions = EmailVerifyOptions;

/** @deprecated Use EmailUpgradeOptions instead */
export type UpgradeOptions = EmailUpgradeOptions;

/** @deprecated Use EmailUpdateOptions instead */
export type UpdateOptions = EmailUpdateOptions;
