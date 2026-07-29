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
        // Declared here rather than in run() for the same reason as region:
        // app() is evaluated before the dotenv load, and `sst install` (which
        // runs before deploy) needs the provider present to fetch it. The
        // deploy script puts both vars in the subprocess environment.
        ...(process.env.SELFHOST_DNS_PROVIDER === "cloudflare" && {
          cloudflare: {
            apiToken: process.env.CLOUDFLARE_API_TOKEN,
          },
        }),
      },
    };
  },
  async run() {
    const { config } = await import("dotenv");
    const { resolve } = await import("node:path");
    // override: the customer's .env.selfhost is the authority for THEIR stack.
    // Without it, a maintainer who also works on the platform and has
    // NEXT_PUBLIC_APP_URL / DATABASE_URL exported in their shell silently bakes
    // wraps.dev values into the customer's deployment — these vars became
    // load-bearing for the API's email links and .well-known issuer. The repo
    // has precedent for exactly this (WRAPS_LICENSE_KEY poisoning test runs).
    const envFile = config({
      path: resolve(process.cwd(), "..", ".env.selfhost"),
      override: true,
    });

    const webDomain = process.env.SELFHOST_WEB_DOMAIN;

    // Which DNS provider owns webDomain. This used to be hardcoded to
    // sst.aws.dns(), which does a Route 53 hosted-zone lookup for both the ACM
    // validation record and the CloudFront alias — so every customer whose
    // domain lives anywhere else failed the deploy with "could not find hosted
    // zone", after the cert had already been created.
    const dnsProvider = process.env.SELFHOST_DNS_PROVIDER || "route53";

    /**
     * The `domain` argument for the Nextjs component, or {} when no custom
     * domain is configured (the deployment then serves on its CloudFront URL).
     */
    const webDomainConfig = (() => {
      if (!webDomain) {
        return {};
      }
      if (dnsProvider === "cloudflare") {
        return {
          domain: {
            name: webDomain,
            // zone is optional — omitting it makes SST look the zone up from
            // the domain. We pass it when the deploy script already resolved
            // it, which also covers subdomains of a zone (mail.example.com
            // living in the example.com zone).
            dns: sst.cloudflare.dns({
              zone: process.env.SELFHOST_CLOUDFLARE_ZONE_ID,
            }),
          },
        };
      }
      if (dnsProvider === "none") {
        // Unsupported DNS provider: the operator validated the cert and adds
        // the CloudFront alias record by hand. SST touches no DNS at all.
        const cert = process.env.SELFHOST_ACM_CERT_ARN;
        if (!cert) {
          throw new Error(
            "SELFHOST_DNS_PROVIDER=none requires SELFHOST_ACM_CERT_ARN (an ISSUED certificate in us-east-1, which is the only region CloudFront accepts)."
          );
        }
        return { domain: { name: webDomain, dns: false, cert } };
      }
      if (dnsProvider !== "route53") {
        throw new Error(
          `Unknown SELFHOST_DNS_PROVIDER "${dnsProvider}". Expected route53, cloudflare, or none.`
        );
      }
      return { domain: { name: webDomain, dns: sst.aws.dns() } };
    })();

    // Optional: point this deployment's error reporting at the operator's OWN
    // Sentry project. Unset means the SDK initializes without a DSN and no-ops,
    // which is the status quo — a self-hosted stack reports errors nowhere.
    //
    // Read from the env FILE, not process.env: `override: true` only overrides
    // keys the file actually contains, so a maintainer who runs a customer
    // deploy from this repo with Wraps' own SENTRY_DSN exported would otherwise
    // bake it in and silently stream that customer's errors to us.
    const sentryDsn = envFile.parsed?.SENTRY_DSN;

    // Database env, shared by every function below. Each is its own Lambda with
    // its own pg pool, so the per-process connection cap is multiplied by
    // containers AND by functions against the customer's Postgres — which is
    // how a self-hosted stack exhausts its connection slots under ordinary
    // load. The cap itself defaults in packages/db; forwarded here only so an
    // operator who has measured a reason can raise it in .env.selfhost.
    const dbEnv = {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      ...(process.env.DATABASE_POOL_MAX && {
        DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      }),
    };

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
        ...dbEnv,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
        UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? "",
        // The API reads WRAPS_LICENSE_KEY (apps/api/src/(ee)/lib/license.ts).
        // The .env.selfhost key stays LICENSE_KEY — scripts/selfhost/deploy.ts
        // writes it under that name and upgrade.ts reads it back. Only the
        // injected Lambda variable is renamed. Injecting it as LICENSE_KEY left
        // isSelfHosted() false on every self-hosted API request, so rate limits,
        // plan gates and the monthly event cap were all still enforced on a
        // licensed deployment.
        WRAPS_LICENSE_KEY: process.env.LICENSE_KEY ?? "",
        // The API builds links into emails and advertises OAuth endpoints, so
        // it needs the deployment's own URLs. It cannot read `api.url`/`web.url`
        // (both are being defined here), so it reads what the first deploy pass
        // backfilled into .env.selfhost — the same source the web app uses.
        NEXT_PUBLIC_APP_URL:
          process.env.NEXT_PUBLIC_APP_URL ||
          (webDomain ? `https://${webDomain}` : ""),
        BETTER_AUTH_URL:
          process.env.BETTER_AUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          (webDomain ? `https://${webDomain}` : ""),
        WRAPS_API_URL: process.env.WRAPS_API_URL ?? "",
        BATCH_QUEUE_URL: batchQueue.url,
        BATCH_QUEUE_ARN: batchQueue.arn,
        WORKFLOW_QUEUE_URL: workflowQueue.url,
        WORKFLOW_QUEUE_ARN: workflowQueue.arn,
        RATE_LIMIT_TABLE_NAME: rateLimitTable.name,
        SCHEDULER_ROLE_ARN: schedulerRole.arn,
        SCHEDULER_GROUP_NAME: schedulerGroup.name,
        // Self-hosted assumes its OWN console role; sharing the platform's
        // would mean overwriting its single-principal trust policy.
        // Literal, not an import: infra/ has no node_modules, so importing
        // @wraps/core here breaks the SST esbuild bundle at deploy time.
        // Pinned to SELFHOST_CONSOLE_ACCESS_ROLE_NAME by
        // scripts/selfhost/__tests__/selfhost-config-role-name.test.ts
        WRAPS_CONSOLE_ROLE_NAME: "wraps-selfhost-console-access-role",
        // No AI provider config here on purpose: all inference lives in the
        // three apps/web routes, so the keys go on SelfhostWeb below. This
        // lambda carried them for a generator that never existed.
        ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
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
        ...dbEnv,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
        BETTER_AUTH_URL:
          process.env.BETTER_AUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          (webDomain ? `https://${webDomain}` : ""),
        // WRAPS_EMAIL_ROLE_ARN is deliberately NOT set here. getWrapsClient()
        // (packages/email/src/lib/client.ts) treats a present role ARN as
        // "assume it", and on Lambda that is a literal sts:AssumeRole from this
        // function's execution role. wraps-email-role is created by the email
        // stack with a Service-only trust policy (shared/iam.ts, provider
        // "aws"), which does not admit a role principal — so every auth email
        // failed with AccessDenied. The hop exists for Vercel's cross-account
        // OIDC; self-hosted already runs inside the account that owns SES, so
        // it sends with its own credentials via the ses:SendEmail grant below.
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
        // The three AI routes live in apps/web, so the inference provider is
        // configured on this function and not on the API lambda.
        ...(process.env.WRAPS_AI_PROVIDER && {
          WRAPS_AI_PROVIDER: process.env.WRAPS_AI_PROVIDER,
        }),
        ...(process.env.OPENAI_API_KEY && {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        }),
        ...(process.env.OPENAI_BASE_URL && {
          OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
        }),
        ...(process.env.ANTHROPIC_API_KEY && {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        }),
        ...(process.env.ANTHROPIC_BASE_URL && {
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
        }),
        // Bedrock is self-hosted-only, so this deployment always qualifies.
        // The value is still passed explicitly rather than defaulted inside
        // @wraps/ai, so Wraps Cloud can never accidentally satisfy the gate.
        WRAPS_DEPLOYMENT_MODE: "self-hosted",
        ...(process.env.WRAPS_AI_REGION && {
          WRAPS_AI_REGION: process.env.WRAPS_AI_REGION,
        }),
        // Two vars, one input: the server SDK reads SENTRY_DSN, the browser SDK
        // reads the NEXT_PUBLIC_ copy that Next inlines at build time. A DSN is
        // write-only and ships in the client bundle by design, so mirroring it
        // leaks nothing.
        ...(sentryDsn && {
          SENTRY_DSN: sentryDsn,
          NEXT_PUBLIC_SENTRY_DSN: sentryDsn,
        }),
      },
      permissions: [
        {
          // Still needed: the dashboard assumes wraps-selfhost-console-access-role
          // to read SES account state. That role DOES trust an account principal.
          actions: ["sts:AssumeRole"],
          resources: ["arn:aws:iam::*:role/wraps-*"],
        },
        {
          // Bedrock inference for the template and workflow AI, when
          // WRAPS_AI_PROVIDER=bedrock. Granted on this function and not the API
          // lambda because all three AI routes live in apps/web.
          //
          // Unscoped: the model id is chosen at runtime via AI_MODEL, and
          // cross-region inference profiles resolve to foundation-model ARNs in
          // several regions at once, so the set is not knowable at config time.
          //
          // IAM alone is not sufficient — each Anthropic model must also be
          // enabled per-account per-region in the Bedrock console, or calls
          // fail with AccessDeniedException.
          actions: [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
          ],
          resources: ["*"],
        },
        {
          // Auth email (verification, password reset, invitations) sends with
          // this function's own credentials — see the WRAPS_EMAIL_ROLE_ARN note
          // above. Unscoped because the send names both an identity and a
          // configuration set, and their ARNs are not known at config time.
          //
          // SendTemplatedEmail is the load-bearing one: better-auth's
          // sendVerificationEmail goes through WrapsEmail.sendTemplate(), so a
          // grant of SendEmail alone still fails closed with AccessDenied.
          actions: [
            "ses:SendEmail",
            "ses:SendRawEmail",
            "ses:SendTemplatedEmail",
            "ses:SendBulkTemplatedEmail",
          ],
          resources: ["*"],
        },
      ],
      ...webDomainConfig,
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
          ...dbEnv,
          BATCH_QUEUE_URL: batchQueue.url,
          // Same DSN as the API and dashboard — the workers swallow their own
          // failures by design, so this is where those surface.
          ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
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
          ...dbEnv,
          UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? "",
          BATCH_QUEUE_URL: batchQueue.url,
          API_BASE_URL: api.url,
          APP_BASE_URL: web.url,
          ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
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
          ...dbEnv,
          ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
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
          ...dbEnv,
          WORKFLOW_QUEUE_URL: workflowQueue.url,
          WORKFLOW_QUEUE_ARN: workflowQueue.arn,
          SCHEDULER_ROLE_ARN: schedulerRole.arn,
          SCHEDULER_GROUP_NAME: schedulerGroup.name,
          UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? "",
          API_BASE_URL: api.url,
          APP_BASE_URL: web.url,
          ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
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
