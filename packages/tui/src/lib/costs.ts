import type {
  ArchiveRetention,
  FeatureCost,
  FeatureCostBreakdown,
  WrapsEmailConfig,
} from "../types";

const AWS_PRICING = {
  SES_PER_EMAIL: 0.0001,
  SES_ATTACHMENT_PER_GB: 0.12,
  DYNAMODB_WRITE_PER_MILLION: 1.25,
  DYNAMODB_READ_PER_MILLION: 0.25,
  DYNAMODB_STORAGE_PER_GB: 0.25,
  LAMBDA_REQUESTS_PER_MILLION: 0.2,
  LAMBDA_COMPUTE_PER_GB_SECOND: 0.000_016_666_7,
  SQS_REQUESTS_PER_MILLION: 0.5,
  EVENTBRIDGE_EVENTS_PER_MILLION: 1.0,
  DEDICATED_IP_PER_MONTH: 24.95,
  CLOUDWATCH_LOGS_PER_GB: 0.5,
  CLOUDWATCH_LOGS_STORAGE_PER_GB: 0.03,
  MAIL_MANAGER_INGESTION_PER_GB: 2.0,
  MAIL_MANAGER_STORAGE_PER_GB: 0.19,
  WAF_WEB_ACL_PER_MONTH: 5.0,
  WAF_RULE_PER_MONTH: 1.0,
  WAF_REQUESTS_PER_MILLION: 0.6,
} as const;

const FREE_TIER = {
  SES_EMAILS: 0,
  LAMBDA_REQUESTS: 1_000_000,
  LAMBDA_COMPUTE_GB_SECONDS: 400_000,
  DYNAMODB_WRITES: 0,
  DYNAMODB_READS: 0,
  DYNAMODB_STORAGE_GB: 25,
  SQS_REQUESTS: 1_000_000,
  CLOUDWATCH_LOGS_GB: 5,
} as const;

const RETENTION_MONTHS: Record<ArchiveRetention, number> = {
  "7days": 0.25,
  "30days": 1,
  "90days": 3,
  "3months": 3,
  "6months": 6,
  "9months": 9,
  "1year": 12,
  "18months": 18,
  "2years": 24,
  "30months": 30,
  "3years": 36,
  "4years": 48,
  "5years": 60,
  "6years": 72,
  "7years": 84,
  "8years": 96,
  "9years": 108,
  "10years": 120,
  indefinite: 120,
  permanent: 120,
};

function estimateStorageSize(
  emailsPerMonth: number,
  retention: ArchiveRetention,
  numEventTypes = 8
): number {
  const avgRecordSizeKB = 2;
  const retentionMonths = RETENTION_MONTHS[retention] ?? 12;
  const totalKB =
    emailsPerMonth * numEventTypes * retentionMonths * avgRecordSizeKB;
  return totalKB / 1024 / 1024;
}

function estimateArchiveStorageSize(
  emailsPerMonth: number,
  retention: ArchiveRetention
): number {
  const avgEmailSizeKB = 50;
  const retentionMonths = RETENTION_MONTHS[retention] ?? 12;
  const totalKB = emailsPerMonth * retentionMonths * avgEmailSizeKB;
  return totalKB / 1024 / 1024;
}

function calculateEventTrackingCost(
  config: WrapsEmailConfig,
  emailsPerMonth: number
): FeatureCost | undefined {
  if (!config.eventTracking?.enabled) {
    return;
  }

  let monthlyCost = 0;
  const components: string[] = [];

  const numEventTypes = config.eventTracking.events?.length || 8;
  const totalEvents = emailsPerMonth * numEventTypes;

  if (config.eventTracking.eventBridge) {
    monthlyCost +=
      (totalEvents / 1_000_000) * AWS_PRICING.EVENTBRIDGE_EVENTS_PER_MILLION;
    components.push("EventBridge");
  }

  const sqsRequests = totalEvents * 3;
  monthlyCost +=
    (Math.max(0, sqsRequests - FREE_TIER.SQS_REQUESTS) / 1_000_000) *
    AWS_PRICING.SQS_REQUESTS_PER_MILLION;
  components.push("SQS");

  const lambdaInvocations = totalEvents;
  const lambdaRequestCost =
    (Math.max(0, lambdaInvocations - FREE_TIER.LAMBDA_REQUESTS) / 1_000_000) *
    AWS_PRICING.LAMBDA_REQUESTS_PER_MILLION;

  const memoryGB = 0.5;
  const avgDurationSeconds = 0.1;
  const computeGBSeconds = lambdaInvocations * memoryGB * avgDurationSeconds;
  const lambdaComputeCost =
    Math.max(0, computeGBSeconds - FREE_TIER.LAMBDA_COMPUTE_GB_SECONDS) *
    AWS_PRICING.LAMBDA_COMPUTE_PER_GB_SECOND;

  monthlyCost += lambdaRequestCost + lambdaComputeCost;
  components.push("Lambda");

  return {
    monthly: monthlyCost,
    description: `Event processing (${numEventTypes} event types: ${components.join(" → ")})`,
  };
}

function calculateDynamoDBCost(
  config: WrapsEmailConfig,
  emailsPerMonth: number
): FeatureCost | undefined {
  if (!config.eventTracking?.dynamoDBHistory) {
    return;
  }

  const retention = config.eventTracking.archiveRetention || "90days";
  const numEventTypes = config.eventTracking.events?.length || 8;

  const totalEvents = emailsPerMonth * numEventTypes;
  const writeCost =
    (Math.max(0, totalEvents - FREE_TIER.DYNAMODB_WRITES) / 1_000_000) *
    AWS_PRICING.DYNAMODB_WRITE_PER_MILLION;

  const storageGB = estimateStorageSize(
    emailsPerMonth,
    retention,
    numEventTypes
  );
  const storageCost =
    Math.max(0, storageGB - FREE_TIER.DYNAMODB_STORAGE_GB) *
    AWS_PRICING.DYNAMODB_STORAGE_PER_GB;

  return {
    monthly: writeCost + storageCost,
    description: `Email history (${retention}, ~${storageGB.toFixed(2)} GB)`,
  };
}

