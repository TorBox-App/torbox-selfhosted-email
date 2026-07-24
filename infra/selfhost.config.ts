/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 (Ion) Configuration for Wraps Self-Hosted Deployment
 *
 * Deploys the full Wraps platform to a customer's AWS account:
 * - API Lambda with function URL (no API Gateway cost for single-tenant)
 * - SQS queues for batch and workflow processing
 * - DynamoDB for rate limiting
 * - EventBridge Scheduler for scheduled broadcasts
 * - Next.js web app via sst.aws.Nextjs (OpenNext)
 *
 * Reads config from .env.selfhost in repo root.
 * Run via: pnpm selfhost:deploy — sst runs with cwd=infra/, which both the
 * .env.selfhost lookup below and the .sst/platform reference above depend on.
 *
 * Two SST sharp edges, both learned the hard way:
 *
 * 1. This file's path must NOT contain the substring ".sst". SST's bundler
 *    injects the `aws`/`sst` import shim into every source file EXCEPT paths
 *    containing ".sst" (meant to exclude its platform directory) — a name
 *    like "selfhost.sst.config.ts" matches that check, gets no shim, and
 *    every `aws.*` reference throws "ReferenceError: aws is not defined" at
 *    deploy. The selfhost-smoke CI job guards this.
 *
 * 2. Do not import `sst` or `aws` here. The injected shim provides them;
 *    importing them from .sst/platform deadlocks `sst install`, which must
 *    build the config before that directory exists.
 */

