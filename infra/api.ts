/**
 * API Gateway + Lambda for Wraps Platform API
 *
 * Elysia API:
 * - POST /v1/batch - Create batch send
 * - GET /v1/batch/:id - Get batch status
 * - DELETE /v1/batch/:id - Cancel batch send
 * - GET /health - Health check
 *
 * Features:
 * - API key authentication
 * - Rate limiting via DynamoDB
 * - Plan-based feature gating
 * - Scheduled broadcasts via EventBridge Scheduler
 */

import { execSync } from "node:child_process";
import { batchQueue, workflowQueue } from "./queues";
import { schedulerGroup, schedulerRole } from "./scheduler";
import { axiomToken, sentryDsn } from "./secrets";
import { rateLimitTable } from "./tables";

// API Gateway with Elysia Lambda handler
export const api = new sst.aws.ApiGatewayV2("Api", {
  // Custom domain for production (DNS managed in Cloudflare)
  domain:
    $app.stage === "production"
      ? {
          name: "api.wraps.dev",
          dns: sst.cloudflare.dns(),
        }
      : undefined,
  transform: {
    api: {
      tags: {
        ManagedBy: "sst",
        Service: "wraps-api",
      },
    },
  },
});

// Main API handler - Elysia app
const apiHandler = new sst.aws.Function("ApiHandler", {
  handler: "apps/api/src/lambda.handler",
  runtime: "nodejs24.x",
  timeout: "30 seconds",
  memory: "512 MB",
  environment: {
    NODE_ENV: "production",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    AXIOM_TOKEN: axiomToken.value,
    AXIOM_DATASET: "wraps",
    BATCH_QUEUE_URL: batchQueue.url,
    RATE_LIMIT_TABLE_NAME: rateLimitTable.name,
    // EventBridge Scheduler config for scheduled broadcasts
    BATCH_QUEUE_ARN: batchQueue.arn,
    SCHEDULER_ROLE_ARN: schedulerRole.arn,
    SCHEDULER_GROUP_NAME: schedulerGroup.name,
    // Workflow automation queue
    WORKFLOW_QUEUE_URL: workflowQueue.url,
    WORKFLOW_QUEUE_ARN: workflowQueue.arn,
    // Confirmation email tokens (double opt-in)
    UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wraps.dev",
    // Anthropic API key for AI workflow generation
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    SENTRY_DSN: sentryDsn.value,
  },
  link: [rateLimitTable, batchQueue, workflowQueue],
  nodejs: {
    install: ["pg", "@sentry/profiling-node"], // PostgreSQL driver + Sentry native profiler
    sourcemap: true,
  },
  hook: {
    postbuild: async (buildDir) => {
      const authToken = process.env.SENTRY_AUTH_TOKEN;
      if (!authToken) {
        console.warn("SENTRY_AUTH_TOKEN not set, skipping source map upload");
        return;
      }
      const env = {
        ...process.env,
        SENTRY_AUTH_TOKEN: authToken,
        SENTRY_ORG: "wraps",
        SENTRY_PROJECT: "api",
      };
      try {
        execSync(`npx @sentry/cli sourcemaps inject ${buildDir}`, {
          stdio: "inherit",
          env,
        });
        execSync(`npx @sentry/cli sourcemaps upload ${buildDir}`, {
          stdio: "inherit",
          env,
        });
        console.log("Sentry source maps uploaded for API");
        // Delete .map files so they don't ship to Lambda
        execSync(`find ${buildDir} -name '*.map' -delete`, {
          stdio: "inherit",
        });
      } catch (err) {
        console.error("Sentry source map upload failed:", err);
      }
    },
  },
  url: false, // We use API Gateway, not function URLs
  permissions: [
    // Allow creating/updating/deleting EventBridge Scheduler schedules
    {
      actions: [
        "scheduler:CreateSchedule",
        "scheduler:UpdateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule",
      ],
      resources: [
        $interpolate`arn:aws:scheduler:*:*:schedule/${schedulerGroup.name}/*`,
      ],
    },
    // Allow passing the scheduler role to EventBridge
    {
      actions: ["iam:PassRole"],
      resources: [schedulerRole.arn],
    },
    // Allow assuming customer AWS roles for sending emails (double opt-in, etc.)
    {
      actions: ["sts:AssumeRole"],
      resources: ["*"], // Customer roles are in their AWS accounts
    },
  ],
});

// Route all requests to the Elysia handler
api.route("ANY /{proxy+}", apiHandler.arn);
api.route("ANY /", apiHandler.arn);
