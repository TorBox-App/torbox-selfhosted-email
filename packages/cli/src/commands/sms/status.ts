import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import type { SMSStatusOptions } from "../../types/index.js";
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
 * Display SMS status in a formatted box
 */
function displaySMSStatus(options: {
  region: string;
  phoneNumber?: string;
  phoneNumberType?: string;
  configSetName?: string;
  tableName?: string;
  queueUrl?: string;
  eventTracking: boolean;
  roleArn?: string;
  preset?: string;
}) {
  const lines: string[] = [];

  // Header
  lines.push(pc.bold(pc.green("SMS Infrastructure Active")));
  lines.push("");

  // Phone number section
  lines.push(pc.bold("Phone Number"));
  if (options.phoneNumber) {
    lines.push(`  Number: ${pc.cyan(options.phoneNumber)}`);
  } else {
    lines.push(`  Number: ${pc.yellow("Provisioning...")}`);
  }
  lines.push(`  Type: ${pc.cyan(options.phoneNumberType || "simulator")}`);
  lines.push("");

  // Configuration
  lines.push(pc.bold("Configuration"));
  lines.push(`  Region: ${pc.cyan(options.region)}`);
  if (options.preset) {
    lines.push(`  Preset: ${pc.cyan(options.preset)}`);
  }
  if (options.configSetName) {
    lines.push(`  Config Set: ${pc.cyan(options.configSetName)}`);
  }
  lines.push("");

  // Features
  lines.push(pc.bold("Features"));
  lines.push(
    `  Event Tracking: ${options.eventTracking ? pc.green("Enabled") : pc.dim("Disabled")}`
  );
  if (options.tableName) {
    lines.push(`  Message History: ${pc.green("Enabled")}`);
    lines.push(`    Table: ${pc.dim(options.tableName)}`);
  }
  if (options.queueUrl) {
    lines.push(`  Event Queue: ${pc.green("Enabled")}`);
  }
  lines.push("");

  // IAM Role
  if (options.roleArn) {
    lines.push(pc.bold("IAM Role"));
    lines.push(`  ${pc.dim(options.roleArn)}`);
  }

  clack.note(lines.join("\n"), "SMS Status");
}

/**
 * SMS Status command - Show current SMS infrastructure setup
 */
export async function smsStatus(_options: SMSStatusOptions): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps SMS Status"));

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Loading SMS infrastructure status",
    async () => validateAWSCredentials()
  );

  // 2. Get region
  const region = await getAWSRegion();

  // 3. Check for existing metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.sms) {
    progress.stop();
    clack.log.error("No SMS infrastructure found");
    console.log(
      `\nRun ${pc.cyan("wraps sms init")} to deploy SMS infrastructure.\n`
    );
    process.exit(1);
  }

  // 4. Try to load Pulumi stack
  let stackOutputs: Record<string, pulumi.automation.OutputValue> = {};
  try {
    await ensurePulumiWorkDir();

    const stackName =
      metadata.services.sms.pulumiStackName ||
      `wraps-sms-${identity.accountId}-${region}`;

    const stack = await pulumi.automation.LocalWorkspace.selectStack({
      stackName,
      workDir: getPulumiWorkDir(),
    });

    stackOutputs = await stack.outputs();
  } catch (_error: unknown) {
    // Stack might not exist, continue with metadata only
    progress.info("Unable to load Pulumi stack, showing metadata only");
  }

  // 5. Display status
  progress.stop();

  const smsConfig = metadata.services.sms.config;
  displaySMSStatus({
    region,
    phoneNumber: stackOutputs.phoneNumber?.value as string | undefined,
    phoneNumberType: smsConfig?.phoneNumberType,
    configSetName: stackOutputs.configSetName?.value as string | undefined,
    tableName: stackOutputs.tableName?.value as string | undefined,
    queueUrl: stackOutputs.queueUrl?.value as string | undefined,
    eventTracking: smsConfig?.eventTracking?.enabled ?? false,
    roleArn: stackOutputs.roleArn?.value as string | undefined,
    preset: metadata.services.sms.preset,
  });

  // 6. Show next steps
  console.log("");
  clack.log.info(pc.bold("Commands:"));
  console.log(
    `  ${pc.cyan("wraps sms test --to +1234567890")} - Send a test message`
  );
  console.log(`  ${pc.cyan("wraps sms destroy")} - Remove SMS infrastructure`);

  // 7. Track status command
  trackCommand("sms:status", {
    success: true,
    phone_type: smsConfig?.phoneNumberType,
    event_tracking: smsConfig?.eventTracking?.enabled,
    duration_ms: Date.now() - startTime,
  });

  clack.outro(pc.dim("SMS infrastructure is ready"));
}
