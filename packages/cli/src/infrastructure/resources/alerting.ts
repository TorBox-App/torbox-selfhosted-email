import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import {
  type AlertConfig,
  type AlertThresholds,
  DEFAULT_ALERT_THRESHOLDS,
} from "../../types/index.js";

/**
 * Alerting resources configuration
 */
export type AlertingConfig = {
  /** Alert configuration from user */
  alertConfig: AlertConfig;
  /** SES configuration set name for metric dimensions */
  configSetName?: pulumi.Output<string>;
  /** SQS DLQ URL for DLQ alerting */
  dlqName?: string;
  /** AWS region */
  region: string;
};

/**
 * Alerting resources output
 */
export type AlertingResources = {
  /** SNS topic for alert notifications */
  topic: aws.sns.Topic;
  /** Email subscription (if configured) */
  emailSubscription?: aws.sns.TopicSubscription;
  /** Webhook subscription (if configured) */
  webhookSubscription?: aws.sns.TopicSubscription;
  /** Bounce rate warning alarm */
  bounceRateWarningAlarm: aws.cloudwatch.MetricAlarm;
  /** Bounce rate critical alarm */
  bounceRateCriticalAlarm: aws.cloudwatch.MetricAlarm;
  /** Complaint rate warning alarm */
  complaintRateWarningAlarm: aws.cloudwatch.MetricAlarm;
  /** Complaint rate critical alarm */
  complaintRateCriticalAlarm: aws.cloudwatch.MetricAlarm;
  /** DLQ depth alarm (if configured) */
  dlqAlarm?: aws.cloudwatch.MetricAlarm;
};

/**
 * Get thresholds with defaults applied
 */
function getThresholds(custom?: AlertThresholds): Required<AlertThresholds> {
  return {
    ...DEFAULT_ALERT_THRESHOLDS,
    ...custom,
  };
}

/**
 * Create alerting resources for email infrastructure
 *
 * Deploys:
 * - SNS topic for notifications
 * - Email/webhook subscriptions
 * - CloudWatch alarms for bounce rate (warning + critical)
 * - CloudWatch alarms for complaint rate (warning + critical)
 * - CloudWatch alarm for DLQ depth (optional)
 *
 * Thresholds are set to warn BEFORE AWS SES or Gmail take action:
 * - Bounce: Warning at 2%, Critical at 4% (AWS warns at 5%, suspends ~10%)
 * - Complaint: Warning at 0.05%, Critical at 0.08% (AWS warns at 0.1%, Gmail blocks at 0.3%)
 */
