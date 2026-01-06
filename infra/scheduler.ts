/**
 * EventBridge Scheduler for Wraps Platform
 *
 * Scheduler:
 * - Creates one-time schedules for broadcast sends
 * - Triggers batch jobs at scheduled times via SQS
 * - Auto-deletes schedules after execution
 *
 * Note: SST doesn't have a built-in component for EventBridge Scheduler,
 * so we use the raw AWS provider (Pulumi) directly.
 */

import { batchQueue, workflowQueue } from "./queues";
import { schedulerGroup, schedulerRole } from "./scheduler-resources";

// Re-export for backwards compatibility
export { schedulerGroup, schedulerRole };

// Policy to allow Scheduler to send messages to queues (batch + workflow)
new aws.iam.RolePolicy("SchedulerSqsPolicy", {
  role: schedulerRole.name,
  policy: $jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["sqs:SendMessage"],
        Resource: [batchQueue.arn, workflowQueue.arn],
      },
    ],
  }),
});
