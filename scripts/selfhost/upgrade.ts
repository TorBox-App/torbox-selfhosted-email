import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import mri from "mri";
import pc from "picocolors";
import { validateAWSCredentials } from "../../packages/cli/src/utils/shared/aws.js";
import {
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../packages/cli/src/utils/shared/metadata.js";
import {
  appendMissingEnvVars,
  buildDeployedEnvVars,
  detectEmailStack,
  parseEnvFile,
  upsertEnvVars,
} from "./env.js";
import { REPO_ROOT, runSubprocess } from "./subprocess.js";

const ENV_PATH = join(REPO_ROOT, ".env.selfhost");
const SST_DIR = join(REPO_ROOT, "infra");
const SST_CONFIG = "selfhost.sst.config.ts";
const OUTPUTS_PATH = join(REPO_ROOT, "infra", ".sst", "outputs.json");

export type UpgradeOptions = {
  region?: string;
  webDomain?: string;
  aiGatewayApiKey?: string;
  yes?: boolean;
};

async function readOutputs(): Promise<{ apiUrl: string; webUrl: string }> {
  try {
    const outputs = JSON.parse(await readFile(OUTPUTS_PATH, "utf-8"));
    return {
      apiUrl: outputs.SelfhostApi?.url ?? outputs.apiUrl ?? "",
      webUrl: outputs.SelfhostWeb?.url ?? outputs.webUrl ?? "",
    };
  } catch {
    return { apiUrl: "", webUrl: "" };
  }
}

/**
 * Append any deploy-output env vars missing from .env.selfhost (recovery from
 * a partial first deploy). Returns the appended keys.
 */
async function backfillEnvVars(
  region: string,
  webDomain: string | undefined
): Promise<string[]> {
  const { apiUrl, webUrl } = await readOutputs();
  if (!apiUrl) {
    return [];
  }
  const emailStack = await detectEmailStack(region);
  return await appendMissingEnvVars(
    ENV_PATH,
    buildDeployedEnvVars({ apiUrl, webUrl, webDomain, emailStack })
  );
}

export async function upgrade(options: UpgradeOptions = {}): Promise<void> {
  clack.intro(pc.bold("Wraps Self-Hosted Upgrade"));

  try {
    await access(ENV_PATH);
  } catch {
    clack.log.error(
      `.env.selfhost not found at repo root. Run ${pc.cyan("pnpm selfhost:deploy")} first.`
    );
    process.exit(1);
  }

  // Docs promise these flags for adding a domain / AI key after first deploy
  if (options.webDomain || options.aiGatewayApiKey) {
    await upsertEnvVars(ENV_PATH, {
      SELFHOST_WEB_DOMAIN: options.webDomain,
      AI_GATEWAY_API_KEY: options.aiGatewayApiKey,
    });
    clack.log.info("Updated .env.selfhost with provided options");
  }

  const identity = await validateAWSCredentials();
  let env = parseEnvFile(await readFile(ENV_PATH, "utf-8"));
  // The SST config deploys to SELFHOST_AWS_REGION — falling back to the
  // ambient AWS_REGION here could silently target a different region than the
  // existing stack, so the env file wins over everything but the explicit flag.
  const region =
    options.region ||
    env.SELFHOST_AWS_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";
  await appendMissingEnvVars(ENV_PATH, { SELFHOST_AWS_REGION: region });
  const webDomain = options.webDomain || env.SELFHOST_WEB_DOMAIN;

  let metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.selfhost) {
    // Partial deploy recovery — env file exists but metadata was never saved
    if (!env.DATABASE_URL) {
      clack.log.error("No self-hosted deployment found in metadata.");
      clack.log.info(`Run ${pc.cyan("pnpm selfhost:deploy")} first.`);
      process.exit(1);
    }
    clack.log.warn("No metadata found — recovering from .env.selfhost");
    const now = new Date().toISOString();
    metadata = metadata ?? {
      version: "1.0.0",
      accountId: identity.accountId,
      region,
      provider: "other" as const,
      timestamp: now,
      services: {},
    };
    metadata.services.selfhost = {
      deployedAt: now,
      apiUrl: env.WRAPS_API_URL ?? "",
      webUrl: env.NEXT_PUBLIC_APP_URL ?? "",
      config: {
        databaseUrl: env.DATABASE_URL ?? "",
        licenseKey: env.LICENSE_KEY ?? "",
        appUrl: env.NEXT_PUBLIC_APP_URL ?? "",
        unsubscribeSecret: env.UNSUBSCRIBE_SECRET ?? "",
        betterAuthSecret: env.BETTER_AUTH_SECRET ?? "",
      },
    };
  }

  if (!options.yes) {
    const confirmed = await clack.confirm({
      message: `Upgrade self-hosted deployment in ${pc.cyan(identity.accountId)} / ${pc.cyan(region)}?`,
      initialValue: true,
    });
    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Upgrade cancelled.");
      process.exit(0);
    }
  }

  const sstEnv = { SELFHOST_AWS_REGION: region };

  // If a prior deploy already emitted URLs but never wrote them to
  // .env.selfhost (partial first deploy), backfill now so this deploy bakes
  // them in — otherwise the web app builds with empty NEXT_PUBLIC_APP_URL and
  // falls back to wraps.dev / localhost links.
  if (!env.NEXT_PUBLIC_APP_URL) {
    const backfilled = await backfillEnvVars(region, webDomain);
    if (backfilled.length > 0) {
      clack.log.info(
        `Recovered missing env vars from a previous deploy: ${backfilled.join(", ")}`
      );
    }
  }

  clack.log.step("Deploying updated infrastructure...");
  await runSubprocess(
    "sst",
    ["deploy", "--config", SST_CONFIG, "--stage", "production"],
    sstEnv,
    SST_DIR
  );

  // First-ever successful deploy through the recovery path: the URLs only
  // exist now, so bake them in with a second pass.
  env = parseEnvFile(await readFile(ENV_PATH, "utf-8"));
  if (!env.NEXT_PUBLIC_APP_URL) {
    const backfilled = await backfillEnvVars(region, webDomain);
    if (backfilled.length > 0) {
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
  }

  const databaseUrl =
    metadata.services.selfhost?.config?.databaseUrl || env.DATABASE_URL;

  if (databaseUrl) {
    clack.log.step("Running database migrations...");
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const migrationsFolder = join(
      REPO_ROOT,
      "packages",
      "db",
      "src",
      "migrations"
    );
    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);
    try {
      await migrate(db, { migrationsFolder });
    } finally {
      await pool.end();
    }
    clack.log.success("Database migrations applied.");
  } else {
    clack.log.warn(
      "DATABASE_URL not found in metadata or .env.selfhost — skipping database migrations."
    );
  }

  const { apiUrl, webUrl } = await readOutputs();

  if (!apiUrl) {
    clack.log.error(
      "SST deploy did not emit an API URL. Check the selfhost.sst.config.ts outputs."
    );
    process.exit(1);
  }

  const now = new Date().toISOString();
  metadata.services.selfhost = {
    ...metadata.services.selfhost!,
    config: {
      ...metadata.services.selfhost!.config,
      appUrl: webUrl,
    },
    apiUrl,
    webUrl,
    deployedAt: now,
  };
  metadata.timestamp = now;
  await saveConnectionMetadata(metadata);

  clack.outro(pc.green("Upgrade complete!"));
  clack.log.info(`API: ${pc.cyan(apiUrl)}`);
  clack.log.info(`Web: ${pc.cyan(webUrl)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = mri(process.argv.slice(2), {
    string: ["region", "web-domain", "ai-gateway-api-key"],
    boolean: ["yes"],
    alias: {
      y: "yes",
      "web-domain": "webDomain",
      "ai-gateway-api-key": "aiGatewayApiKey",
    },
  });
  upgrade({
    region: flags.region,
    webDomain: flags["web-domain"],
    aiGatewayApiKey: flags["ai-gateway-api-key"],
    yes: flags.yes,
  }).catch((err) => {
    clack.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
