// AWS Integration utilities for Wraps dashboard
// Handles secure credential management via IAM role assumption

export {
  type AssumedRoleCredentials,
  type AssumeRoleParams,
  assumeRole,
} from "./assume-role";
export {
  getCloudWatchMetrics,
  getSESMetricsSummary,
  SES_METRICS,
} from "./cloudwatch";
export {
  clearCredentialCache,
  getOrAssumeRole,
  invalidateCredentials,
} from "./credential-cache";
export {
  getSMSCloudWatchMetrics,
  getSMSMetricsSummary,
  getSMSAccountAttributes,
  getSMSSpendLimits,
  getSMSPhoneNumbers,
  getSMSConfigurationSets,
  getSMSRegistrations,
  querySMSEvents,
  getRecentSMSActivity,
  SMS_METRICS,
  type SMSEvent,
} from "./sms-voice";
