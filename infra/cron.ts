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
 *
 * EventFeedStaleness:
 * - Runs hourly at :15 in production
 * - Flags connected AWS accounts whose SES event feed has gone silent
 *   while sends are still happening, and emails the org owner once per
 *   episode. See apps/api/src/workers/event-feed-staleness.ts.
 * - NOTE: this function does NOT (yet) have SES-capable credentials wired
 *   for @wraps/email — no platform Lambda does today (plan 113 STOP
 *   condition 3). Detection/flagging/the dashboard banner work regardless;
 *   the owner email send will fail until this function is granted
 *   SES-capable credentials (mirroring how apps/web resolves them via
 *   Vercel OIDC + WRAPS_EMAIL_ROLE_ARN — see packages/email/src/lib/client.ts).
 *   Do not invent that IAM wiring here without a real precedent to follow.
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

export const eventFeedStalenessCron = new sst.aws.CronV2("EventFeedStaleness", {
  schedule: "cron(15 * * * ? *)",
  enabled: $app.stage === "production",
  job: {
    handler: "apps/api/src/workers/event-feed-staleness.handler",
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
      // TODO(plan 113 STOP condition 3): no SES-capable credentials are
      // wired here yet. getWrapsClient() falls back to the standard AWS
      // credential chain (this function's own execution role), which has
      // no SES send permissions — the owner-alert email will fail until
      // this is wired up. Detection/flagging/the dashboard banner are
      // unaffected. See the module comment above for context.
    },
    nodejs: { install: ["pg"] },
  },
});
