import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import type { SelfhostEnvOptions } from "../../types/index.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { resolveRegionForCommand } from "../../utils/shared/region-resolver.js";

/**
 * selfhost env — print all environment variables needed to deploy apps/web
 * to Vercel against this self-hosted control plane. Output is .env-compatible
 * so it can be piped to a file or pasted into the Vercel dashboard.
 */
export async function selfhostEnv(options: SelfhostEnvOptions): Promise<void> {
  const startTime = Date.now();

  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps Self-Hosted — Vercel Environment Variables"));
  }

  // 1. Validate AWS credentials
  const identity = await validateAWSCredentials();

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
    clack.log.error("No self-hosted deployment found");
    console.log(
      `\nRun ${pc.cyan("wraps selfhost deploy")} to deploy the self-hosted control plane.\n`
    );
    process.exit(1);
    return;
  }

  const { config } = metadata.services.selfhost;

  const env: Record<string, string> = {
    DATABASE_URL: config.databaseUrl,
    NEXT_PUBLIC_APP_URL: config.appUrl,
    CORS_ORIGIN: config.appUrl,
    BETTER_AUTH_SECRET: config.betterAuthSecret,
    WRAPS_LICENSE_KEY: config.licenseKey,
    AWS_BACKEND_ACCOUNT_ID: identity.accountId,
  };

  if (isJsonMode()) {
    jsonSuccess("selfhost.env", { env });
    return;
  }

  // Output in .env format — no ANSI so it can be piped to a file
  console.log(
    `# Wraps Self-Hosted — environment for apps/web on Vercel`
  );
  console.log(
    `# Deployment: ${identity.accountId} / ${region} — ${config.appUrl}`
  );
  console.log(`# Generated: ${new Date().toISOString()}`);
  console.log("");

  for (const [key, value] of Object.entries(env)) {
    console.log(`${key}=${value}`);
  }

  console.log("");
  console.log(
    "# AWS credentials for role assumption — create an IAM user in your account"
  );
  console.log(
    `# with sts:AssumeRole permission on arn:aws:iam::${identity.accountId}:role/wraps-console-access-role`
  );
  console.log("# AWS_ACCESS_KEY_ID=<fill-in>");
  console.log("# AWS_SECRET_ACCESS_KEY=<fill-in>");

  clack.outro(
    pc.dim("Paste into Vercel → Settings → Environment Variables → Add from .env")
  );

  trackCommand("selfhost:env", {
    success: true,
    duration_ms: Date.now() - startTime,
  });
}
