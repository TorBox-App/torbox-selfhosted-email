import { randomBytes } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import {
  ListConfigurationSetsCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import mri from "mri";
import pc from "picocolors";
import { deployEmailStack } from "../../packages/cli/src/infrastructure/email-stack.js";
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
import { REPO_ROOT, runSubprocess } from "./subprocess.js";

async function detectEmailStack(region: string): Promise<{
  roleArn: string | null;
  configSetName: string | null;
}> {
  try {
    const iam = new IAMClient({ region });
    const ses = new SESv2Client({ region });
    const [roleResult, setsResult] = await Promise.allSettled([
      iam.send(new GetRoleCommand({ RoleName: "wraps-email-role" })),
      ses.send(new ListConfigurationSetsCommand({})),
    ]);
    const roleArn =
      roleResult.status === "fulfilled"
        ? (roleResult.value.Role?.Arn ?? null)
        : null;
    const sets =
      setsResult.status === "fulfilled"
        ? (setsResult.value.ConfigurationSets ?? []).filter((n) =>
            n.startsWith("wraps-email-")
          )
        : [];
    const configSetName =
      sets.find((n) => n !== "wraps-email-tracking") ?? sets[0] ?? null;
    return { roleArn, configSetName };
  } catch {
    return { roleArn: null, configSetName: null };
  }
}

function parseEnvFile(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx), l.slice(idx + 1)];
      })
  );
}

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

  let databaseUrl = options.databaseUrl;
  let licenseKey = options.licenseKey;
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

  const betterAuthSecret = randomBytes(32).toString("hex");
  const unsubscribeSecret = randomBytes(32).toString("hex");

  const envLines = [
    `DATABASE_URL=${databaseUrl}`,
    `LICENSE_KEY=${licenseKey}`,
    `BETTER_AUTH_SECRET=${betterAuthSecret}`,
    `UNSUBSCRIBE_SECRET=${unsubscribeSecret}`,
  ];
  if (options.webDomain)
    envLines.push(`SELFHOST_WEB_DOMAIN=${options.webDomain}`);
  if (options.aiGatewayApiKey)
    envLines.push(`AI_GATEWAY_API_KEY=${options.aiGatewayApiKey}`);

  await writeFile(ENV_PATH, `${envLines.join("\n")}\n`, "utf-8");
  clack.log.info("Wrote .env.selfhost");

  clack.log.step("Installing SST providers...");
  await runSubprocess(
    "sst",
    ["install", "--config", SST_CONFIG],
    undefined,
    SST_DIR
  );

  clack.log.step("Bootstrapping SST state bucket...");
  await runSubprocess(
    "sst",
    ["bootstrap", "--config", SST_CONFIG],
    undefined,
    SST_DIR
  );

  clack.log.step("Deploying infrastructure (this may take 5-10 minutes)...");
  await runSubprocess(
    "sst",
    ["deploy", "--config", SST_CONFIG, "--stage", "production"],
    undefined,
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

  const currentEnv = await readFile(ENV_PATH, "utf-8");
  const envAppend = [
    `NEXT_PUBLIC_APP_URL=${webUrl}`,
    `WRAPS_API_URL=${apiUrl}`,
    `BETTER_AUTH_URL=${webUrl}`,
    ...(emailStack.roleArn
      ? [`WRAPS_EMAIL_ROLE_ARN=${emailStack.roleArn}`]
      : []),
    ...(emailStack.configSetName
      ? [`AUTH_EMAIL_CONFIGURATION_SET=${emailStack.configSetName}`]
      : []),
    ...(emailStack.configSetName && options.webDomain
      ? [`AUTH_EMAIL_FROM=noreply@${options.webDomain}`]
      : []),
  ];
  await writeFile(
    ENV_PATH,
    `${currentEnv.trimEnd()}\n${envAppend.join("\n")}\n`,
    "utf-8"
  );

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
  metadata.services.selfhost = {
    ...(metadata.services.selfhost ?? {
      config: {
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
    }),
    apiUrl,
    webUrl,
    deployedAt: now,
  };
  metadata.timestamp = now;
  await saveConnectionMetadata(metadata);

  if (metadata.services.email?.webhookSecret) {
    const rerouteConfirmed = options.yes
      ? true
      : await clack.confirm({
          message: `Reroute SES email events to your selfhost API (${pc.cyan(apiUrl)}) instead of the Wraps platform?`,
          initialValue: false,
        });

    if (!clack.isCancel(rerouteConfirmed) && rerouteConfirmed) {
      clack.log.step("Rerouting email events to selfhost API...");
      const stackConfig = buildEmailStackConfig(metadata, region, {
        webhook: {
          awsAccountNumber: identity.accountId,
          webhookSecret: metadata.services.email.webhookSecret,
          webhookUrl: `${apiUrl}/v1/ses-events`,
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
    boolean: ["yes"],
    alias: {
      y: "yes",
      "database-url": "databaseUrl",
      "license-key": "licenseKey",
      "web-domain": "webDomain",
      "ai-gateway-api-key": "aiGatewayApiKey",
    },
  });
  deploy({
    databaseUrl: flags["database-url"],
    licenseKey: flags["license-key"],
    region: flags.region,
    webDomain: flags["web-domain"],
    aiGatewayApiKey: flags["ai-gateway-api-key"],
    yes: flags.yes,
  }).catch((err) => {
    clack.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
