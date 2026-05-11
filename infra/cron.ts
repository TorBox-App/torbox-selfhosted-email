/**
 * Scheduled Cron Jobs for Wraps Platform
 *
 * AuditLogCleanup:
 * - Runs nightly at 02:00 UTC in production
 * - Deletes audit_log rows older than the org's plan retention window
 * - free=7d, starter=30d, growth=90d, scale=365d
 */

import { axiomToken } from "./secrets";

export const auditLogCleanupCron = new sst.aws.CronV2("AuditLogCleanup", {
  schedule: "cron(0 2 * * ? *)",
  enabled: $app.stage === "production",
  job: {
    handler: "apps/api/src/workers/audit-log-cleanup.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "256 MB",
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      AXIOM_TOKEN: axiomToken.value,
      AXIOM_DATASET: "wraps",
    },
    nodejs: { install: ["pg"] },
  },
});
