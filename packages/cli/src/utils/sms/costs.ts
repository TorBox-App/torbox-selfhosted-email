import type {
  ArchiveRetention,
  FeatureCost,
  SMSFeatureCostBreakdown,
  WrapsSMSConfig,
} from "../../types/index.js";

/**
 * AWS SMS pricing constants (as of 2025)
 * All costs in USD (US region)
 * Source: aws.amazon.com/end-user-messaging/pricing
 */
const AWS_SMS_PRICING = {
  // Phone number rental
  SIMULATOR_MONTHLY: 1.0, // $1/month for simulator
  TOLL_FREE_MONTHLY: 2.0, // $2/month for toll-free
  TEN_DLC_MONTHLY: 2.0, // $2/month for 10DLC + campaign fees (~$10/campaign)
  SHORT_CODE_MONTHLY: 995.0, // $995/month for dedicated short code

  // Per-message costs (US outbound)
  TOLL_FREE_PER_SMS: 0.0075, // $0.0075 per outbound SMS (toll-free)
  TEN_DLC_PER_SMS: 0.0075, // $0.0075 per outbound SMS (10DLC)
  SHORT_CODE_PER_SMS: 0.0055, // $0.0055 per outbound SMS (short code)
  SIMULATOR_PER_SMS: 0.0, // Free (limited to 100/day)

  // Carrier fees (average, varies by carrier)
  CARRIER_FEE_AVERAGE: 0.003, // ~$0.003 per message

  // Infrastructure costs (same as email)
  DYNAMODB_WRITE_PER_MILLION: 1.25,
  DYNAMODB_READ_PER_MILLION: 0.25,
  DYNAMODB_STORAGE_PER_GB: 0.25,
  LAMBDA_REQUESTS_PER_MILLION: 0.2,
  LAMBDA_COMPUTE_PER_GB_SECOND: 0.000_016_666_7,
  SQS_REQUESTS_PER_MILLION: 0.5,
  EVENTBRIDGE_EVENTS_PER_MILLION: 1.0,
} as const;

/**
 * AWS Free tier limits
 */
const FREE_TIER = {
  LAMBDA_REQUESTS: 1_000_000,
  LAMBDA_COMPUTE_GB_SECONDS: 400_000,
  DYNAMODB_STORAGE_GB: 25,
  SQS_REQUESTS: 1_000_000,
} as const;

/**
 * Estimate storage size in GB based on retention period and message volume
 */
function estimateStorageSize(
  messagesPerMonth: number,
  retention: ArchiveRetention,
  numEventTypes = 4
): number {
  // Average SMS event record size: ~1 KB
  const avgRecordSizeKB = 1;

  const retentionMonths = {
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
  }[retention];

  const totalKB =
    messagesPerMonth * numEventTypes * (retentionMonths ?? 3) * avgRecordSizeKB;
  return totalKB / 1024 / 1024; // Convert to GB
}

/**
 * Calculate phone number cost
 */
function calculatePhoneNumberCost(
  config: WrapsSMSConfig
): FeatureCost | undefined {
  const phoneType = config.phoneNumberType;

  if (!phoneType) {
    return;
  }

  const costMap: Record<string, number> = {
    simulator: AWS_SMS_PRICING.SIMULATOR_MONTHLY,
    "toll-free": AWS_SMS_PRICING.TOLL_FREE_MONTHLY,
    "10dlc": AWS_SMS_PRICING.TEN_DLC_MONTHLY,
    "short-code": AWS_SMS_PRICING.SHORT_CODE_MONTHLY,
  };

  const descriptions: Record<string, string> = {
    simulator: "Simulator number (testing only, 100 msg/day limit)",
    "toll-free": "Toll-free number (3 MPS, requires registration)",
    "10dlc": "10DLC number (75 MPS, requires brand + campaign registration)",
    "short-code": "Dedicated short code (100+ MPS, separate application)",
  };

  return {
    monthly: costMap[phoneType] || 0,
    description: descriptions[phoneType] || "Phone number rental",
  };
}

/**
 * Calculate per-message costs
 */
function calculateMessageCost(
  config: WrapsSMSConfig,
  messagesPerMonth: number
): FeatureCost | undefined {
  const phoneType = config.phoneNumberType;

  if (!phoneType || phoneType === "simulator") {
    return {
      monthly: 0,
      perMessage: 0,
      description: "Message sending (simulator - free, limited)",
    };
  }

  const perMessageCost =
    phoneType === "short-code"
      ? AWS_SMS_PRICING.SHORT_CODE_PER_SMS
      : AWS_SMS_PRICING.TOLL_FREE_PER_SMS;

  const carrierFee = AWS_SMS_PRICING.CARRIER_FEE_AVERAGE;
  const totalPerMessage = perMessageCost + carrierFee;
  const monthlyCost = messagesPerMonth * totalPerMessage;

  return {
    monthly: monthlyCost,
    perMessage: totalPerMessage,
    description: `Message sending ($${perMessageCost.toFixed(4)}/msg + ~$${carrierFee.toFixed(3)} carrier fee)`,
  };
}

/**
 * Calculate event tracking infrastructure cost
 */
