import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import {
  DescribeSpendLimitsCommand,
  PinpointSMSVoiceV2Client,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export type SMSMetricsData = {
  sends: Array<{ timestamp: number; value: number }>;
  deliveries: Array<{ timestamp: number; value: number }>;
  failures: Array<{ timestamp: number; value: number }>;
  optOuts: Array<{ timestamp: number; value: number }>;
};

export type SMSQuota = {
  spendLimitMonthly: number;
  spendLimitDaily: number;
  spentThisMonth: number;
};

/**
 * Fetch SMS spend limits and current spend from AWS
 */
export async function fetchSMSSpendLimits(region: string): Promise<SMSQuota> {
  const smsClient = new PinpointSMSVoiceV2Client({ region });
  const cloudwatch = new CloudWatchClient({ region });

  try {
    // Fetch spend limits from SMS API
    const spendLimits = await smsClient.send(
      new DescribeSpendLimitsCommand({})
    );

    // Find monthly limit
    let monthlyLimit = 1.0; // Default $1
    const dailyLimit = 1.0;

    for (const limit of spendLimits.SpendLimits || []) {
      if (limit.Name === "TEXT_MESSAGE_MONTHLY_SPEND_LIMIT") {
        monthlyLimit = limit.EnforcedLimit || limit.MaxLimit || 1.0;
      }
    }

    // Fetch current month's spend from CloudWatch
    // TextMessageMonthlySpend metric shows cumulative spend for the month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const metricsResponse = await cloudwatch.send(
      new GetMetricDataCommand({
        MetricDataQueries: [
          {
            Id: "monthlySpend",
            MetricStat: {
              Metric: {
                Namespace: "AWS/SMSVoice",
                MetricName: "TextMessageMonthlySpend",
              },
              Period: 86_400, // 1 day
              Stat: "Maximum", // Get the latest cumulative value
            },
          },
        ],
        StartTime: startOfMonth,
        EndTime: now,
        ScanBy: "TimestampDescending", // Get most recent first
      })
    );

    let spentThisMonth = 0;
    const spendResults = metricsResponse.MetricDataResults?.find(
      (r) => r.Id === "monthlySpend"
    );
    if (spendResults?.Values && spendResults.Values.length > 0) {
      // Get the most recent (highest) value as it's cumulative
      spentThisMonth = Math.max(...spendResults.Values);
    }

    return {
      spendLimitMonthly: monthlyLimit,
      spendLimitDaily: dailyLimit,
      spentThisMonth,
    };
  } catch (error) {
    console.error("Error fetching SMS spend limits:", error);
    // Return defaults if we can't fetch
    return {
      spendLimitMonthly: 1.0,
      spendLimitDaily: 1.0,
      spentThisMonth: 0,
    };
  }
}

/**
 * Fetch SMS metrics from DynamoDB (aggregated from event history)
 */
export async function fetchSMSMetricsFromDynamoDB(
  region: string,
  tableName: string,
  timeRange: { start: Date; end: Date }
): Promise<SMSMetricsData> {
  const dynamodb = new DynamoDBClient({ region });

  try {
    // Scan for items in the time range
    // Note: For production with large datasets, this should use a GSI on timestamp
    const response = await dynamodb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "sentAt BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":start": { N: timeRange.start.getTime().toString() },
          ":end": { N: timeRange.end.getTime().toString() },
        },
      })
    );

    const items = (response.Items || []).map((item) => unmarshall(item));

    // Group by messageId to get unique messages (since we may have multiple events per message)
    const messageMap = new Map<string, any>();
    for (const item of items) {
      const messageId = item.messageId;
      const existing = messageMap.get(messageId);

      if (existing) {
        // Keep the item with highest priority event type
        const currentPriority = getEventPriority(item.eventType);
        const existingPriority = getEventPriority(existing.eventType);
        if (currentPriority > existingPriority) {
          messageMap.set(messageId, item);
        }
      } else {
        messageMap.set(messageId, item);
      }
    }

    // Aggregate by hour for the time series
    const hourlyBuckets = new Map<
      number,
      {
        sends: number;
        deliveries: number;
        failures: number;
        optOuts: number;
      }
    >();

    for (const item of messageMap.values()) {
      const timestamp = Number(item.sentAt || item.timestamp);
      // Round to hour
      const hourBucket =
        Math.floor(timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);

      const bucket = hourlyBuckets.get(hourBucket) || {
        sends: 0,
        deliveries: 0,
        failures: 0,
        optOuts: 0,
      };

      const eventType = (item.eventType || "").toUpperCase();

      // Count as a send regardless of final status
      bucket.sends++;

      if (eventType.includes("SUCCESSFUL") || eventType.includes("DELIVERED")) {
        bucket.deliveries++;
      } else if (
        eventType.includes("FAILED") ||
        eventType.includes("UNREACHABLE") ||
        eventType.includes("UNKNOWN") ||
        eventType.includes("BLOCKED") ||
        eventType.includes("INVALID")
      ) {
        bucket.failures++;
      }

      if (eventType.includes("OPTED_OUT")) {
        bucket.optOuts++;
      }

      hourlyBuckets.set(hourBucket, bucket);
    }

    // Convert to arrays
    const sortedBuckets = Array.from(hourlyBuckets.entries()).sort(
      ([a], [b]) => a - b
    );

    return {
      sends: sortedBuckets.map(([timestamp, data]) => ({
        timestamp,
        value: data.sends,
      })),
      deliveries: sortedBuckets.map(([timestamp, data]) => ({
        timestamp,
        value: data.deliveries,
      })),
      failures: sortedBuckets.map(([timestamp, data]) => ({
        timestamp,
        value: data.failures,
      })),
      optOuts: sortedBuckets.map(([timestamp, data]) => ({
        timestamp,
        value: data.optOuts,
      })),
    };
  } catch (error) {
    console.error("Error fetching SMS metrics from DynamoDB:", error);
    return {
      sends: [],
      deliveries: [],
      failures: [],
      optOuts: [],
    };
  }
}

/**
 * Get event type priority (higher = more final)
 */
function getEventPriority(eventType?: string): number {
  const type = (eventType || "").toUpperCase();
  if (type.includes("OPTED_OUT")) {
    return 8;
  }
  if (type.includes("BLOCKED")) {
    return 7;
  }
  if (type.includes("INVALID")) {
    return 6;
  }
  if (type.includes("FAILED") || type.includes("UNKNOWN")) {
    return 5;
  }
  if (type.includes("UNREACHABLE")) {
    return 4;
  }
  if (type.includes("SUCCESSFUL") || type.includes("DELIVERED")) {
    return 3;
  }
  if (type.includes("SENT") || type.includes("PENDING")) {
    return 2;
  }
  if (type.includes("QUEUED")) {
    return 1;
  }
  return 0;
}

/**
 * Get summary counts from DynamoDB for dashboard stats
 */
export async function fetchSMSSummaryCounts(
  region: string,
  tableName: string,
  timeRange: { start: Date; end: Date }
): Promise<{
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
}> {
  const metrics = await fetchSMSMetricsFromDynamoDB(
    region,
    tableName,
    timeRange
  );

  const totalSent = metrics.sends.reduce((sum, d) => sum + d.value, 0);
  const totalDelivered = metrics.deliveries.reduce(
    (sum, d) => sum + d.value,
    0
  );
  const totalFailed = metrics.failures.reduce((sum, d) => sum + d.value, 0);
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

  return {
    totalSent,
    totalDelivered,
    totalFailed,
    deliveryRate,
  };
}
