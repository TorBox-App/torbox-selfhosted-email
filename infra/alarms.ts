/**
 * Platform Alerting Infrastructure
 *
 * SNS topic + CloudWatch alarms for DLQ monitoring.
 * Alerts when any message lands in the workflow or batch DLQs.
 */

import { batchDlq, workflowDlq } from "./queues";

// SNS topic for alarm notifications
export const alertsTopic = new aws.sns.Topic("AlertsTopic", {
  name: $interpolate`wraps-alerts-${$app.stage}`,
  tags: {
    ManagedBy: "sst",
    Service: "wraps-api",
  },
});

// Optional email subscription (only created if ALERT_EMAIL is set)
if (process.env.ALERT_EMAIL) {
  new aws.sns.TopicSubscription("AlertsEmailSubscription", {
    topic: alertsTopic.arn,
    protocol: "email",
    endpoint: process.env.ALERT_EMAIL,
  });
}

// Alarm: messages visible in the Workflow DLQ
new aws.cloudwatch.MetricAlarm("WorkflowDlqAlarm", {
  name: $interpolate`wraps-workflow-dlq-${$app.stage}`,
  alarmDescription: "One or more workflow jobs landed in the dead-letter queue",
  namespace: "AWS/SQS",
  metricName: "ApproximateNumberOfMessagesVisible",
  dimensions: {
    QueueName: workflowDlq.nodes.queue.name,
  },
  statistic: "Maximum",
  period: 60,
  evaluationPeriods: 1,
  threshold: 1,
  comparisonOperator: "GreaterThanOrEqualToThreshold",
  treatMissingData: "notBreaching",
  alarmActions: [alertsTopic.arn],
  okActions: [alertsTopic.arn],
  tags: {
    ManagedBy: "sst",
    Service: "wraps-api",
  },
});

// Alarm: messages visible in the Batch DLQ
new aws.cloudwatch.MetricAlarm("BatchDlqAlarm", {
  name: $interpolate`wraps-batch-dlq-${$app.stage}`,
  alarmDescription: "One or more batch jobs landed in the dead-letter queue",
  namespace: "AWS/SQS",
  metricName: "ApproximateNumberOfMessagesVisible",
  dimensions: {
    QueueName: batchDlq.nodes.queue.name,
  },
  statistic: "Maximum",
  period: 60,
  evaluationPeriods: 1,
  threshold: 1,
  comparisonOperator: "GreaterThanOrEqualToThreshold",
  treatMissingData: "notBreaching",
  alarmActions: [alertsTopic.arn],
  okActions: [alertsTopic.arn],
  tags: {
    ManagedBy: "sst",
    Service: "wraps-api",
  },
});