function calculateTrackingCost(
  config: WrapsEmailConfig
): FeatureCost | undefined {
  if (!config.tracking?.enabled) {
    return;
  }
  return {
    monthly: 0,
    description: "Open/click tracking (no additional cost)",
  };
}

function calculateWafCost(
  config: WrapsEmailConfig,
  emailsPerMonth: number
): FeatureCost | undefined {
  if (!(config.tracking?.httpsEnabled && config.tracking?.wafEnabled)) {
    return;
  }

  const baseCost =
    AWS_PRICING.WAF_WEB_ACL_PER_MONTH + AWS_PRICING.WAF_RULE_PER_MONTH;
  const estimatedRequests = emailsPerMonth * 2;
  const requestCost =
    (estimatedRequests / 1_000_000) * AWS_PRICING.WAF_REQUESTS_PER_MILLION;

  return {
    monthly: baseCost + requestCost,
    description: "WAF rate limiting for HTTPS tracking CDN",
  };
}

function calculateReputationMetricsCost(
  config: WrapsEmailConfig
): FeatureCost | undefined {
  if (!config.reputationMetrics) {
    return;
  }
  return {
    monthly: 0,
    description: "Reputation metrics (no additional cost)",
  };
}

function calculateDedicatedIpCost(
  config: WrapsEmailConfig
): FeatureCost | undefined {
  if (!config.dedicatedIp) {
    return;
  }
  return {
    monthly: AWS_PRICING.DEDICATED_IP_PER_MONTH,
    description: "Dedicated IP address",
  };
}

function calculateEmailArchivingCost(
  config: WrapsEmailConfig,
  emailsPerMonth: number
): FeatureCost | undefined {
  if (!config.emailArchiving?.enabled) {
    return;
  }

  const retention = config.emailArchiving.retention;
  const storageGB = estimateArchiveStorageSize(emailsPerMonth, retention);

  const monthlyDataGB = (emailsPerMonth * 50) / 1024 / 1024;
  const ingestionCost =
    monthlyDataGB * AWS_PRICING.MAIL_MANAGER_INGESTION_PER_GB;
  const storageCost = storageGB * AWS_PRICING.MAIL_MANAGER_STORAGE_PER_GB;

  return {
    monthly: ingestionCost + storageCost,
    description: `Email archiving (${retention}, ~${storageGB.toFixed(2)} GB)`,
  };
}

function calculateSMTPCredentialsCost(
  config: WrapsEmailConfig
): FeatureCost | undefined {
  if (!config.smtpCredentials?.enabled) {
    return;
  }
  return {
    monthly: 0,
    description: "SMTP credentials (no additional cost)",
  };
}

function calculateAlertingCost(
  config: WrapsEmailConfig
): FeatureCost | undefined {
  if (!config.alerts?.enabled) {
    return;
  }

  const numAlarms = config.alerts.dlqAlerts !== false ? 5 : 4;
  const alarmCost = numAlarms * 0.1;

  return {
    monthly: alarmCost,
    description: `Reputation alerts (${numAlarms} CloudWatch alarms)`,
  };
}

export function calculateCosts(
  config: WrapsEmailConfig,
  emailsPerMonth = 10_000
): FeatureCostBreakdown {
  const tracking = calculateTrackingCost(config);
  const reputationMetrics = calculateReputationMetricsCost(config);
  const eventTracking = calculateEventTrackingCost(config, emailsPerMonth);
  const dynamoDBHistory = calculateDynamoDBCost(config, emailsPerMonth);
  const emailArchiving = calculateEmailArchivingCost(config, emailsPerMonth);
  const dedicatedIp = calculateDedicatedIpCost(config);
  const waf = calculateWafCost(config, emailsPerMonth);
  const smtpCredentials = calculateSMTPCredentialsCost(config);
  const alerts = calculateAlertingCost(config);

  const sesEmailCost =
    Math.max(0, emailsPerMonth - FREE_TIER.SES_EMAILS) *
    AWS_PRICING.SES_PER_EMAIL;

  const totalMonthlyCost =
    sesEmailCost +
    (tracking?.monthly || 0) +
    (reputationMetrics?.monthly || 0) +
    (eventTracking?.monthly || 0) +
    (dynamoDBHistory?.monthly || 0) +
    (emailArchiving?.monthly || 0) +
    (dedicatedIp?.monthly || 0) +
    (waf?.monthly || 0) +
    (smtpCredentials?.monthly || 0) +
    (alerts?.monthly || 0);

  return {
    tracking,
    reputationMetrics,
    eventTracking,
    dynamoDBHistory,
    emailArchiving,
    dedicatedIp,
    waf,
    smtpCredentials,
    alerts,
    total: {
      monthly: totalMonthlyCost,
      perEmail: AWS_PRICING.SES_PER_EMAIL,
      description: `Total estimated cost for ${emailsPerMonth.toLocaleString()} emails/month`,
    },
  };
}

export function formatCost(cost: number): string {
  if (cost === 0) {
    return "Free";
  }
  if (cost < 0.01) {
    return "< $0.01";
  }
  return `$${cost.toFixed(2)}`;
}
