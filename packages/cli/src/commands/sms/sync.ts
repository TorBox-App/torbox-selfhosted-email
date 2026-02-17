import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import {
  createSMSEventDestinationWithSDK,
  createSMSPhonePoolWithSDK,
  createSMSProtectConfigurationWithSDK,
  deploySMSStack,
} from "../../infrastructure/sms-stack.js";
import { trackCommand, trackError } from "../../telemetry/events.js";
import type { SMSStackConfig, SMSStackOutputs } from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
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

export type SMSSyncOptions = {
  region?: string;
  yes?: boolean;
};

/**
 * SMS Sync command - Update infrastructure without changing config
 * This is useful for:
 * - Updating Lambda code when CLI is upgraded
 * - Applying new features added in CLI updates
 * - Recreating SDK resources if they were accidentally deleted
 */
export async function smsSync(options: SMSSyncOptions): Promise<void> {
  const startTime = Date.now();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps SMS Infrastructure Sync"));
  }

  const progress = new DeploymentProgress();

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  const region = options.region || (await getAWSRegion());

  // 3. Load existing metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);
  const smsService = metadata?.services?.sms;

  if (!smsService?.config) {
    progress.stop();
    clack.log.error("No SMS infrastructure found to sync");
    console.log(
      `\nRun ${pc.cyan("wraps sms init")} to deploy SMS infrastructure first.\n`
    );
    process.exit(1);
  }

  const smsConfig = smsService.config;
  const storedStackName = smsService.pulumiStackName;

  progress.info("Found existing SMS configuration");
  progress.info(
    `Phone type: ${pc.cyan(smsConfig.phoneNumberType || "simulator")}`
  );
  progress.info(
    `Event tracking: ${pc.cyan(smsConfig.eventTracking?.enabled ? "enabled" : "disabled")}`
  );

  // 4. Confirm sync
  if (!options.yes) {
    const confirmed = await clack.confirm({
      message:
        "Sync SMS infrastructure? This will update Lambda code and recreate any missing resources.",
      initialValue: true,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Sync cancelled.");
      process.exit(0);
    }
  }

  // 5. Build stack configuration from saved metadata
  const stackConfig: SMSStackConfig = {
    provider: metadata?.provider || "aws",
    region,
    vercel: metadata?.vercel,
    smsConfig,
  };

  // 6. Run Pulumi up to sync infrastructure
  let outputs: SMSStackOutputs;

  try {
    outputs = await progress.execute("Syncing SMS infrastructure", async () => {
      await ensurePulumiWorkDir({ accountId: identity.accountId, region });

      const stackName =
        storedStackName || `wraps-sms-${identity.accountId}-${region}`;

      const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
        {
          stackName,
          projectName: "wraps-sms",
          program: async () => {
            const result = await deploySMSStack(stackConfig);
            return {
              roleArn: result.roleArn,
              phoneNumber: result.phoneNumber,
              phoneNumberArn: result.phoneNumberArn,
              configSetName: result.configSetName,
              tableName: result.tableName,
              region: result.region,
              lambdaFunctions: result.lambdaFunctions,
              snsTopicArn: result.snsTopicArn,
              queueUrl: result.queueUrl,
              dlqUrl: result.dlqUrl,
              optOutListArn: result.optOutListArn,
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

      await stack.setConfig("aws:region", { value: region });
      const upResult = await stack.up({ onOutput: () => {} });
      const pulumiOutputs = upResult.outputs;

      return {
        roleArn: pulumiOutputs.roleArn?.value as string,
        phoneNumber: pulumiOutputs.phoneNumber?.value as string | undefined,
        phoneNumberArn: pulumiOutputs.phoneNumberArn?.value as
          | string
          | undefined,
        configSetName: pulumiOutputs.configSetName?.value as string | undefined,
        tableName: pulumiOutputs.tableName?.value as string | undefined,
        region: pulumiOutputs.region?.value as string,
        lambdaFunctions: pulumiOutputs.lambdaFunctions?.value as
          | string[]
          | undefined,
        snsTopicArn: pulumiOutputs.snsTopicArn?.value as string | undefined,
        queueUrl: pulumiOutputs.queueUrl?.value as string | undefined,
        dlqUrl: pulumiOutputs.dlqUrl?.value as string | undefined,
        optOutListArn: pulumiOutputs.optOutListArn?.value as string | undefined,
      };
    });

    // 7a. Ensure phone pool exists
    if (outputs.phoneNumberArn) {
      await progress.execute("Ensuring phone pool exists", async () => {
        await createSMSPhonePoolWithSDK(outputs.phoneNumberArn!, region);
      });
    }

    // 7b. Ensure event destination exists (if event tracking enabled)
    if (
      smsConfig.eventTracking?.enabled &&
      outputs.configSetName &&
      outputs.snsTopicArn
    ) {
      await progress.execute("Ensuring event destination exists", async () => {
        await createSMSEventDestinationWithSDK(
          outputs.configSetName!,
          outputs.snsTopicArn!,
          region
        );
      });
    }

    // 7c. Ensure protect configuration exists (always create for fraud protection)
    // This ensures older deployments get protect config when syncing with newer CLI
    if (outputs.configSetName) {
      await progress.execute("Ensuring fraud protection exists", async () => {
        await createSMSProtectConfigurationWithSDK(
          outputs.configSetName!,
          region,
          {
            // Use saved config if available, otherwise default to US only without AIT filtering (no extra cost)
            allowedCountries: smsConfig.protectConfiguration
              ?.allowedCountries || ["US"],
            aitFiltering: smsConfig.protectConfiguration?.aitFiltering ?? false,
          }
        );
      });

      // Update metadata to include protect configuration if not present
      if (!smsConfig.protectConfiguration) {
        smsConfig.protectConfiguration = {
          enabled: true,
          allowedCountries: ["US"],
          aitFiltering: false,
        };
      }
    }
  } catch (error: unknown) {
    progress.stop();
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("stack is currently locked")) {
      trackError("STACK_LOCKED", "sms:sync", { step: "sync" });
      throw errors.stackLocked();
    }

    trackError("SYNC_FAILED", "sms:sync", { step: "sync" });
    clack.log.error(`SMS sync failed: ${errorMessage}`);
    process.exit(1);
  }

  // 8. Update metadata timestamp
  if (metadata && smsService) {
    smsService.deployedAt = new Date().toISOString();
    await saveConnectionMetadata(metadata);
  }

  progress.stop();

  if (isJsonMode()) {
    jsonSuccess("sms.sync", {
      synced: true,
      region,
    });
    trackCommand("sms:sync", {
      success: true,
      duration_ms: Date.now() - startTime,
    });
    return;
  }

  // 9. Display success
  console.log("\n");
  clack.log.success(pc.green("SMS infrastructure synced successfully!"));

  const changes: string[] = [];
  if (outputs.lambdaFunctions?.length) {
    changes.push("Lambda functions updated");
  }
  changes.push("SDK resources verified");

  console.log("");
  for (const change of changes) {
    console.log(`  ${pc.green("✓")} ${change}`);
  }

  trackCommand("sms:sync", {
    success: true,
    duration_ms: Date.now() - startTime,
  });

  clack.outro(pc.green("Sync complete!"));
}
