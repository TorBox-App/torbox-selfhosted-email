import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { deploySelfhostStack } from "../../infrastructure/selfhost-stack.js";
import { trackError } from "../../telemetry/events.js";
import type {
  SelfhostConfig,
  SelfhostDeployOptions,
  SelfhostStackOutputs,
} from "../../types/index.js";
import {
  buildNeonProjectName,
  provisionNeonProject,
} from "../../utils/selfhost/neon.js";
import { validateAWSCredentialsWithDetails } from "../../utils/shared/aws.js";
import { errors } from "../../utils/shared/errors.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import {
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import {
  ensurePulumiInstalled,
  withLockRetry,
} from "../../utils/shared/pulumi.js";
import {
  DEFAULT_PULUMI_TIMEOUT_MS,
  withTimeout,
} from "../../utils/shared/timeout.js";

// Resolve paths relative to this file — works for both the source repo
// (packages/cli/dist/cli.js) and the installed standalone CLI (~/.wraps/lib/cli.js).
const __filename = fileURLToPath(import.meta.url);
const cliDir = dirname(__filename);
const bundledLambdaZip = join(cliDir, "api-lambda.zip");
const bundledMigrationsDir = join(cliDir, "selfhost-migrations");

/**
 * Self-hosted deploy command — deploys the Wraps API Lambda into the
 * customer's AWS account so they can self-host the Wraps platform.
 */
