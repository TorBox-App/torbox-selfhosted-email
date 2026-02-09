import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import type { StatusOptions } from "../../types/index.js";
import {
  getAWSRegion,
  validateAWSCredentials,
} from "../../utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../utils/shared/fs.js";
import { DeploymentProgress } from "../../utils/shared/output.js";

/**
 * Global Status command - Show overview of all deployed infrastructure
 */
export async function status(_options: StatusOptions): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  clack.intro(pc.bold("Wraps Infrastructure Status"));

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Loading infrastructure status",
    async () => validateAWSCredentials()
  );

  progress.info(`AWS Account: ${pc.cyan(identity.accountId)}`);

  // 2. Get region
  const region = await getAWSRegion();
  progress.info(`Region: ${pc.cyan(region)}`);

  // 3. Check for deployed services
  const services: Array<{
    name: string;
    status: "deployed" | "not_deployed";
    details?: string;
  }> = [];

  // Check Email infrastructure
  try {
    await ensurePulumiWorkDir({ accountId: identity.accountId, region });
    const emailStack = await pulumi.automation.LocalWorkspace.selectStack({
      stackName: `wraps-${identity.accountId}-${region}`,
      workDir: getPulumiWorkDir(),
    });
    const emailOutputs = await emailStack.outputs();

    if (emailOutputs.roleArn?.value) {
      const domainCount = emailOutputs.domains?.value?.length || 0;
      services.push({
        name: "Email",
        status: "deployed",
        details: domainCount > 0 ? `${domainCount} domain(s)` : undefined,
      });
    } else {
      services.push({ name: "Email", status: "not_deployed" });
    }
  } catch (_error) {
    // guardrail:allow-swallowed-error — stack may not exist
    services.push({ name: "Email", status: "not_deployed" });
  }

  // Check SMS infrastructure
  try {
    const smsStack = await pulumi.automation.LocalWorkspace.selectStack({
      stackName: `wraps-sms-${identity.accountId}-${region}`,
      workDir: getPulumiWorkDir(),
    });
    const smsOutputs = await smsStack.outputs();

    if (smsOutputs.roleArn?.value) {
      const phoneNumber = smsOutputs.phoneNumber?.value as string | undefined;
      services.push({
        name: "SMS",
        status: "deployed",
        details: phoneNumber || undefined,
      });
    } else {
      services.push({ name: "SMS", status: "not_deployed" });
    }
  } catch (_error) {
    // guardrail:allow-swallowed-error — stack may not exist
    services.push({ name: "SMS", status: "not_deployed" });
  }

  progress.stop();

  // 4. Display services overview
  console.log();
  clack.note(
    services
      .map((s) => {
        if (s.status === "deployed") {
          const details = s.details ? pc.dim(` (${s.details})`) : "";
          return `  ${pc.green("✓")} ${s.name}${details}`;
        }
        return `  ${pc.dim("○")} ${s.name} ${pc.dim("(not deployed)")}`;
      })
      .join("\n"),
    "Services"
  );

  // 5. Show next steps
  const hasDeployedServices = services.some((s) => s.status === "deployed");

  if (hasDeployedServices) {
    console.log(`\n${pc.bold("Details:")}`);
    if (services.find((s) => s.name === "Email")?.status === "deployed") {
      console.log(`  ${pc.dim("Email:")} ${pc.cyan("wraps email status")}`);
    }
    if (services.find((s) => s.name === "SMS")?.status === "deployed") {
      console.log(`  ${pc.dim("SMS:")} ${pc.cyan("wraps sms status")}`);
    }
  } else {
    console.log(`\n${pc.bold("Get started:")}`);
    console.log(`  ${pc.dim("Deploy email:")} ${pc.cyan("wraps email init")}`);
    console.log(`  ${pc.dim("Deploy SMS:")} ${pc.cyan("wraps sms init")}`);
  }

  console.log(`\n${pc.bold("Dashboard:")} ${pc.blue("https://app.wraps.dev")}`);
  console.log(`${pc.bold("Docs:")} ${pc.blue("https://wraps.dev/docs")}\n`);

  // 6. Track status command
  trackCommand("status", {
    success: true,
    services_deployed: services.filter((s) => s.status === "deployed").length,
    duration_ms: Date.now() - startTime,
  });
}
