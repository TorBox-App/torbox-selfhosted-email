/**
 * SQS Queues for Wraps Platform
 *
 * Batch Queue:
 * - Processes batch email/SMS sends in chunks
 * - Each message contains a batch job with chunk information
 * - Failed messages go to DLQ for investigation
 */

import { schedulerGroup, schedulerRole } from "./scheduler-resources";
import { axiomToken } from "./secrets";

// Dead Letter Queue for failed batch jobs.
// A consumer (apps/api/src/workers/batch-dlq-consumer.ts) drains it and
// re-enqueues the NEXT chunk on batchQueue using batchSend.lastChunkIndex
// + lastCursor as the resume pointer. Subscription is wired AFTER
// batchQueue is declared (we need its URL/ARN).
export const batchDlq = new sst.aws.Queue("BatchDlq", {
  transform: {
    queue: {
      // Consumer timeout is 60s; visibility timeout must exceed that.
      visibilityTimeoutSeconds: 70,
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
      // 14 days — matches DLQ retention so in-flight chunks can wait out
      // long incidents without silent message loss.
      messageRetentionSeconds: 1_209_600,
      tags: {
        ManagedBy: "sst",
        Service: "wraps-api",
      },
    },
  },
});

// Subscribe DLQ consumer — re-enqueues next chunk onto batchQueue based on
// the durable heartbeat in batchSend.lastChunkIndex/lastCursor. Kill switch
// via BROADCAST_DLQ_CONSUMER_ENABLED=false.
batchDlq.subscribe(
  {
    handler: "apps/api/src/workers/batch-dlq-consumer.handler",
    runtime: "nodejs22.x",
    timeout: "1 minute",
    memory: "256 MB",
    environment: {
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AXIOM_TOKEN: axiomToken.value,
      AXIOM_DATASET: "wraps",
      BATCH_QUEUE_URL: batchQueue.url,
      BROADCAST_DLQ_CONSUMER_ENABLED:
        process.env.BROADCAST_DLQ_CONSUMER_ENABLED ?? "true",
    },
    nodejs: {
      install: ["pg"],
    },
    permissions: [
      // Re-enqueue chunks onto the main batch queue.
      {
        actions: ["sqs:SendMessage"],
        resources: [batchQueue.arn],
      },
    ],
  },
  {
    batch: {
      size: 10,
      partialResponses: true,
    },
  }
);

// Subscribe batch worker to the queue
// The worker is defined in apps/api/src/workers/batch-sender.ts
batchQueue.subscribe(
  {
    handler: "apps/api/src/workers/batch-sender.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "512 MB",
    environment: {
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AXIOM_TOKEN: axiomToken.value,
      AXIOM_DATASET: "wraps",
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
      // Allow enqueuing the next chunk after processing current one
      BATCH_QUEUE_URL: batchQueue.url,
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
      // Allow enqueuing the next chunk back onto the batch queue
      {
        actions: ["sqs:SendMessage"],
        resources: [batchQueue.arn],
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
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AXIOM_TOKEN: axiomToken.value,
      AXIOM_DATASET: "wraps",
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
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AXIOM_TOKEN: axiomToken.value,
      AXIOM_DATASET: "wraps",
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
      size: 10,
      partialResponses: true,
    },
  }
);
