/**
 * Scheduled Cron Jobs for Wraps Platform
 *
 * AuditLogCleanup:
 * - Runs nightly at 02:00 UTC in production
 * - Deletes audit_log rows older than the org's plan retention window
 * - free=7d, starter=30d, growth=90d, scale=365d
 *
 * WorkflowReaper:
 * - Runs hourly in production
 * - Detects and fails stuck workflow executions:
 *   - Paused executions with nextStepScheduledAt > 30 minutes ago
 *   - Waiting executions with waitTimeoutAt > 5 minutes ago
 * - This is a backstop for lost EventBridge Scheduler deliveries; each
 *   paused/waiting execution also has its own one-time schedule that
 *   normally resumes it. Always-on so the backstop is never disarmed.
 */

import { axiomToken } from "./secrets";

export const auditLogCleanupCron = new sst.aws.CronV2("AuditLogCleanup", {
  schedule: "cron(0 2 * * ? *)",
  enabled: $app.stage === "production",
  job: {
    handler: "apps/api/src/workers/audit-log-cleanup.handler",
    runtime: "nodejs24.x",
    timeout: "5 minutes",
    memory: "256 MB",
    environment: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        (() => {
          throw new Error("DATABASE_URL is required");
        })(),
      AXIOM_TOKEN: axiomToken.value,
      AXIOM_DATASET: "wraps",
    },
    nodejs: { install: ["pg"] },
  },
});

export const workflowReaperCron = new sst.aws.CronV2("WorkflowReaper", {
  schedule: "rate(1 hour)",
  enabled: $app.stage === "production",
  job: {
    handler: "apps/api/src/(ee)/workers/workflow-reaper.handler",
    runtime: "nodejs24.x",
    timeout: "5 minutes",
    memory: "256 MB",
    environment: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        (() => {
          throw new Error("DATABASE_URL is required");
        })(),
      AXIOM_TOKEN: axiomToken.value,
      AXIOM_DATASET: "wraps",
    },
    nodejs: { install: ["pg"] },
  },
});
