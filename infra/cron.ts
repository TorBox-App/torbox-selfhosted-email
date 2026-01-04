/**
 * Cron Jobs for Wraps Platform
 *
 * Schedule Trigger Processor:
 * - Runs every minute
 * - Checks for workflows with schedule triggers that are due
 * - Enqueues workflow jobs for matching contacts
 */

import { workflowQueue } from "./queues";

// Cron to check scheduled workflows every minute
export const scheduleTriggerCron = new sst.aws.Cron("ScheduleTriggerCron", {
  schedule: "rate(1 minute)",
  job: {
    handler: "apps/api/src/workers/schedule-trigger-processor.handler",
    runtime: "nodejs22.x",
    timeout: "2 minutes",
    memory: "512 MB",
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      WORKFLOW_QUEUE_URL: workflowQueue.url,
    },
    nodejs: {
      install: ["pg"], // PostgreSQL driver for Drizzle
    },
    permissions: [
      // Allow sending messages to workflow queue
      {
        actions: ["sqs:SendMessage"],
        resources: [workflowQueue.arn],
      },
    ],
  },
});
