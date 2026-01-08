import type {
  StorageFeatureCostBreakdown,
  WrapsStorageConfig,
} from "../../types/index.js";

/**
 * AWS S3 + CloudFront pricing (US regions)
 * https://aws.amazon.com/s3/pricing/
 * https://aws.amazon.com/cloudfront/pricing/
 * https://aws.amazon.com/waf/pricing/
 */
const PRICING = {
  // S3 Storage (per GB/month)
  s3Storage: 0.023, // First 50TB

  // S3 Requests (per 1,000 requests)
  s3PutRequests: 0.005,
  s3GetRequests: 0.0004,

  // CloudFront (per GB transferred)
  cloudFrontToInternet: 0.085, // First 10TB
  cloudFrontToOrigin: 0, // Free to S3

  // CloudFront Requests (per 10,000 requests)
  cloudFrontHttpsRequests: 0.01,

  // WAF pricing (for CDN protection)
  wafWebAclPerMonth: 5.0, // $5.00 per Web ACL per month
  wafRulePerMonth: 1.0, // $1.00 per rule per month
  wafRequestsPerMillion: 0.6, // $0.60 per million requests
};

/**
 * Calculate estimated monthly costs for storage configuration
 */
export function calculateCosts(
  config: WrapsStorageConfig,
  estimatedStorageGB = 10,
  estimatedBandwidthGB = 50,
  estimatedRequests = 100_000
): StorageFeatureCostBreakdown {
  // Storage cost
  const storageCost = estimatedStorageGB * PRICING.s3Storage;

  // Bandwidth cost (CloudFront to internet)
  const bandwidthCost = config.cdn.enabled
    ? estimatedBandwidthGB * PRICING.cloudFrontToInternet
    : 0;

  // Request costs
  const uploadRequests = Math.ceil(estimatedRequests * 0.1); // 10% uploads
  const downloadRequests = Math.ceil(estimatedRequests * 0.9); // 90% downloads

  const requestCost = config.cdn.enabled
    ? (uploadRequests / 1000) * PRICING.s3PutRequests +
      (downloadRequests / 10_000) * PRICING.cloudFrontHttpsRequests
    : (uploadRequests / 1000) * PRICING.s3PutRequests +
      (downloadRequests / 1000) * PRICING.s3GetRequests;

  // WAF costs (only if CDN and WAF are enabled)
  let wafCost = 0;
  if (config.cdn.enabled && config.cdn.wafEnabled) {
    // Base cost: 1 Web ACL + 1 rate limit rule = $6/month
    wafCost =
      PRICING.wafWebAclPerMonth +
      PRICING.wafRulePerMonth +
      (downloadRequests / 1_000_000) * PRICING.wafRequestsPerMillion;
  }

  const totalMonthly = storageCost + bandwidthCost + requestCost + wafCost;

  return {
    storage: {
      monthly: storageCost,
      description: `${estimatedStorageGB}GB storage at $${PRICING.s3Storage}/GB`,
    },
    bandwidth: {
      monthly: bandwidthCost,
      description: config.cdn.enabled
        ? `${estimatedBandwidthGB}GB CDN bandwidth at $${PRICING.cloudFrontToInternet}/GB`
        : "No CDN, direct S3 access",
    },
    requests: {
      monthly: requestCost,
      description: `~${estimatedRequests.toLocaleString()} requests/month`,
    },
    waf:
      config.cdn.enabled && config.cdn.wafEnabled
        ? {
            monthly: wafCost,
            description: "WAF rate limiting for CDN",
          }
        : undefined,
    total: {
      monthly: totalMonthly,
      description: "Estimated monthly AWS cost",
    },
  };
}

/**
 * Format cost for display
 */
export function formatCost(amount: number): string {
  if (amount < 1) {
    return `~$${amount.toFixed(2)}/mo`;
  }
  if (amount < 10) {
    return `~$${amount.toFixed(1)}/mo`;
  }
  return `~$${Math.round(amount)}/mo`;
}

/**
 * Get cost summary string for display
 */
export function getCostSummary(
  config: WrapsStorageConfig,
  estimatedStorageGB = 10,
  estimatedBandwidthGB = 50
): string {
  const costs = calculateCosts(
    config,
    estimatedStorageGB,
    estimatedBandwidthGB
  );

  const lines = [
    `Storage:   ${formatCost(costs.storage?.monthly || 0)} (${estimatedStorageGB}GB)`,
    `Bandwidth: ${formatCost(costs.bandwidth?.monthly || 0)} (${estimatedBandwidthGB}GB CDN)`,
    `Requests:  ${formatCost(costs.requests?.monthly || 0)}`,
  ];

  if (costs.waf) {
    lines.push(`WAF:       ${formatCost(costs.waf.monthly)} (rate limiting)`);
  }

  lines.push("───────────────────────");
  lines.push(`Total:     ${formatCost(costs.total.monthly)}`);

  return lines.join("\n");
}

/**
 * Compare costs between configurations
 */
export function compareCosts(
  current: StorageFeatureCostBreakdown,
  updated: StorageFeatureCostBreakdown
): {
  difference: number;
  percentChange: number;
  summary: string;
} {
  const difference = updated.total.monthly - current.total.monthly;
  const percentChange =
    current.total.monthly > 0
      ? (difference / current.total.monthly) * 100
      : 100;

  let summary: string;
  if (difference > 0) {
    summary = `+${formatCost(difference)} (${percentChange.toFixed(0)}% increase)`;
  } else if (difference < 0) {
    summary = `${formatCost(difference)} (${Math.abs(percentChange).toFixed(0)}% decrease)`;
  } else {
    summary = "No cost change";
  }

  return { difference, percentChange, summary };
}