export default $config({
  app(input) {
    return {
      name: "wraps-selfhost",
      removal: "remove",
      home: "aws",
      providers: {
        aws: {
          // Set by the selfhost deploy/upgrade scripts (persisted in
          // .env.selfhost). app() runs before run()'s dotenv load, so this
          // must arrive via the subprocess environment, not the env file.
          region: (process.env.SELFHOST_AWS_REGION ||
            "us-east-1") as aws.Region,
        },
      },
    };
  },
  async run() {
    const { config } = await import("dotenv");
    const { resolve } = await import("node:path");
    config({ path: resolve(process.cwd(), "..", ".env.selfhost") });

    const webDomain = process.env.SELFHOST_WEB_DOMAIN;

    // EventBridge Scheduler resources (must come before queues to avoid circular deps)
    const schedulerGroup = new aws.scheduler.ScheduleGroup(
      "SelfhostSchedulerGroup",
      {
        name: "wraps-selfhost-schedulers",
        tags: {
          ManagedBy: "sst",
          Service: "wraps-selfhost",
        },
      }
    );

    const schedulerRole = new aws.iam.Role("SelfhostSchedulerRole", {
      name: "wraps-selfhost-scheduler-role",
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
        Service: "wraps-selfhost",
      },
    });

    // Rate limit table
    const rateLimitTable = new sst.aws.Dynamo("SelfhostRateLimitTable", {
      fields: {
        pk: "string",
        sk: "string",
      },
      primaryIndex: {
        hashKey: "pk",
        rangeKey: "sk",
      },
      ttl: "expiresAt",
      transform: {
        table: {
          billingMode: "PAY_PER_REQUEST",
          tags: {
            ManagedBy: "sst",
            Service: "wraps-selfhost",
          },
        },
      },
    });

    // Batch DLQ
    const batchDlq = new sst.aws.Queue("SelfhostBatchDlq", {
      transform: {
        queue: {
          visibilityTimeoutSeconds: 70,
          messageRetentionSeconds: 1_209_600,
          tags: {
            ManagedBy: "sst",
            Service: "wraps-selfhost",
          },
        },
      },
    });

    // Batch queue
    const batchQueue = new sst.aws.Queue("SelfhostBatchQueue", {
      dlq: {
        queue: batchDlq.arn,
        retry: 3,
      },
      transform: {
        queue: {
          visibilityTimeoutSeconds: 300,
          messageRetentionSeconds: 1_209_600,
          tags: {
            ManagedBy: "sst",
            Service: "wraps-selfhost",
          },
        },
      },
    });

    // Workflow DLQ
    const workflowDlq = new sst.aws.Queue("SelfhostWorkflowDlq", {
      transform: {
        queue: {
          visibilityTimeoutSeconds: 70,
          messageRetentionSeconds: 1_209_600,
          tags: {
            ManagedBy: "sst",
            Service: "wraps-selfhost",
          },
        },
      },
    });

    // Workflow queue
    const workflowQueue = new sst.aws.Queue("SelfhostWorkflowQueue", {
      dlq: {
        queue: workflowDlq.arn,
        retry: 3,
      },
      transform: {
        queue: {
          visibilityTimeoutSeconds: 300,
          messageRetentionSeconds: 86_400,
          tags: {
            ManagedBy: "sst",
            Service: "wraps-selfhost",
          },
        },
      },
    });

    // Scheduler IAM policy — allow Scheduler to send to both queues
    new aws.iam.RolePolicy("SelfhostSchedulerSqsPolicy", {
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

    // API Lambda with function URL (no API Gateway — single-tenant, cost-free)
    const api = new sst.aws.Function("SelfhostApi", {
      handler: "../apps/api/src/lambda.handler",
      runtime: "nodejs24.x",
      timeout: "30 seconds",
      memory: "512 MB",
      url: true,
      environment: {
        NODE_ENV: "production",
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
        UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? "",
        LICENSE_KEY: process.env.LICENSE_KEY ?? "",
        BATCH_QUEUE_URL: batchQueue.url,
        BATCH_QUEUE_ARN: batchQueue.arn,
        WORKFLOW_QUEUE_URL: workflowQueue.url,
        WORKFLOW_QUEUE_ARN: workflowQueue.arn,
        RATE_LIMIT_TABLE_NAME: rateLimitTable.name,
        SCHEDULER_ROLE_ARN: schedulerRole.arn,
        SCHEDULER_GROUP_NAME: schedulerGroup.name,
        ...(process.env.AI_GATEWAY_API_KEY && {
          AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
        }),
        ...(process.env.ANTHROPIC_API_KEY && {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        }),
      },
      link: [rateLimitTable, batchQueue, workflowQueue],
      nodejs: {
        install: ["pg", "@sentry/profiling-node"],
      },
      permissions: [
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
        {
          actions: ["iam:PassRole"],
          resources: [schedulerRole.arn],
        },
        {
          actions: ["sts:AssumeRole"],
          resources: ["arn:aws:iam::*:role/wraps-*"],
        },
      ],
    });

    // Next.js web app via OpenNext
    const web = new sst.aws.Nextjs("SelfhostWeb", {
      path: "../apps/web",
      link: [api],
      server: {
        timeout: "120 seconds",
        memory: "1024 MB",
      },
      environment: {
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
        BETTER_AUTH_URL:
          process.env.BETTER_AUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          (webDomain ? `https://${webDomain}` : ""),
        WRAPS_EMAIL_ROLE_ARN: process.env.WRAPS_EMAIL_ROLE_ARN ?? "",
        AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM ?? "",
        AUTH_EMAIL_CONFIGURATION_SET:
          process.env.AUTH_EMAIL_CONFIGURATION_SET ?? "",
        UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? "",
        WRAPS_LICENSE_KEY: process.env.LICENSE_KEY ?? "",
        WRAPS_API_URL: api.url,
        NEXT_PUBLIC_API_URL: api.url,
        NEXT_PUBLIC_APP_URL:
          process.env.NEXT_PUBLIC_APP_URL ||
          (webDomain ? `https://${webDomain}` : ""),
        CORS_ORIGIN:
          process.env.NEXT_PUBLIC_APP_URL ||
          (webDomain ? `https://${webDomain}` : ""),
        AWS_BACKEND_ACCOUNT_ID: aws.getCallerIdentityOutput({}).accountId,
        ...(process.env.AI_GATEWAY_API_KEY && {
          AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
        }),
        ...(process.env.AI_MODEL && {
          AI_MODEL: process.env.AI_MODEL,
        }),
      },
      permissions: [
        {
          actions: ["sts:AssumeRole"],
          resources: ["arn:aws:iam::*:role/wraps-*"],
        },
      ],
      ...(webDomain && {
        domain: {
          name: webDomain,
          dns: sst.aws.dns(),
        },
      }),
    });

    // Queue subscribers — declared after api/web so api.url and web.url are
    // resolved SST outputs rather than env vars read at config-evaluation time.

    // Batch DLQ consumer
    batchDlq.subscribe(
      {
        handler: "../apps/api/src/workers/batch-dlq-consumer.handler",
        runtime: "nodejs24.x",
        timeout: "1 minute",
        memory: "256 MB",
        environment: {
          NODE_ENV: "production",
          DATABASE_URL: process.env.DATABASE_URL ?? "",
          BATCH_QUEUE_URL: batchQueue.url,
        },
        nodejs: {
          install: ["pg", "@sentry/profiling-node"],
        },
        permissions: [
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

    // Batch sender
    batchQueue.subscribe(
      {
        handler: "../apps/api/src/workers/batch-sender.handler",
        runtime: "nodejs24.x",
        timeout: "5 minutes",
        memory: "512 MB",
        environment: {
          NODE_ENV: "production",
          DATABASE_URL: process.env.DATABASE_URL ?? "",
          UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? "",
          BATCH_QUEUE_URL: batchQueue.url,
          API_BASE_URL: api.url,
          APP_BASE_URL: web.url,
        },
        nodejs: {
          install: ["pg", "@sentry/profiling-node"],
        },
        permissions: [
          {
            actions: ["sts:AssumeRole"],
            resources: ["arn:aws:iam::*:role/wraps-*"],
          },
          {
            actions: ["sqs:SendMessage"],
            resources: [batchQueue.arn],
          },
        ],
      },
      {
        batch: {
          size: 1,
        },
      }
    );

    // Workflow DLQ consumer
    workflowDlq.subscribe(
      {
        handler: "../apps/api/src/(ee)/workers/workflow-dlq-consumer.handler",
        runtime: "nodejs24.x",
        timeout: "1 minute",
        memory: "256 MB",
        environment: {
          NODE_ENV: "production",
          DATABASE_URL: process.env.DATABASE_URL ?? "",
        },
        nodejs: {
          install: ["pg", "@sentry/profiling-node"],
        },
      },
      {
        batch: {
          size: 10,
        },
      }
    );

    // Workflow processor
    workflowQueue.subscribe(
      {
        handler: "../apps/api/src/(ee)/workers/workflow-processor.handler",
        runtime: "nodejs24.x",
        timeout: "5 minutes",
        memory: "512 MB",
        environment: {
          NODE_ENV: "production",
          DATABASE_URL: process.env.DATABASE_URL ?? "",
          WORKFLOW_QUEUE_URL: workflowQueue.url,
          WORKFLOW_QUEUE_ARN: workflowQueue.arn,
          SCHEDULER_ROLE_ARN: schedulerRole.arn,
          SCHEDULER_GROUP_NAME: schedulerGroup.name,
          UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? "",
          API_BASE_URL: api.url,
          APP_BASE_URL: web.url,
        },
        nodejs: {
          install: ["pg", "@sentry/profiling-node"],
        },
        permissions: [
          {
            actions: ["sts:AssumeRole"],
            resources: ["arn:aws:iam::*:role/wraps-*"],
          },
          {
            actions: ["sqs:SendMessage"],
            resources: [workflowQueue.arn],
          },
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

    return {
      apiUrl: api.url,
      webUrl: web.url,
      batchQueueUrl: batchQueue.url,
      workflowQueueUrl: workflowQueue.url,
      rateLimitTableName: rateLimitTable.name,
      schedulerGroupName: schedulerGroup.name,
      schedulerRoleArn: schedulerRole.arn,
    };
  },
});
