import { randomBytes } from "node:crypto";
import { access, chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import mri from "mri";
import pc from "picocolors";
import { deployEmailStack } from "../../packages/cli/src/infrastructure/email-stack.js";
import { detectSelfhostVariant } from "../../packages/cli/src/utils/selfhost/variant.js";
import { validateAWSCredentials } from "../../packages/cli/src/utils/shared/aws.js";
import {
  ensurePulumiWorkDir,
  getPulumiWorkDir,
} from "../../packages/cli/src/utils/shared/fs.js";
import {
  buildEmailStackConfig,
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../packages/cli/src/utils/shared/metadata.js";
import {
  appendMissingEnvVars,
  buildDeployedEnvVars,
  detectEmailStack,
} from "./env.js";
import { REPO_ROOT, runSubprocess } from "./subprocess.js";

const ENV_PATH = join(REPO_ROOT, ".env.selfhost");
const SST_DIR = join(REPO_ROOT, "infra");
const SST_CONFIG = "selfhost.sst.config.ts";
const OUTPUTS_PATH = join(REPO_ROOT, "infra", ".sst", "outputs.json");

export type DeployOptions = {
  databaseUrl?: string;
  licenseKey?: string;
  region?: string;
  webDomain?: string;
  aiGatewayApiKey?: string;
  yes?: boolean;
  rerouteEvents?: boolean;
};

export async function deploy(options: DeployOptions = {}): Promise<void> {
  clack.intro(pc.bold("Wraps Self-Hosted Deploy"));

  try {
    await access(ENV_PATH);
    clack.log.error(
      `.env.selfhost already exists. Use ${pc.cyan("pnpm selfhost:upgrade")} to redeploy.`
    );
    process.exit(1);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const identity = await validateAWSCredentials();
  const region =
    options.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";

  // Both selfhost variants create the account-global IAM role
  // wraps-selfhost-scheduler-role — deploying over an existing deployment
  // fails partway through with EntityAlreadyExists. Fail fast, before
  // .env.selfhost is written (its existence blocks this command forever).
  const deployedVariant = await detectSelfhostVariant(region);
  if (deployedVariant === "pulumi") {
    clack.log.error(
      "An API-only selfhost control plane (deployed by `wraps selfhost deploy`) already exists in this AWS account."
    );
    clack.log.info(
      `The two selfhost variants share IAM resources and cannot coexist. Run ${pc.cyan("wraps selfhost destroy")} first, or keep using the API-only control plane.`
    );
    process.exit(1);
  }
  if (deployedVariant === "sst") {
    clack.log.error(
      "A full-platform (SST) selfhost deployment already exists in this AWS account, but .env.selfhost is missing."
    );
    clack.log.info(
      `Deploying now would generate new secrets and invalidate every issued session and unsubscribe token.\nRecreate .env.selfhost from your saved secrets (see the reconstruct step in .github/workflows/selfhost-deploy.yml), then run ${pc.cyan("pnpm selfhost:upgrade")}.`
    );
    process.exit(1);
  }

  let databaseUrl = options.databaseUrl || process.env.DATABASE_URL;
  let licenseKey = options.licenseKey || process.env.WRAPS_LICENSE_KEY;
  if (!databaseUrl) {
    databaseUrl = (await clack.text({
      message: "Postgres connection string (DATABASE_URL):",
      placeholder: "postgres://user:pass@host:5432/dbname",
    })) as string;
    if (clack.isCancel(databaseUrl)) process.exit(0);
  }

  if (!licenseKey) {
    licenseKey = (await clack.text({
      message: "Wraps enterprise license key:",
      placeholder: "wraps_lic_...",
    })) as string;
    if (clack.isCancel(licenseKey)) process.exit(0);
  }

  // Honor operator-provided secrets (CI runs on ephemeral machines — generated
  // secrets would be lost with the runner, invalidating every issued token on
  // the next deploy). Generate only when absent.
  const betterAuthSecret =
    process.env.BETTER_AUTH_SECRET || randomBytes(32).toString("hex");
  const unsubscribeSecret =
    process.env.UNSUBSCRIBE_SECRET || randomBytes(32).toString("hex");

  const envLines = [
    `DATABASE_URL=${databaseUrl}`,
    `LICENSE_KEY=${licenseKey}`,
    `BETTER_AUTH_SECRET=${betterAuthSecret}`,
    `UNSUBSCRIBE_SECRET=${unsubscribeSecret}`,
    `SELFHOST_AWS_REGION=${region}`,
  ];
  if (options.webDomain)
    envLines.push(`SELFHOST_WEB_DOMAIN=${options.webDomain}`);
  if (options.aiGatewayApiKey)
    envLines.push(`AI_GATEWAY_API_KEY=${options.aiGatewayApiKey}`);

  await writeFile(ENV_PATH, `${envLines.join("\n")}\n`, "utf-8");
  await chmod(ENV_PATH, 0o600);
  clack.log.info("Wrote .env.selfhost");

  const sstEnv = { SELFHOST_AWS_REGION: region };

  clack.log.step("Installing SST providers...");
  await runSubprocess(
    "sst",
    ["install", "--config", SST_CONFIG],
    sstEnv,
    SST_DIR
  );

  clack.log.step("Deploying infrastructure (this may take 5-10 minutes)...");
  await runSubprocess(
    "sst",
    ["deploy", "--config", SST_CONFIG, "--stage", "production"],
    sstEnv,
    SST_DIR
  );

  const outputs = JSON.parse(await readFile(OUTPUTS_PATH, "utf-8"));
  const apiUrl: string = outputs.SelfhostApi?.url ?? outputs.apiUrl ?? "";
  const webUrl: string = outputs.SelfhostWeb?.url ?? outputs.webUrl ?? "";

  if (!apiUrl) {
    clack.log.error(
      "SST deploy did not emit an API URL. Check the selfhost.sst.config.ts outputs."
    );
    process.exit(1);
  }

  const emailStack = await detectEmailStack(region);

  const appended = await appendMissingEnvVars(
    ENV_PATH,
    buildDeployedEnvVars({
      apiUrl,
      webUrl,
      webDomain: options.webDomain,
      emailStack,
    })
  );

  // The first deploy could not know its own URLs, so the web app was built
  // with empty NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL — which app code silently
  // falls back past, into wraps.dev and localhost links. Deploy again so the
  // URLs written above are actually baked into the build.
  if (appended.length > 0) {
    clack.log.step(
      "Redeploying with app URLs baked in (second pass, faster than the first)..."
    );
    await runSubprocess(
      "sst",
      ["deploy", "--config", SST_CONFIG, "--stage", "production"],
      sstEnv,
      SST_DIR
    );
  }

  const now = new Date().toISOString();
  const metadata = (await loadConnectionMetadata(
    identity.accountId,
    region
  )) ?? {
    version: "1.0.0",
    accountId: identity.accountId,
    region,
    provider: "other" as const,
    timestamp: now,
    services: {},
  };
  // Always write current config — a redeploy rotates secrets, and stale
  // metadata would make `wraps selfhost env` emit secrets that don't match
  // what's deployed.
  metadata.services.selfhost = {
    ...metadata.services.selfhost,
    config: {
      ...metadata.services.selfhost?.config,
      databaseUrl: databaseUrl!,
      licenseKey: licenseKey!,
      appUrl: webUrl,
      unsubscribeSecret,
      betterAuthSecret,
      ...(options.webDomain && { webDomain: options.webDomain }),
      ...(options.aiGatewayApiKey && {
        aiGatewayApiKey: options.aiGatewayApiKey,
      }),
    },
    apiUrl,
    webUrl,
    deployedAt: now,
    variant: "sst",
  };
  metadata.timestamp = now;
  await saveConnectionMetadata(metadata);

  if (metadata.services.email?.webhookSecret) {
    // --yes means "accept defaults", and the interactive default is NO —
    // rerouting live SES events must be an explicit choice (--reroute-events).
    const rerouteConfirmed =
      options.rerouteEvents ??
      (options.yes
        ? false
        : await clack.confirm({
            message: `Reroute SES email events to your selfhost API (${pc.cyan(apiUrl)}) instead of the Wraps platform?`,
            initialValue: false,
          }));

    if (!clack.isCancel(rerouteConfirmed) && rerouteConfirmed) {
      clack.log.step("Rerouting email events to selfhost API...");
      const webhookUrl = `${apiUrl}/v1/ses-events`;
      const stackConfig = buildEmailStackConfig(metadata, region, {
        webhook: {
          awsAccountNumber: identity.accountId,
          webhookSecret: metadata.services.email.webhookSecret,
          webhookUrl,
        },
      });

      await ensurePulumiWorkDir({ accountId: identity.accountId, region });
      const emailStackName =
        metadata.services.email?.pulumiStackName ||
        `wraps-${identity.accountId}-${region}`;

      const stack = await pulumi.automation.LocalWorkspace.createOrSelectStack(
        {
          stackName: emailStackName,
          projectName: "wraps-email",
          program: async () => {
            const result = await deployEmailStack(stackConfig);
            return {
              roleArn: result.roleArn,
              configSetName: result.configSetName,
              tableName: result.tableName,
              region: result.region,
            };
          },
        },
        {
          workDir: getPulumiWorkDir(),
          envVars: { PULUMI_CONFIG_PASSPHRASE: "", AWS_REGION: region },
          secretsProvider: "passphrase",
        }
      );
      await stack.setConfig("aws:region", { value: region });
      await stack.refresh({ onOutput: () => {} });
      await stack.up({ onOutput: () => {} });

      // Persist the reroute target — without this, the next email stack
      // redeploy rebuilds the webhook with the default (Wraps platform) URL
      // and silently points the customer's events back at us.
      metadata.services.email.webhookUrl = webhookUrl;
      metadata.timestamp = new Date().toISOString();
      await saveConnectionMetadata(metadata);
      clack.log.success("Email events rerouted to self-hosted API");
    }
  }

  clack.outro(pc.green("Self-hosted deployment complete!"));
  clack.log.info(`API: ${pc.cyan(apiUrl)}`);
  clack.log.info(`Web: ${pc.cyan(webUrl)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = mri(process.argv.slice(2), {
    string: [
      "database-url",
      "license-key",
      "region",
      "web-domain",
      "ai-gateway-api-key",
    ],
    boolean: ["yes", "reroute-events"],
    alias: {
      y: "yes",
      "database-url": "databaseUrl",
      "license-key": "licenseKey",
      "web-domain": "webDomain",
      "ai-gateway-api-key": "aiGatewayApiKey",
      "reroute-events": "rerouteEvents",
    },
  });
  deploy({
    databaseUrl: flags["database-url"],
    licenseKey: flags["license-key"],
    region: flags.region,
    webDomain: flags["web-domain"],
    aiGatewayApiKey: flags["ai-gateway-api-key"],
    yes: flags.yes,
    rerouteEvents: flags["reroute-events"],
  }).catch((err) => {
    clack.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
