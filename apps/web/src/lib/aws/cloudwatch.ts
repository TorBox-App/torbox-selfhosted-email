import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
  type MetricDataResult,
} from "@aws-sdk/client-cloudwatch";
import { db } from "@wraps/db";
import { getOrAssumeRole } from "./credential-cache";

type GetMetricsParams = {
  awsAccountId: string;
  metric: string;
  period: number;
  startTime: Date;
  endTime: Date;
  stat?: "Sum" | "Average" | "Maximum" | "Minimum" | "SampleCount";
};

/**
 * Fetches CloudWatch metrics for a customer's SES account.
 * Automatically handles credential retrieval and caching.
 *
 * @param params - Account ID, metric name, time range, and aggregation settings
 * @returns CloudWatch metric data results
 *
 * @example
 * ```ts
 * // Get email send count for last 24 hours
 * const metrics = await getCloudWatchMetrics({
 *   awsAccountId: 'aws-account-uuid',
 *   metric: 'Send',
 *   period: 3600, // 1 hour intervals
 *   startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
 *   endTime: new Date(),
 * });
 * ```
 */
export async function getCloudWatchMetrics(
  params: GetMetricsParams
): Promise<MetricDataResult[]> {
  const {
    awsAccountId,
    metric,
    period,
    startTime,
    endTime,
    stat = "Sum",
  } = params;

  // Get AWS account details from database
  const account = await db.query.awsAccount.findFirst({
    where: (a, { eq }) => eq(a.id, awsAccountId),
  });

  if (!account) {
    throw new Error("AWS account not found");
  }

  // Get temporary credentials for customer account
  const credentials = await getOrAssumeRole({
    roleArn: account.roleArn,
    externalId: account.externalId,
    region: account.region,
  });

  // Create CloudWatch client with temporary credentials
  const cloudwatch = new CloudWatchClient({
    region: account.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  // Define metric query
  const metricQuery: MetricDataQuery = {
    Id: "m1",
    MetricStat: {
      Metric: {
        Namespace: "AWS/SES",
        MetricName: metric,
      },
      Period: period,
      Stat: stat,
    },
  };

  // Fetch metrics
  const command = new GetMetricDataCommand({
    MetricDataQueries: [metricQuery],
    StartTime: startTime,
    EndTime: endTime,
  });

  try {
    const response = await cloudwatch.send(command);
    return response.MetricDataResults || [];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch CloudWatch metrics: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Common SES metrics available in CloudWatch
 */
export const SES_METRICS = {
  SEND: "Send",
  DELIVERY: "Delivery",
  BOUNCE: "Bounce",
  COMPLAINT: "Complaint",
  REJECT: "Reject",
  OPEN: "Open",
  CLICK: "Click",
  RENDERING_FAILURE: "RenderingFailure",
  REPUTATION_BOUNCE_RATE: "Reputation.BounceRate",
  REPUTATION_COMPLAINT_RATE: "Reputation.ComplaintRate",
} as const;

/**
 * Fetches multiple CloudWatch metrics in a single API call.
 * Much more efficient than calling getCloudWatchMetrics multiple times —
 * one DB lookup, one client, one API call instead of N of each.
 */
export async function getCloudWatchMetricsBatch(params: {
  awsAccountId: string;
  metrics: string[];
  period: number;
  startTime: Date;
  endTime: Date;
  stat?: "Sum" | "Average" | "Maximum" | "Minimum" | "SampleCount";
}): Promise<Record<string, MetricDataResult[]>> {
  const {
    awsAccountId,
    metrics,
    period,
    startTime,
    endTime,
    stat = "Sum",
  } = params;

  const account = await db.query.awsAccount.findFirst({
    where: (a, { eq }) => eq(a.id, awsAccountId),
  });

  if (!account) {
    throw new Error("AWS account not found");
  }

  const credentials = await getOrAssumeRole({
    roleArn: account.roleArn,
    externalId: account.externalId,
    region: account.region,
  });

  const cloudwatch = new CloudWatchClient({
    region: account.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  const queries: MetricDataQuery[] = metrics.map((metric, i) => ({
    Id: `m${i}`,
    MetricStat: {
      Metric: {
        Namespace: "AWS/SES",
        MetricName: metric,
      },
      Period: period,
      Stat: stat,
    },
  }));

  const command = new GetMetricDataCommand({
    MetricDataQueries: queries,
    StartTime: startTime,
    EndTime: endTime,
  });

  const response = await cloudwatch.send(command);
  const results = response.MetricDataResults || [];

  const out: Record<string, MetricDataResult[]> = {};
  for (let i = 0; i < metrics.length; i++) {
    const result = results.find((r) => r.Id === `m${i}`);
    out[metrics[i]] = result ? [result] : [];
  }

  return out;
}

/**
 * Gets multiple SES metrics at once for dashboard display
 */
export async function getSESMetricsSummary(params: {
  awsAccountId: string;
  startTime: Date;
  endTime: Date;
  period?: number;
}): Promise<Record<string, MetricDataResult[]>> {
  const { awsAccountId, startTime, endTime, period = 3600 } = params;

  const results = await getCloudWatchMetricsBatch({
    awsAccountId,
    metrics: [
      SES_METRICS.SEND,
      SES_METRICS.DELIVERY,
      SES_METRICS.BOUNCE,
      SES_METRICS.COMPLAINT,
      SES_METRICS.RENDERING_FAILURE,
    ],
    period,
    startTime,
    endTime,
  });

  return {
    sends: results[SES_METRICS.SEND] || [],
    deliveries: results[SES_METRICS.DELIVERY] || [],
    bounces: results[SES_METRICS.BOUNCE] || [],
    complaints: results[SES_METRICS.COMPLAINT] || [],
    renderingFailures: results[SES_METRICS.RENDERING_FAILURE] || [],
  };
}

/**
 * Fetches SES account-level reputation rates from CloudWatch.
 *
 * SES publishes Reputation.BounceRate and Reputation.ComplaintRate as
 * pre-computed rolling averages — these are the exact values shown in the
 * SES console and used for enforcement decisions. They cover the account's
 * full send history, not just a user-selected period.
 *
 * Returns decimal rates (0–1). Multiply by 100 for percentages.
 * Returns null for each metric if SES hasn't published data yet (new accounts).
 */
export async function getSESReputationMetrics(
  awsAccountId: string
): Promise<{ bounceRate: number | null; complaintRate: number | null }> {
  const account = await db.query.awsAccount.findFirst({
    where: (a, { eq }) => eq(a.id, awsAccountId),
  });

  if (!account) {
    throw new Error("AWS account not found");
  }

  const credentials = await getOrAssumeRole({
    roleArn: account.roleArn,
    externalId: account.externalId,
    region: account.region,
  });

  const cloudwatch = new CloudWatchClient({
    region: account.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  // Query the last 7 days to ensure we get a data point even if SES publishes
  // infrequently. Use Average because these are rate values (0–1), not counts.
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

  const command = new GetMetricDataCommand({
    MetricDataQueries: [
      {
        Id: "bounce_rate",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: SES_METRICS.REPUTATION_BOUNCE_RATE,
          },
          Period: 86400,
          Stat: "Average",
        },
      },
      {
        Id: "complaint_rate",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: SES_METRICS.REPUTATION_COMPLAINT_RATE,
          },
          Period: 86400,
          Stat: "Average",
        },
      },
    ],
    StartTime: startTime,
    EndTime: endTime,
  });

  const response = await cloudwatch.send(command);
  const results = response.MetricDataResults || [];

  const latestValue = (id: string): number | null => {
    const result = results.find((r) => r.Id === id);
    const values = result?.Values;
    return values && values.length > 0 ? (values[0] ?? null) : null;
  };

  return {
    bounceRate: latestValue("bounce_rate"),
    complaintRate: latestValue("complaint_rate"),
  };
}