export async function selfhostDeploy(
  options: SelfhostDeployOptions
): Promise<void> {
  const startTime = Date.now();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Self-Hosted Control Plane Deploy"));
  }

  const progress = new DeploymentProgress();

  // 1. Ensure Pulumi CLI is installed
  const wasAutoInstalled = await progress.execute(
    "Checking Pulumi CLI installation",
    async () => await ensurePulumiInstalled()
  );

  if (wasAutoInstalled) {
    progress.info("Pulumi CLI was automatically installed");
  }

  // 2. Validate AWS credentials
  const credentialResult = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentialsWithDetails()
  );

  const identity = credentialResult.identity;
  progress.info(`Connected to AWS account: ${pc.cyan(identity.accountId)}`);

  for (const warning of credentialResult.warnings) {
    clack.log.warn(warning);
  }

  if (credentialResult.credentialSource) {
    progress.info(
      `Using credentials from: ${pc.dim(credentialResult.credentialSource)}`
    );
  }

  // 3. Get region
  let region = options.region;
  if (!region) {
    const regionAnswer = await clack.text({
      message: "AWS region to deploy into:",
      defaultValue: "us-east-1",
      placeholder: "us-east-1",
    });
    if (clack.isCancel(regionAnswer)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }
    region = (regionAnswer as string) || "us-east-1";
  }

  // 4. Check if already deployed
  const existingMetadata = await loadConnectionMetadata(
    identity.accountId,
    region
  );
  if (existingMetadata?.services?.selfhost) {
    clack.log.warn(
      `Self-hosted deployment already exists for account ${pc.cyan(identity.accountId)} in region ${pc.cyan(region)}`
    );
    clack.log.info(
      `API URL: ${pc.cyan(existingMetadata.services.selfhost.apiUrl)}`
    );
    clack.log.info(
      `Deployed: ${existingMetadata.services.selfhost.deployedAt}`
    );
    clack.log.info(`To update: run ${pc.cyan("wraps selfhost upgrade")}`);
    process.exit(0);
  }

  // 5. Resolve database connection — either a user-supplied URL or a new Neon project
  let resolvedDatabaseUrl = options.databaseUrl;
  let resolvedNeonProjectId: string | undefined;
  let neonApiKey: string | undefined;
  let neonOrgId: string | undefined;

  if (!resolvedDatabaseUrl) {
    neonApiKey = options.neonApiKey;
    neonOrgId = options.neonOrgId;

    if (!neonApiKey) {
      // Neither --database-url nor --neon-api-key supplied — ask interactively
      const dbChoice = await clack.select({
        message: "How do you want to connect the database?",
        options: [
          {
            value: "url",
            label: "Enter a connection string",
            hint: "Neon, Supabase, Railway, self-hosted Postgres...",
          },
          {
            value: "neon",
            label: "Provision a new Neon database",
            hint: "Requires a Neon API key",
          },
        ],
      });
      if (clack.isCancel(dbChoice)) {
        clack.cancel("Operation cancelled.");
        process.exit(0);
      }

      if (dbChoice === "url") {
        const dbUrlAnswer = await clack.text({
          message: "Postgres connection string:",
          placeholder: "postgres://user:pass@host:5432/dbname",
          validate: (v) => {
            if (!v.trim()) return "Connection string cannot be empty";
            if (!v.startsWith("postgres://") && !v.startsWith("postgresql://"))
              return "Must be a valid postgres:// or postgresql:// connection string";
          },
        });
        if (clack.isCancel(dbUrlAnswer)) {
          clack.cancel("Operation cancelled.");
          process.exit(0);
        }
        resolvedDatabaseUrl = dbUrlAnswer as string;
      } else {
        const neonApiKeyAnswer = await clack.password({
          message:
            "Neon API key (create one at console.neon.tech/app/settings/api-keys):",
        });
        if (clack.isCancel(neonApiKeyAnswer)) {
          clack.cancel("Operation cancelled.");
          process.exit(0);
        }
        neonApiKey = neonApiKeyAnswer as string;

        if (!neonOrgId) {
          const neonOrgIdAnswer = await clack.text({
            message:
              "Neon organization ID (find at console.neon.tech/app/settings — leave blank for personal account):",
            placeholder: "org-...",
          });
          if (clack.isCancel(neonOrgIdAnswer)) {
            clack.cancel("Operation cancelled.");
            process.exit(0);
          }
          const trimmed = (neonOrgIdAnswer as string).trim();
          if (trimmed) neonOrgId = trimmed;
        }
      }
    }
  }

  // 6. Prompt for license key
  let licenseKey = options.licenseKey;
  if (!licenseKey) {
    const licenseKeyAnswer = await clack.text({
      message: "Wraps enterprise license key:",
      placeholder: "wraps_lic_...",
    });
    if (clack.isCancel(licenseKeyAnswer)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }
    licenseKey = licenseKeyAnswer as string;
  }

  // 7. Prompt for app URL
  let appUrl = options.appUrl;
  if (!appUrl) {
    const appUrlAnswer = await clack.text({
      message: "App URL (where your self-hosted dashboard will be served):",
      defaultValue: "https://app.wraps.dev",
      placeholder: "https://app.yourcompany.com",
    });
    if (clack.isCancel(appUrlAnswer)) {
      clack.cancel("Operation cancelled.");
      process.exit(0);
    }
    appUrl = (appUrlAnswer as string) || "https://app.wraps.dev";
  }

  // 8. Confirm deployment (skip if --yes or --preview)
  if (!(options.yes || options.preview)) {
    const confirmed = await clack.confirm({
      message: `Deploy self-hosted Wraps API to ${pc.cyan(identity.accountId)} / ${pc.cyan(region)}?`,
      initialValue: true,
    });
    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Deployment cancelled.");
      process.exit(0);
    }
  }

  // 9. Verify bundled Lambda zip (pre-built at CLI build time)
  if (!existsSync(bundledLambdaZip)) {
    throw new Error(
      `Bundled API lambda not found at ${bundledLambdaZip}. ` +
        "Run 'pnpm build' in the CLI package to generate it."
    );
  }
  const lambdaZipPath = bundledLambdaZip;

  // 11. Provision Neon database (skipped when --database-url is provided)
  if (!resolvedDatabaseUrl) {
    const neonProject = await progress.execute(
      "Provisioning Neon PostgreSQL database",
      async () =>
        provisionNeonProject(
          neonApiKey as string,
          buildNeonProjectName(identity.accountId, region as string),
          { orgId: neonOrgId }
        )
    );
    progress.info(`Neon project created: ${pc.cyan(neonProject.name)}`);
    resolvedDatabaseUrl = neonProject.connectionString;
    resolvedNeonProjectId = neonProject.id;
  }

  if (!resolvedDatabaseUrl) {
    throw new Error(
      "[bug] resolvedDatabaseUrl was not set after DB resolution"
    );
  }
  const databaseUrl = resolvedDatabaseUrl;

  // Save critical state immediately after database resolution, before Pulumi.
  // If Pulumi fails partway through, re-running deploy will find this record
  // and avoid creating a second orphaned Neon project.
  const unsubscribeSecret = randomBytes(32).toString("hex");
  const betterAuthSecret = randomBytes(32).toString("hex");

  const selfhostConfig: SelfhostConfig = {
    neonProjectId: resolvedNeonProjectId,
    databaseUrl,
    licenseKey: licenseKey as string,
    appUrl: appUrl as string,
    unsubscribeSecret,
    betterAuthSecret,
  };

  const stackName = `wraps-selfhost-${identity.accountId}-${region}`;
  const deployedAt = new Date().toISOString();

  const savedMetadata = existingMetadata ?? {
    version: "1.0.0",
    accountId: identity.accountId,
    region: region as string,
    provider: "other" as const,
    timestamp: deployedAt,
    services: {},
  };
  savedMetadata.services.selfhost = {
    deployedAt,
    pulumiStackName: stackName,
    config: selfhostConfig,
    apiUrl: "", // Updated with real URL after Pulumi succeeds
  };
  savedMetadata.timestamp = deployedAt;
  await saveConnectionMetadata(savedMetadata); // baseline:allow-early-save — Neon orphan prevention

  // 12. Run database migrations using bundled SQL files + Neon HTTP driver
  await progress.execute("Running database migrations", async () => {
    const { neonConfig, Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");

    neonConfig.poolQueryViaFetch = true;
    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: bundledMigrationsDir });
    await pool.end();
  });

  const createStack = async () => {
    await ensurePulumiWorkDir({
      accountId: identity.accountId,
      region: region as string,
    });
    const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
      {
        stackName,
        projectName: "wraps-selfhost",
        program: async () => {
          const result = await deploySelfhostStack({
            accountId: identity.accountId,
            region: region as string,
            lambdaZipPath,
            databaseUrl,
            licenseKey: licenseKey as string,
            appUrl: appUrl as string,
            unsubscribeSecret,
            betterAuthSecret,
          });
          return {
            apiUrl: result.apiUrl,
            lambdaArn: result.lambdaArn,
            lambdaRoleArn: result.lambdaRoleArn,
            rateLimitTableName: result.rateLimitTableName,
            batchQueueUrl: result.batchQueueUrl,
            batchQueueArn: result.batchQueueArn,
            workflowQueueUrl: result.workflowQueueUrl,
            workflowQueueArn: result.workflowQueueArn,
            schedulerRoleArn: result.schedulerRoleArn,
            schedulerGroupName: result.schedulerGroupName,
          };
        },
      },
      {
        workDir: getPulumiWorkDir(),
        envVars: {
          PULUMI_CONFIG_PASSPHRASE: "",
          AWS_REGION: region as string,
        },
        secretsProvider: "passphrase",
      }
    );
    await stack.workspace.selectStack(stackName);
    await stack.setConfig("aws:region", { value: region as string });
    return stack;
  };

  // 14. Preview mode
  if (options.preview) {
    const { previewWithResourceChanges } = await import(
      "../../utils/shared/pulumi.js"
    );
    const { displayPreview } = await import("../../utils/shared/output.js");

    try {
      const previewResult = await progress.execute(
        "Generating infrastructure preview",
        async () => {
          const stack = await createStack();
          return previewWithResourceChanges(stack, { diff: true });
        }
      );

      displayPreview({
        changeSummary: previewResult.changeSummary,
        resourceChanges: previewResult.resourceChanges,
        commandName: "wraps selfhost deploy",
      });

      clack.outro(
        pc.green("Preview complete. Run without --preview to deploy.")
      );
      return;
    } catch (error) {
      trackError("PREVIEW_FAILED", "selfhost:deploy", { step: "preview" });
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Preview failed: ${msg}`);
    }
  }

  // 15. Deploy infrastructure
  let outputs: SelfhostStackOutputs;
  try {
    outputs = await progress.execute(
      "Deploying infrastructure (this may take 2-3 minutes)",
      async () => {
        const stack = await createStack();

        const upResult = await withLockRetry(
          () =>
            withTimeout(
              stack.up({ onOutput: () => {} }),
              DEFAULT_PULUMI_TIMEOUT_MS,
              "Pulumi deployment"
            ),
          {
            accountId: identity.accountId,
            region: region as string,
            autoConfirm: options.yes,
          }
        );

        const pulumiOutputs = upResult.outputs;
        return {
          apiUrl: pulumiOutputs.apiUrl?.value as string,
          lambdaArn: pulumiOutputs.lambdaArn?.value as string,
          lambdaRoleArn: pulumiOutputs.lambdaRoleArn?.value as string,
          rateLimitTableName: pulumiOutputs.rateLimitTableName?.value as string,
          batchQueueUrl: pulumiOutputs.batchQueueUrl?.value as string,
          batchQueueArn: pulumiOutputs.batchQueueArn?.value as string,
          workflowQueueUrl: pulumiOutputs.workflowQueueUrl?.value as string,
          workflowQueueArn: pulumiOutputs.workflowQueueArn?.value as string,
          schedulerRoleArn: pulumiOutputs.schedulerRoleArn?.value as string,
          schedulerGroupName: pulumiOutputs.schedulerGroupName?.value as string,
        };
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    trackError("DEPLOYMENT_FAILED", "selfhost:deploy", { step: "deploy" });

    if (msg.includes("stack is currently locked")) {
      throw errors.stackLocked();
    }
    throw new Error(`Self-hosted deployment failed: ${msg}`);
  }

  // 16. Update metadata with the real API URL from Pulumi outputs
  savedMetadata.services.selfhost!.apiUrl = outputs.apiUrl;
  savedMetadata.timestamp = new Date().toISOString();
  await saveConnectionMetadata(savedMetadata);
  progress.info("Deployment metadata saved");

  if (isJsonMode()) {
    jsonSuccess("selfhost.deploy", {
      apiUrl: outputs.apiUrl,
      lambdaArn: outputs.lambdaArn,
      region: region as string,
      deployedAt,
    });
    return;
  }

  // 17. Display success
  console.log("\n");
  clack.log.success(pc.green(pc.bold("Self-hosted Wraps API deployed!")));
  console.log("\n");

  clack.note(
    [
      `${pc.bold("API URL:")} ${pc.cyan(outputs.apiUrl)}`,
      `${pc.bold("Region:")} ${pc.cyan(region as string)}`,
      `${pc.bold("Lambda ARN:")} ${pc.dim(outputs.lambdaArn)}`,
      ...(resolvedNeonProjectId
        ? [`${pc.bold("Neon Project:")} ${pc.dim(resolvedNeonProjectId)}`]
        : []),
      "",
      pc.dim("Next steps:"),
      pc.dim(`  Set WRAPS_API_URL=${outputs.apiUrl} in your app`),
      pc.dim("  Run: wraps selfhost status"),
    ].join("\n"),
    "Self-Hosted Deployment"
  );

  clack.outro(
    pc.green(`Deployed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
  );
}