export async function createAlertingResources(
  config: AlertingConfig
): Promise<AlertingResources> {
  const thresholds = getThresholds(config.alertConfig.thresholds);

  // 1. Create SNS topic for alert notifications
  const topic = new aws.sns.Topic("wraps-email-alerts", {
    name: "wraps-email-alerts",
    displayName: "Wraps Email Alerts",
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email",
      Description: "Alert notifications for email reputation and health",
    },
  });

  // 2. Create email subscription if configured
  let emailSubscription: aws.sns.TopicSubscription | undefined;
  if (config.alertConfig.notificationEmail) {
    emailSubscription = new aws.sns.TopicSubscription(
      "wraps-email-alerts-email",
      {
        topic: topic.arn,
        protocol: "email",
        endpoint: config.alertConfig.notificationEmail,
      }
    );
  }

  // 3. Create webhook subscription if configured (HTTPS endpoint)
  let webhookSubscription: aws.sns.TopicSubscription | undefined;
  if (config.alertConfig.webhookUrl) {
    webhookSubscription = new aws.sns.TopicSubscription(
      "wraps-email-alerts-webhook",
      {
        topic: topic.arn,
        protocol: "https",
        endpoint: config.alertConfig.webhookUrl,
      }
    );
  }

  // 4. Create CloudWatch alarms for SES reputation metrics
  // Note: SES reputation metrics are available when reputationMetricsEnabled is true on the config set

  // Bounce rate WARNING alarm (2% default)
  const bounceRateWarningAlarm = new aws.cloudwatch.MetricAlarm(
    "wraps-bounce-rate-warning",
    {
      name: "wraps-email-bounce-rate-warning",
      alarmDescription: `Bounce rate exceeded ${thresholds.bounceRateWarning * 100}% - investigate before AWS takes action (warns at 5%, suspends at 10%)`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2, // Require 2 consecutive periods to reduce noise
      metricName: "Reputation.BounceRate",
      namespace: "AWS/SES",
      period: 300, // 5 minutes
      statistic: "Average",
      threshold: thresholds.bounceRateWarning,
      alarmActions: [topic.arn],
      okActions: [topic.arn], // Notify when resolved
      treatMissingData: "notBreaching", // Don't alarm if no data (no emails sent)
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email",
        Severity: "warning",
      },
    }
  );

  // Bounce rate CRITICAL alarm (4% default)
  const bounceRateCriticalAlarm = new aws.cloudwatch.MetricAlarm(
    "wraps-bounce-rate-critical",
    {
      name: "wraps-email-bounce-rate-critical",
      alarmDescription: `CRITICAL: Bounce rate exceeded ${thresholds.bounceRateCritical * 100}% - approaching AWS warning threshold (5%). Immediate action required!`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 1, // Alert immediately on critical
      metricName: "Reputation.BounceRate",
      namespace: "AWS/SES",
      period: 300, // 5 minutes
      statistic: "Average",
      threshold: thresholds.bounceRateCritical,
      alarmActions: [topic.arn],
      okActions: [topic.arn],
      treatMissingData: "notBreaching",
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email",
        Severity: "critical",
      },
    }
  );

  // Complaint rate WARNING alarm (0.05% default)
  const complaintRateWarningAlarm = new aws.cloudwatch.MetricAlarm(
    "wraps-complaint-rate-warning",
    {
      name: "wraps-email-complaint-rate-warning",
      alarmDescription: `Complaint rate exceeded ${thresholds.complaintRateWarning * 100}% - investigate before AWS (0.1%) or Gmail (0.3%) take action`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "Reputation.ComplaintRate",
      namespace: "AWS/SES",
      period: 300,
      statistic: "Average",
      threshold: thresholds.complaintRateWarning,
      alarmActions: [topic.arn],
      okActions: [topic.arn],
      treatMissingData: "notBreaching",
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email",
        Severity: "warning",
      },
    }
  );

  // Complaint rate CRITICAL alarm (0.08% default)
  const complaintRateCriticalAlarm = new aws.cloudwatch.MetricAlarm(
    "wraps-complaint-rate-critical",
    {
      name: "wraps-email-complaint-rate-critical",
      alarmDescription: `CRITICAL: Complaint rate exceeded ${thresholds.complaintRateCritical * 100}% - approaching AWS warning (0.1%). Immediate action required!`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 1,
      metricName: "Reputation.ComplaintRate",
      namespace: "AWS/SES",
      period: 300,
      statistic: "Average",
      threshold: thresholds.complaintRateCritical,
      alarmActions: [topic.arn],
      okActions: [topic.arn],
      treatMissingData: "notBreaching",
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email",
        Severity: "critical",
      },
    }
  );

  // 5. Create DLQ alarm if configured and DLQ exists
  let dlqAlarm: aws.cloudwatch.MetricAlarm | undefined;
  if (config.alertConfig.dlqAlerts !== false && config.dlqName) {
    dlqAlarm = new aws.cloudwatch.MetricAlarm("wraps-dlq-alarm", {
      name: "wraps-email-dlq-messages",
      alarmDescription:
        "Messages in dead letter queue - event processing is failing. Check Lambda logs for errors.",
      comparisonOperator: "GreaterThanOrEqualToThreshold",
      evaluationPeriods: 1,
      metricName: "ApproximateNumberOfMessagesVisible",
      namespace: "AWS/SQS",
      period: 60, // Check every minute
      statistic: "Sum",
      threshold: thresholds.dlqMessageThreshold,
      dimensions: {
        QueueName: config.dlqName,
      },
      alarmActions: [topic.arn],
      okActions: [topic.arn],
      treatMissingData: "notBreaching",
      tags: {
        ManagedBy: "wraps-cli",
        Service: "email",
        Severity: "warning",
      },
    });
  }

  return {
    topic,
    emailSubscription,
    webhookSubscription,
    bounceRateWarningAlarm,
    bounceRateCriticalAlarm,
    complaintRateWarningAlarm,
    complaintRateCriticalAlarm,
    dlqAlarm,
  };
}
