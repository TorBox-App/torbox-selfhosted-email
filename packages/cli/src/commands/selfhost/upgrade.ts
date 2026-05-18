import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { deploySelfhostStack } from "../../infrastructure/selfhost-stack.js";
import { trackError } from "../../telemetry/events.js";
import type {
  SelfhostStackOutputs,
  SelfhostUpgradeOptions,
} from "../../types/index.js";
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
import { resolveRegionForCommand } from "../../utils/shared/region-resolver.js";
import {
  DEFAULT_PULUMI_TIMEOUT_MS,
  withTimeout,
} from "../../utils/shared/timeout.js";

// After tsup bundles to dist/cli.js, import.meta.url resolves to packages/cli/dist/cli.js.
// 4 levels up from that file reaches the repo root.
const __filename = fileURLToPath(import.meta.url);
const repoRoot = join(__filename, "../../../..");

/**
 * Self-hosted upgrade command — rebuilds the API Lambda and re-runs Pulumi
 * to apply any infrastructure changes to an existing self-hosted deployment.
 */
export async function selfhostUpgrade(
  options: SelfhostUpgradeOptions
): Promise<void> {
  const startTime = Date.now();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Self-Hosted Control Plane Upgrade"));
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

  // 3. Resolve region
  const region = await resolveRegionForCommand({
    accountId: identity.accountId,
    optionRegion: options.region,
    service: "selfhost",
    label: "self-hosted deployment",
  });

  // 4. Load existing metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.selfhost) {
    clack.log.error("No self-hosted deployment found.");
    clack.log.info(`Run ${pc.cyan("wraps selfhost deploy")} first.`);
    process.exit(1);
  }

  const selfhostService = metadata.services.selfhost;
  progress.info(`Found deployment from: ${selfhostService.deployedAt}`);
  progress.info(`API URL: ${pc.cyan(selfhostService.apiUrl)}`);

  // 5. Confirm upgrade (skip if --yes or --preview)
  if (!(options.yes || options.preview)) {
    const confirmed = await clack.confirm({
      message: `Upgrade self-hosted deployment in ${pc.cyan(identity.accountId)} / ${pc.cyan(region)}?`,
      initialValue: true,
    });
    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Upgrade cancelled.");
      process.exit(0);
    }
  }

  const config = selfhostService.config;
  const stackName =
    selfhostService.pulumiStackName ||
    `wraps-selfhost-${identity.accountId}-${region}`;

  // 6. Rebuild the API
  const childStdio = isJsonMode() ? "pipe" : "inherit";
  await progress.execute("Building Wraps API", async () => {
    execSync("pnpm --filter @wraps/api build", {
      stdio: childStdio,
      cwd: repoRoot,
    });
  });

  // 7. Repackage Lambda: zip the self-contained bun bundle (no npm install needed)
  const lambdaZipPath = join(repoRoot, "apps/api/lambda.zip");
  await progress.execute("Packaging Lambda", async () => {
    execSync("/bin/sh -c 'zip -r ../lambda.zip .'", {
      cwd: join(repoRoot, "apps/api/dist"),
      stdio: childStdio,
    });
  });

  const createStack = async () => {
    await ensurePulumiWorkDir({ accountId: identity.accountId, region });
    const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
      {
        stackName,
        projectName: "wraps-selfhost",
        program: async () => {
          const result = await deploySelfhostStack({
            accountId: identity.accountId,
            region,
            lambdaZipPath,
            databaseUrl: config.databaseUrl,
            licenseKey: config.licenseKey,
            appUrl: config.appUrl,
            unsubscribeSecret: config.unsubscribeSecret,
            betterAuthSecret: config.betterAuthSecret,
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
          AWS_REGION: region,
        },
        secretsProvider: "passphrase",
      }
    );
    await stack.workspace.selectStack(stackName);
    await stack.setConfig("aws:region", { value: region });
    return stack;
  };

  // 8. Preview mode
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
          await stack.refresh({ onOutput: () => {} });
          return previewWithResourceChanges(stack, { diff: true });
        }
      );

      displayPreview({
        changeSummary: previewResult.changeSummary,
        resourceChanges: previewResult.resourceChanges,
        commandName: "wraps selfhost upgrade",
      });

      clack.outro(
        pc.green("Preview complete. Run without --preview to upgrade.")
      );
      return;
    } catch (error) {
      trackError("PREVIEW_FAILED", "selfhost:upgrade", { step: "preview" });
      throw error;
    }
  }

  // 9. Run Pulumi up
  let outputs: SelfhostStackOutputs;
  try {
    outputs = await progress.execute(
      "Upgrading infrastructure (this may take 2-3 minutes)",
      async () => {
        const stack = await createStack();

        // Refresh state to sync with AWS before upgrading
        await stack.refresh({ onOutput: () => {} });

        const upResult = await withLockRetry(
          () =>
            withTimeout(
              stack.up({ onOutput: () => {} }),
              DEFAULT_PULUMI_TIMEOUT_MS,
              "Pulumi deployment"
            ),
          {
            accountId: identity.accountId,
            region,
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
    trackError("UPGRADE_FAILED", "selfhost:upgrade", { step: "deploy" });

    if (msg.includes("stack is currently locked")) {
      throw errors.stackLocked();
    }
    throw new Error(`Self-hosted upgrade failed: ${msg}`);
  }

  // 10. Update metadata
  const upgradedAt = new Date().toISOString();
  metadata.services.selfhost = {
    ...selfhostService,
    deployedAt: upgradedAt,
    apiUrl: outputs.apiUrl || selfhostService.apiUrl,
  };
  metadata.timestamp = upgradedAt;
  await saveConnectionMetadata(metadata);

  if (isJsonMode()) {
    jsonSuccess("selfhost.upgrade", {
      apiUrl: outputs.apiUrl,
      lambdaArn: outputs.lambdaArn,
      region,
      upgradedAt,
    });
    return;
  }

  progress.info("Deployment metadata updated");

  console.log("\n");
  clack.log.success(pc.green(pc.bold("Self-hosted Wraps API upgraded!")));
  console.log("\n");

  clack.note(
    [
      `${pc.bold("API URL:")} ${pc.cyan(outputs.apiUrl || selfhostService.apiUrl)}`,
      `${pc.bold("Region:")} ${pc.cyan(region)}`,
      `${pc.bold("Lambda ARN:")} ${pc.dim(outputs.lambdaArn)}`,
    ].join("\n"),
    "Self-Hosted Deployment"
  );

  clack.outro(
    pc.green(`Upgraded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
  );
}
