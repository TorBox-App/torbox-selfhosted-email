/**
 * EventBridge Scheduler Resources
 *
 * Base resources for EventBridge Scheduler - separated from queue subscriptions
 * to avoid circular dependencies.
 *
 * - schedulerGroup: Group for organizing schedules
 * - schedulerRole: IAM role for Scheduler to send to SQS
 */

// Schedule Group for organizing schedules (broadcasts + workflows)
export const schedulerGroup = new aws.scheduler.ScheduleGroup(
  "BroadcastSchedules",
  {
    name: $interpolate`wraps-broadcasts-${$app.stage}`,
    tags: {
      ManagedBy: "sst",
      Service: "wraps-api",
    },
  }
);

// IAM Role for EventBridge Scheduler to send messages to SQS
export const schedulerRole = new aws.iam.Role("SchedulerRole", {
  name: $interpolate`wraps-scheduler-role-${$app.stage}`,
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "scheduler.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  }),
  tags: {
    ManagedBy: "sst",
    Service: "wraps-api",
  },
});