function calculateEventTrackingCost(
  config: WrapsSMSConfig,
  messagesPerMonth: number
): FeatureCost | undefined {
  if (!config.eventTracking?.enabled) {
    return;
  }

  let monthlyCost = 0;
  const components: string[] = [];

  const numEventTypes = config.eventTracking.events?.length || 4;
  const totalEvents = messagesPerMonth * numEventTypes;

  // EventBridge events
  if (config.eventTracking.eventBridge) {
    const eventCost =
      (totalEvents / 1_000_000) *
      AWS_SMS_PRICING.EVENTBRIDGE_EVENTS_PER_MILLION;
    monthlyCost += eventCost;
    components.push("EventBridge");
  }

  // SQS queue costs
  const sqsRequests = totalEvents * 3; // send + receive + delete
  const sqsCost =
    (Math.max(0, sqsRequests - FREE_TIER.SQS_REQUESTS) / 1_000_000) *
    AWS_SMS_PRICING.SQS_REQUESTS_PER_MILLION;
  monthlyCost += sqsCost;
  components.push("SQS");

  // Lambda processing costs
  const lambdaInvocations = totalEvents;
  const lambdaRequestCost =
    (Math.max(0, lambdaInvocations - FREE_TIER.LAMBDA_REQUESTS) / 1_000_000) *
    AWS_SMS_PRICING.LAMBDA_REQUESTS_PER_MILLION;

  const memoryGB = 0.5;
  const avgDurationSeconds = 0.1;
  const computeGBSeconds = lambdaInvocations * memoryGB * avgDurationSeconds;
  const lambdaComputeCost =
    Math.max(0, computeGBSeconds - FREE_TIER.LAMBDA_COMPUTE_GB_SECONDS) *
    AWS_SMS_PRICING.LAMBDA_COMPUTE_PER_GB_SECOND;

  monthlyCost += lambdaRequestCost + lambdaComputeCost;
  components.push("Lambda");

  return {
    monthly: monthlyCost,
    description: `Event processing (${numEventTypes} event types: ${components.join(" → ")})`,
  };
}

/**
 * Calculate DynamoDB history storage cost
 */
function calculateDynamoDBCost(
  config: WrapsSMSConfig,
  messagesPerMonth: number
): FeatureCost | undefined {
  if (!config.eventTracking?.dynamoDBHistory) {
    return;
  }

  const retention = config.eventTracking.archiveRetention || "90days";
  const numEventTypes = config.eventTracking.events?.length || 4;

  // Write costs
  const totalEvents = messagesPerMonth * numEventTypes;
  const writeCost =
    (totalEvents / 1_000_000) * AWS_SMS_PRICING.DYNAMODB_WRITE_PER_MILLION;

  // Storage costs
  const storageGB = estimateStorageSize(
    messagesPerMonth,
    retention,
    numEventTypes
  );
  const storageCost =
    Math.max(0, storageGB - FREE_TIER.DYNAMODB_STORAGE_GB) *
    AWS_SMS_PRICING.DYNAMODB_STORAGE_PER_GB;

  return {
    monthly: writeCost + storageCost,
    description: `Message history (${retention}, ~${storageGB.toFixed(3)} GB)`,
  };
}

/**
 * Calculate tracking cost
 */
function calculateTrackingCost(
  config: WrapsSMSConfig
): FeatureCost | undefined {
  if (!config.tracking?.enabled) {
    return;
  }

  // Basic delivery tracking is included in AWS SMS pricing
  return {
    monthly: 0,
    description: "Delivery tracking (included)",
  };
}

/**
 * Calculate total SMS infrastructure costs
 */
export function calculateSMSCosts(
  config: WrapsSMSConfig,
  messagesPerMonth = 1000
): SMSFeatureCostBreakdown {
  const phoneNumber = calculatePhoneNumberCost(config);
  const tracking = calculateTrackingCost(config);
  const eventTracking = calculateEventTrackingCost(config, messagesPerMonth);
  const dynamoDBHistory = calculateDynamoDBCost(config, messagesPerMonth);
  const messageCost = calculateMessageCost(config, messagesPerMonth);

  // Sum all costs
  const totalMonthlyCost =
    (phoneNumber?.monthly || 0) +
    (tracking?.monthly || 0) +
    (eventTracking?.monthly || 0) +
    (dynamoDBHistory?.monthly || 0) +
    (messageCost?.monthly || 0);

  return {
    phoneNumber,
    tracking,
    eventTracking,
    dynamoDBHistory,
    total: {
      monthly: totalMonthlyCost,
      perMessage: messageCost?.perMessage || 0,
      description: `Total estimated cost for ${messagesPerMonth.toLocaleString()} messages/month`,
    },
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return "Free";
  }
  if (cost < 0.01) {
    return "< $0.01";
  }
  return `~$${cost.toFixed(2)}/mo`;
}

/**
 * Get cost estimate summary for display
 */
export function getSMSCostSummary(
  config: WrapsSMSConfig,
  messagesPerMonth = 1000
): string {
  const costs = calculateSMSCosts(config, messagesPerMonth);
  const lines: string[] = [];

  lines.push(
    `Estimated cost for ${messagesPerMonth.toLocaleString()} messages/month: ${formatCost(costs.total.monthly)}`
  );

  if (costs.phoneNumber) {
    lines.push(
      `  - ${costs.phoneNumber.description}: $${costs.phoneNumber.monthly.toFixed(2)}/mo`
    );
  }

  if (costs.total.perMessage && costs.total.perMessage > 0) {
    lines.push(
      `  - Message costs: $${((costs.total.perMessage || 0) * 1000).toFixed(2)}/1k messages`
    );
  }

  if (costs.tracking) {
    lines.push(`  - ${costs.tracking.description}`);
  }

  if (costs.eventTracking) {
    lines.push(
      `  - ${costs.eventTracking.description}: $${costs.eventTracking.monthly.toFixed(2)}/mo`
    );
  }

  if (costs.dynamoDBHistory) {
    lines.push(
      `  - ${costs.dynamoDBHistory.description}: $${costs.dynamoDBHistory.monthly.toFixed(2)}/mo`
    );
  }

  return lines.join("\n");
}
