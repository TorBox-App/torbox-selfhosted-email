import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import type { SelfhostStatusOptions } from "../../types/index.js";
import { reconcileSelfhostApiUrl } from "../../utils/selfhost/api-url.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import { resolveRegionForCommand } from "../../utils/shared/region-resolver.js";

/**
 * Display self-hosted deployment status in a formatted box.
 */
function displaySelfhostStatus(options: {
  region: string;
  apiUrl: string;
  deployedAt: string;
  neonProjectId?: string;
  appUrl: string;
  licenseKeyPrefix: string;
}) {
  const lines: string[] = [];

  const incomplete = !(options.apiUrl && options.appUrl);
  lines.push(
    incomplete
      ? pc.bold(pc.yellow("Self-Hosted Control Plane Incomplete"))
      : pc.bold(pc.green("Self-Hosted Control Plane Active"))
  );
  if (incomplete) {
    lines.push(
      pc.yellow(
        `A previous deploy did not finish. Run ${pc.cyan("pnpm selfhost:upgrade")} from your fork to complete it.`
      )
    );
  }
  lines.push("");

  lines.push(pc.bold("API"));
  lines.push(`  URL: ${pc.cyan(options.apiUrl || "(not deployed)")}`);
  lines.push(`  Region: ${pc.cyan(options.region)}`);
  lines.push(`  Deployed: ${pc.dim(options.deployedAt)}`);
  lines.push("");

  lines.push(pc.bold("Configuration"));
  lines.push(`  App URL: ${pc.cyan(options.appUrl || "(not deployed)")}`);
  lines.push(`  License Key: ${pc.dim(`${options.licenseKeyPrefix}...`)}`);
  if (options.neonProjectId) {
    lines.push(`  Neon Project: ${pc.dim(options.neonProjectId)}`);
  }

  clack.note(lines.join("\n"), "Self-Hosted Status");
}

/**
 * Self-hosted status command — show current self-hosted deployment details.
 */
export async function selfhostStatus(
  options: SelfhostStatusOptions
): Promise<void> {
  const startTime = Date.now();
  const progress = new DeploymentProgress();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Self-Hosted Status"));
  }

  // 1. Validate AWS credentials
  const identity = await progress.execute(
    "Loading self-hosted status",
    async () => validateAWSCredentials()
  );

  // 2. Resolve region
  const region = await resolveRegionForCommand({
    accountId: identity.accountId,
    optionRegion: options.region,
    service: "selfhost",
    label: "self-hosted deployment",
  });

  // 3. Load metadata
  const metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.selfhost) {
    progress.stop();
    clack.log.error("No self-hosted deployment found");
    console.log(
      `\nRun ${pc.cyan("pnpm selfhost:deploy")} from your fork to deploy the full platform (API + dashboard),\nor ${pc.cyan("wraps selfhost deploy")} for the API-only control plane.\n`
    );
    process.exit(1);
  }

  progress.stop();

  const selfhostService = metadata.services.selfhost;
  const config = selfhostService.config;
  const apiUrl =
    (await reconcileSelfhostApiUrl(metadata, region)) ?? selfhostService.apiUrl;

  const statusData = {
    region,
    apiUrl,
    deployedAt: selfhostService.deployedAt,
    neonProjectId: config.neonProjectId,
    appUrl: config.appUrl,
    licenseKeyPrefix: config.licenseKey.slice(0, 12),
  };

  if (isJsonMode()) {
    jsonSuccess("selfhost.status", statusData);
    return;
  }

  displaySelfhostStatus(statusData);

  // 4. Show next steps
  console.log("");
  clack.log.info(pc.bold("Commands:"));
  console.log(
    `  ${pc.cyan("wraps selfhost upgrade")} - Rebuild and redeploy the API Lambda`
  );

  // 5. Track status command
  trackCommand("selfhost:status", {
    success: true,
    duration_ms: Date.now() - startTime,
  });

  clack.outro(pc.dim("Self-hosted deployment is active"));
}
