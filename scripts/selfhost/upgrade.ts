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
import { REPO_ROOT, runSubprocess } from "./subprocess.js";

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

export type UpgradeOptions = {
  region?: string;
  yes?: boolean;
};

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

  const identity = await validateAWSCredentials();
  const region =
    options.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";

  let metadata = await loadConnectionMetadata(identity.accountId, region);

  if (!metadata?.services?.selfhost) {
    // Partial deploy recovery — env file exists but metadata was never saved
    const env = parseEnvFile(await readFile(ENV_PATH, "utf-8"));
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

  clack.log.step("Deploying updated infrastructure...");
  await runSubprocess("sst", ["deploy", "--config", SST_CONFIG, "--stage", "production"], undefined, SST_DIR);

  const databaseUrl =
    metadata.services.selfhost?.config?.databaseUrl ||
    parseEnvFile(await readFile(ENV_PATH, "utf-8")).DATABASE_URL;

  if (!databaseUrl) {
    clack.log.warn(
      "DATABASE_URL not found in metadata or .env.selfhost — skipping database migrations."
    );
  } else {
    clack.log.step("Running database migrations...");
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const migrationsFolder = join(REPO_ROOT, "packages", "db", "src", "migrations");
    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);
    try {
      await migrate(db, { migrationsFolder });
    } finally {
      await pool.end();
    }
    clack.log.success("Database migrations applied.");
  }

  const outputs = JSON.parse(await readFile(OUTPUTS_PATH, "utf-8"));
  const apiUrl: string = outputs.SelfhostApi?.url ?? outputs.apiUrl ?? "";
  const webUrl: string = outputs.SelfhostWeb?.url ?? outputs.webUrl ?? "";

  if (!apiUrl) {
    clack.log.error(
      "SST deploy did not emit an API URL. Check the selfhost.sst.config.ts outputs."
    );
    process.exit(1);
  }

  const now = new Date().toISOString();
  metadata.services.selfhost = {
    ...metadata.services.selfhost,
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
    string: ["region"],
    boolean: ["yes"],
    alias: { y: "yes" },
  });
  upgrade({ region: flags.region, yes: flags.yes }).catch((err) => {
    clack.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
