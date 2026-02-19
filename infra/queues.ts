/**
 * SQS Queues for Wraps Platform
 *
 * Batch Queue:
 * - Processes batch email/SMS sends in chunks
 * - Each message contains a batch job with chunk information
 * - Failed messages go to DLQ for investigation
 */

import { schedulerGroup, schedulerRole } from "./scheduler-resources";

// Dead Letter Queue for failed batch jobs
export const batchDlq = new sst.aws.Queue("BatchDlq", {
  transform: {
    queue: {
      messageRetentionSeconds: 1_209_600, // 14 days
      tags: {
        ManagedBy: "sst",
        Service: "wraps-api",
      },
    },
  },
});

// Main batch processing queue
export const batchQueue = new sst.aws.Queue("BatchQueue", {
  dlq: {
    queue: batchDlq.arn,
    retry: 3, // Retry 3 times before sending to DLQ
  },
  transform: {
    queue: {
      visibilityTimeoutSeconds: 300, // 5 minutes for processing
      messageRetentionSeconds: 86_400, // 1 day
      tags: {
        ManagedBy: "sst",
        Service: "wraps-api",
      },
    },
  },
});

// Subscribe batch worker to the queue
// The worker is defined in apps/api/src/workers/batch-sender.ts
batchQueue.subscribe(
  {
    handler: "apps/api/src/workers/batch-sender.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "512 MB",
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      // Base URLs for unsubscribe/preferences links
      API_BASE_URL:
        $app.stage === "production"
          ? "https://api.wraps.dev"
          : (process.env.API_BASE_URL ?? "https://api.wraps.dev"),
      APP_BASE_URL:
        $app.stage === "production"
          ? "https://app.wraps.dev"
          : (process.env.APP_BASE_URL ?? "https://app.wraps.dev"),
      // Secret for signing unsubscribe tokens (must match API and web)
      UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET,
      // PostHog for activation tracking
      POSTHOG_KEY: process.env.POSTHOG_KEY ?? "",
      // Wraps platform for activation event emission
      WRAPS_API_KEY: process.env.WRAPS_API_KEY ?? "",
    },
    nodejs: {
      install: ["pg"], // PostgreSQL driver for Drizzle
    },
    permissions: [
      // Allow assuming cross-account roles for sending via customer's SES
      {
        actions: ["sts:AssumeRole"],
        resources: ["arn:aws:iam::*:role/wraps-*"],
      },
    ],
  },
  {
    batch: {
      size: 1, // Process one batch job at a time
    },
  }
);

/**
 * Workflow Queue for Wraps Automations
 *
 * Processes workflow jobs:
 * - trigger: Start a workflow for a contact
 * - execute: Execute a specific workflow step
 * - resume: Resume a delayed execution
 */

// Dead Letter Queue for failed workflow jobs
export const workflowDlq = new sst.aws.Queue("WorkflowDlq", {
  transform: {
    queue: {
      visibilityTimeoutSeconds: 70, // Must exceed consumer Lambda timeout (60s)
      messageRetentionSeconds: 1_209_600, // 14 days
      tags: {
        ManagedBy: "sst",
        Service: "wraps-api",
      },
    },
  },
});

// Subscribe DLQ consumer to mark failed executions in DB
workflowDlq.subscribe(
  {
    handler: "apps/api/src/(ee)/workers/workflow-dlq-consumer.handler",
    runtime: "nodejs22.x",
    timeout: "1 minute",
    memory: "256 MB",
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
    },
    nodejs: {
      install: ["pg"],
    },
  },
  {
    batch: {
      size: 10,
    },
  }
);

// Main workflow processing queue
export const workflowQueue = new sst.aws.Queue("WorkflowQueue", {
  dlq: {
    queue: workflowDlq.arn,
    retry: 3, // Retry 3 times before sending to DLQ
  },
  transform: {
    queue: {
      visibilityTimeoutSeconds: 300, // 5 minutes for processing
      messageRetentionSeconds: 86_400, // 1 day
      tags: {
        ManagedBy: "sst",
        Service: "wraps-api",
      },
    },
  },
});

// Subscribe workflow processor to the queue
// The worker is defined in apps/api/src/(ee)/workers/workflow-processor.ts
workflowQueue.subscribe(
  {
    handler: "apps/api/src/(ee)/workers/workflow-processor.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "512 MB",
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      WORKFLOW_QUEUE_URL: workflowQueue.url,
      WORKFLOW_QUEUE_ARN: workflowQueue.arn,
      // EventBridge Scheduler config for delays
      SCHEDULER_ROLE_ARN: schedulerRole.arn,
      SCHEDULER_GROUP_NAME: schedulerGroup.name,
      // Base URLs for unsubscribe/preferences links
      API_BASE_URL:
        $app.stage === "production"
          ? "https://api.wraps.dev"
          : (process.env.API_BASE_URL ?? "https://api.wraps.dev"),
      APP_BASE_URL:
        $app.stage === "production"
          ? "https://app.wraps.dev"
          : (process.env.APP_BASE_URL ?? "https://app.wraps.dev"),
      // Secret for signing unsubscribe tokens (must match API and web)
      UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET,
      // PostHog for activation tracking
      POSTHOG_KEY: process.env.POSTHOG_KEY ?? "",
      // Wraps platform for activation event emission
      WRAPS_API_KEY: process.env.WRAPS_API_KEY ?? "",
    },
    nodejs: {
      install: ["pg"], // PostgreSQL driver for Drizzle
    },
    permissions: [
      // Allow assuming cross-account roles for sending via customer's SES
      {
        actions: ["sts:AssumeRole"],
        resources: ["arn:aws:iam::*:role/wraps-*"],
      },
      // Allow sending messages back to workflow queue (for next steps)
      {
        actions: ["sqs:SendMessage"],
        resources: [workflowQueue.arn],
      },
      // Allow creating/deleting EventBridge schedules for delays
      {
        actions: [
          "scheduler:CreateSchedule",
          "scheduler:DeleteSchedule",
          "scheduler:GetSchedule",
        ],
        resources: [
          $interpolate`arn:aws:scheduler:*:*:schedule/${schedulerGroup.name}/*`,
        ],
      },
      // Allow passing the scheduler role
      {
        actions: ["iam:PassRole"],
        resources: [schedulerRole.arn],
      },
    ],
  },
  {
    batch: {
      size: 1, // Process one workflow job at a time
    },
  }
);
