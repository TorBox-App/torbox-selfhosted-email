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
 * - SES-capable credentials for @wraps/email are wired via
 *   WRAPS_EMAIL_ROLE_ARN + sts:AssumeRole on the dogfood email role
 *   (see the function definition below).
 *
 * AccountHealth:
 * - Runs hourly at :45 in production
 * - Assumes each connected account's customer role and checks SES account
 *   health: sending paused/enforcement, reputation thresholds, daily quota,
 *   sandbox->production transitions. Writes inbox notifications (deduped
 *   per account per day). See apps/api/src/workers/account-health.ts.
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
      // wraps.dev is verified in the dogfood account's SES (010836206701),
      // not this platform account — getWrapsClient() sees this env var and
      // assumes the role from this function's execution role, the same
      // sending identity the web app reaches via Vercel OIDC. The role's
      // trust policy also trusts this platform account for sts:AssumeRole.
      WRAPS_EMAIL_ROLE_ARN: "arn:aws:iam::010836206701:role/wraps-email-role",
    },
    nodejs: { install: ["pg"] },
    permissions: [
      {
        actions: ["sts:AssumeRole"],
        resources: ["arn:aws:iam::010836206701:role/wraps-email-role"],
      },
    ],
  },
});

export const accountHealthCron = new sst.aws.CronV2("AccountHealth", {
  schedule: "cron(45 * * * ? *)",
  enabled: $app.stage === "production",
  job: {
    handler: "apps/api/src/workers/account-health.handler",
    runtime: "nodejs24.x",
    timeout: "10 minutes",
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
    permissions: [
      // Assume cross-account customer roles to read SES account health
      {
        actions: ["sts:AssumeRole"],
        resources: ["arn:aws:iam::*:role/wraps-*"],
      },
    ],
  },
});
