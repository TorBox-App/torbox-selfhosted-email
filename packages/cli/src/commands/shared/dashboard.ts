import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import getPort from "get-port";
import open from "open";
import pc from "picocolors";
import { startConsoleServer } from "../../console/server.js";
import { getTelemetryClient } from "../../telemetry/client.js";
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
  let storageStackOutputs: any = {};

  try {
    // Ensure Pulumi workspace is configured (sets backend URL)
    await ensurePulumiWorkDir({ accountId: identity.accountId, region });

    // Try to load email stack
    try {
      const emailStack = await pulumi.automation.LocalWorkspace.selectStack({
        stackName: `wraps-${identity.accountId}-${region}`,
        workDir: getPulumiWorkDir(),
      });
      emailStackOutputs = await emailStack.outputs();
    } catch (_emailError: unknown) {
      // guardrail:allow-swallowed-error — stack may not exist
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
      // guardrail:allow-swallowed-error — stack may not exist
      // SMS stack not found, continue
    }

    // Try to load CDN stack
    try {
      const cdnStack = await pulumi.automation.LocalWorkspace.selectStack({
        stackName: `wraps-cdn-${identity.accountId}-${region}`,
        workDir: getPulumiWorkDir(),
      });
      storageStackOutputs = await cdnStack.outputs();
    } catch (_cdnError: unknown) {
      // guardrail:allow-swallowed-error — stack may not exist
      // CDN stack not found, continue
    }

    // If no stack found, show error
    if (
      Object.keys(emailStackOutputs).length === 0 &&
      Object.keys(smsStackOutputs).length === 0 &&
      Object.keys(storageStackOutputs).length === 0
    ) {
      throw new Error("No infrastructure found");
    }
  } catch (_error: unknown) {
    // guardrail:allow-swallowed-error — shows user-friendly message
    progress.stop();
    clack.log.error("No Wraps infrastructure found");
    console.log(
      `\\nRun ${pc.cyan("wraps email init")}, ${pc.cyan("wraps sms init")}, or ${pc.cyan("wraps storage init")} to deploy infrastructure first.\\n`
    );
    process.exit(1);
  }

  // Extract email outputs
  const tableName = emailStackOutputs.tableName?.value;
  const archiveArn = emailStackOutputs.archiveArn?.value;
  const archivingEnabled = emailStackOutputs.archivingEnabled?.value ?? false;
  const inboundBucketName = emailStackOutputs.inboundBucketName?.value;

  // Extract SMS outputs
  const smsTableName = smsStackOutputs.tableName?.value;
  const smsPhoneNumber = smsStackOutputs.phoneNumber?.value;
  const smsPhoneNumberArn = smsStackOutputs.phoneNumberArn?.value;
  const smsPhoneNumberType = smsStackOutputs.phoneNumberType?.value;
  const smsConfigSetName = smsStackOutputs.configSetName?.value;

  // Extract storage outputs
  const cdnBucketName = storageStackOutputs.bucketName?.value;
  const cdnDistributionId = storageStackOutputs.distributionId?.value;
  const cdnDistributionDomain = storageStackOutputs.distributionDomain?.value;
  const cdnCertificateArn = storageStackOutputs.acmCertificateArn?.value;

  // Load SMS and storage config from metadata
  let smsProtectEnabled = false;
  let smsAllowedCountries: string[] | undefined;
  let smsAitFiltering: boolean | undefined;
  let smsArchiveRetention: string | undefined;
  let cdnCustomDomain: string | undefined;

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
    if (metadata?.services?.cdn?.config?.cdn?.customDomain) {
      cdnCustomDomain = metadata.services.cdn.config.cdn.customDomain;
    }
  } catch {
    // guardrail:allow-swallowed-error — metadata is optional, continue with defaults
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
    // Inbound email config
    inboundBucketName,
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
    // Storage config (don't pass roleArn - use current credentials like email)
    cdnBucketName,
    cdnRoleArn: undefined, // Use current credentials instead of assuming role
    cdnDistributionId,
    cdnDistributionDomain,
    cdnCustomDomain,
    cdnCertificateArn,
  });

  console.log(`\\n${pc.bold("Dashboard:")} ${pc.cyan(url)}`);
  console.log(`${pc.dim("Press Ctrl+C to stop")}\\n`);

  // 6. Show promotional footer once per session
  getTelemetryClient().showFooterOnce();

  // 7. Open browser (unless --no-open)
  if (!options.noOpen) {
    await open(url);
  }

  // 8. Track console launch
  trackCommand("console", {
    success: true,
    port,
    no_open: options.noOpen ?? false,
  });

  // 9. Keep process alive
  await new Promise(() => {});
}
