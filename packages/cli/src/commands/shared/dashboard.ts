import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import getPort from "get-port";
import open from "open";
import pc from "picocolors";
import { startConsoleServer } from "../../console/server.js";
import { trackCommand } from "../../telemetry/events.js";
import type { DashboardOptions } from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Dashboard command - Start local web dashboard
 */
export async function dashboard(options: DashboardOptions): Promise<void> {
  clack.intro(pc.bold("Wraps Dashboard"));

  const progress = new DeploymentProgress();

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Validating AWS credentials",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  const region = await getAWSRegion();

  // 3. Load stack outputs to get configuration
  let emailStackOutputs: any = {};
  let smsStackOutputs: any = {};

  try {
    // Ensure Pulumi workspace is configured (sets backend URL)
    await ensurePulumiWorkDir();

    // Try to load email stack
    try {
      const emailStack = await pulumi.automation.LocalWorkspace.selectStack({
        stackName: `wraps-${identity.accountId}-${region}`,
        workDir: getPulumiWorkDir(),
      });
      emailStackOutputs = await emailStack.outputs();
    } catch (_emailError: unknown) {
      // Email stack not found, continue
    }

    // Try to load SMS stack
    try {
      const smsStack = await pulumi.automation.LocalWorkspace.selectStack({
        stackName: `wraps-sms-${identity.accountId}-${region}`,
        workDir: getPulumiWorkDir(),
      });
      smsStackOutputs = await smsStack.outputs();
    } catch (_smsError: unknown) {
      // SMS stack not found, continue
    }

    // If neither stack found, show error
    if (
      Object.keys(emailStackOutputs).length === 0 &&
      Object.keys(smsStackOutputs).length === 0
    ) {
      throw new Error("No infrastructure found");
    }
  } catch (_error: unknown) {
    progress.stop();
    clack.log.error("No Wraps infrastructure found");
    console.log(
      `\\nRun ${pc.cyan("wraps email init")} or ${pc.cyan("wraps sms init")} to deploy infrastructure first.\\n`
    );
    process.exit(1);
  }

  // Extract email outputs
  const tableName = emailStackOutputs.tableName?.value;
  const archiveArn = emailStackOutputs.archiveArn?.value;
  const archivingEnabled = emailStackOutputs.archivingEnabled?.value ?? false;

  // Extract SMS outputs
  const smsTableName = smsStackOutputs.tableName?.value;
  const smsPhoneNumber = smsStackOutputs.phoneNumber?.value;
  const smsPhoneNumberArn = smsStackOutputs.phoneNumberArn?.value;
  const smsPhoneNumberType = smsStackOutputs.phoneNumberType?.value;
  const smsConfigSetName = smsStackOutputs.configSetName?.value;

  // Load SMS config from metadata for protect configuration and event tracking
  let smsProtectEnabled = false;
  let smsAllowedCountries: string[] | undefined;
  let smsAitFiltering: boolean | undefined;
  let smsArchiveRetention: string | undefined;

  try {
    const metadata = await loadConnectionMetadata(identity.accountId, region);
    if (metadata?.services?.sms?.config) {
      const smsConfig = metadata.services.sms.config;
      if (smsConfig.protectConfiguration) {
        smsProtectEnabled = smsConfig.protectConfiguration.enabled ?? false;
        smsAllowedCountries = smsConfig.protectConfiguration.allowedCountries;
        smsAitFiltering = smsConfig.protectConfiguration.aitFiltering;
      }
      if (smsConfig.eventTracking?.archiveRetention) {
        smsArchiveRetention = smsConfig.eventTracking.archiveRetention;
      }
    }
  } catch {
    // Metadata load failed, continue with defaults
  }

  // 4. Find available port
  const port =
    options.port || (await getPort({ port: [5555, 5556, 5557, 5558, 5559] }));

  // 5. Start server
  progress.stop();
  clack.log.success("Starting dashboard server...");
  console.log(
    `${pc.dim("Using current AWS credentials (no role assumption)")}\\n`
  );

  const { url } = await startConsoleServer({
    port,
    roleArn: undefined, // Use current credentials instead of assuming role
    region,
    tableName,
    accountId: identity.accountId,
    noOpen: options.noOpen ?? false,
    archiveArn,
    archivingEnabled,
    // SMS config
    smsTableName,
    smsPhoneNumber,
    smsPhoneNumberArn,
    smsPhoneNumberType,
    smsConfigSetName,
    smsProtectEnabled,
    smsAllowedCountries,
    smsAitFiltering,
    smsArchiveRetention,
  });

  console.log(`\\n${pc.bold("Dashboard:")} ${pc.cyan(url)}`);
  console.log(`${pc.dim("Press Ctrl+C to stop")}\\n`);

  // 6. Open browser (unless --no-open)
  if (!options.noOpen) {
    await open(url);
  }

  // 7. Track console launch
  trackCommand("console", {
    success: true,
    port,
    no_open: options.noOpen ?? false,
  });

  // Keep process alive
  await new Promise(() => {});
}
