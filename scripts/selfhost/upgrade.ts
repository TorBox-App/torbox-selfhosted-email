import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import mri from "mri";
import pc from "picocolors";
import { normalizeApiUrl } from "../../packages/cli/src/utils/selfhost/api-url.js";
import { detectEmailStack } from "../../packages/cli/src/utils/selfhost/email-stack.js";
import { detectSelfhostVariant } from "../../packages/cli/src/utils/selfhost/variant.js";
import { validateAWSCredentials } from "../../packages/cli/src/utils/shared/aws.js";
import {
  loadConnectionMetadata,
  saveConnectionMetadata,
} from "../../packages/cli/src/utils/shared/metadata.js";
import {
  appendMissingEnvVars,
  appUrlForDomain,
  buildDeployedEnvVars,
  parseEnvFile,
  upsertEnvVars,
} from "./env.js";
import { describeError } from "./errors.js";
import { migrateWithProgress } from "./migrate.js";
import { rerouteEmailEvents, sesEventsWebhookUrl } from "./reroute.js";
import { REPO_ROOT, runSubprocess } from "./subprocess.js";
import { provisionTemplatesWithProgress } from "./templates.js";

const ENV_PATH = join(REPO_ROOT, ".env.selfhost");
const SST_DIR = join(REPO_ROOT, "infra");
const SST_CONFIG = "selfhost.config.ts";
const OUTPUTS_PATH = join(REPO_ROOT, "infra", ".sst", "outputs.json");

export type UpgradeOptions = {
  region?: string;
  webDomain?: string;
  aiGatewayApiKey?: string;
  /** "gateway" (default), "openai", … — see WRAPS_AI_PROVIDER. */
  aiProvider?: string;
  aiModel?: string;
  openaiApiKey?: string;
  /** For OpenAI-compatible endpoints (proxies, LiteLLM, vLLM). */
  openaiBaseUrl?: string;
  anthropicApiKey?: string;
  anthropicBaseUrl?: string;
  /** Bedrock region; falls back to the deploy region. */
  aiRegion?: string;
  sentryDsn?: string;
  yes?: boolean;
  rerouteEvents?: boolean;
};

async function readOutputs(): Promise<{ apiUrl: string; webUrl: string }> {
  try {
    const outputs = JSON.parse(await readFile(OUTPUTS_PATH, "utf-8"));
    return {
      // The one read site every consumer goes through — the env backfill, the
      // metadata write and the SES reroute all take this value. SST's API is a
      // Lambda Function URL, whose trailing slash would append as
      // `…on.aws//webhooks/ses/{id}`: a route the API does not have.
      apiUrl: normalizeApiUrl(outputs.SelfhostApi?.url ?? outputs.apiUrl ?? ""),
      webUrl: outputs.SelfhostWeb?.url ?? outputs.webUrl ?? "",
    };
  } catch {
    return { apiUrl: "", webUrl: "" };
  }
}

/**
 * Vars the deploy bakes into the web build AND the API reads at runtime.
 *
 * The backfill used to be gated on NEXT_PUBLIC_APP_URL alone, which left
 * WRAPS_API_URL and BETTER_AUTH_URL unwritten whenever an operator supplied the
 * app URL themselves — exactly what the CI workflow does when it reconstructs
 * .env.selfhost from repository secrets. An empty WRAPS_API_URL then makes the
 * API advertise the Wraps platform to the customer's own users: `.well-known`
 * returns `issuer: https://api.wraps.dev`, and POST /v1/connections hands back
 * a platform webhook endpoint.
 */
const DEPLOYED_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "WRAPS_API_URL",
  "BETTER_AUTH_URL",
] as const;

function needsDeployedEnvVars(
  env: Record<string, string | undefined>
): boolean {
  return DEPLOYED_ENV_KEYS.some((key) => !env[key]);
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

  // Docs promise these flags for adding a domain / AI key / Sentry DSN after
  // the first deploy. upsert, not append: rotating a DSN has to replace it.
  if (
    options.webDomain ||
    options.aiGatewayApiKey ||
    options.aiProvider ||
    options.aiModel ||
    options.openaiApiKey ||
    options.openaiBaseUrl ||
    options.anthropicApiKey ||
    options.anthropicBaseUrl ||
    options.aiRegion ||
    options.sentryDsn
  ) {
    await upsertEnvVars(ENV_PATH, {
      SELFHOST_WEB_DOMAIN: options.webDomain,
      AI_GATEWAY_API_KEY: options.aiGatewayApiKey,
      WRAPS_AI_PROVIDER: options.aiProvider,
      AI_MODEL: options.aiModel,
      OPENAI_API_KEY: options.openaiApiKey,
      OPENAI_BASE_URL: options.openaiBaseUrl,
      ANTHROPIC_API_KEY: options.anthropicApiKey,
      ANTHROPIC_BASE_URL: options.anthropicBaseUrl,
      WRAPS_AI_REGION: options.aiRegion,
      SENTRY_DSN: options.sentryDsn,
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

  // NEXT_PUBLIC_APP_URL marks a completed deploy. Until one has completed,
  // any existing wraps-selfhost-* scheduler resources in the account belong
  // to something else — the Pulumi CLI control plane or a crashed earlier
  // attempt — and `sst deploy` would die partway with EntityAlreadyExists
  // (the scheduler IAM role name is account-global, shared by both variants).
  if (!env.NEXT_PUBLIC_APP_URL) {
    const deployedVariant = await detectSelfhostVariant(region);
    if (deployedVariant === "pulumi") {
      clack.log.error(
        "An API-only selfhost control plane (deployed by `wraps selfhost deploy`) already exists in this AWS account."
      );
      clack.log.info(
        `The two selfhost variants share IAM resources and cannot coexist. Run ${pc.cyan("wraps selfhost destroy")} first, then re-run ${pc.cyan("pnpm selfhost:upgrade")}.`
      );
      process.exit(1);
    }
    if (deployedVariant === "sst") {
      clack.log.error(
        "Found existing wraps-selfhost scheduler resources not created by this deployment — likely a previous `wraps selfhost deploy` (CLI) or a crashed earlier attempt."
      );
      clack.log.info(
        [
          "Deploying over them fails with EntityAlreadyExists. Remove them, then re-run:",
          pc.cyan(
            "  aws scheduler delete-schedule-group --name wraps-selfhost-schedulers"
          ),
          pc.cyan(
            '  for p in $(aws iam list-role-policies --role-name wraps-selfhost-scheduler-role --query "PolicyNames[]" --output text); do aws iam delete-role-policy --role-name wraps-selfhost-scheduler-role --policy-name "$p"; done'
          ),
          pc.cyan(
            "  aws iam delete-role --role-name wraps-selfhost-scheduler-role"
          ),
        ].join("\n")
      );
      process.exit(1);
    }
  }

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
      variant: "sst",
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

  // Read the DNS settings back from the env file for the same reason as the
  // region: app() is evaluated before the dotenv load, so an upgrade that did
  // not forward these would silently fall back to the Route 53 adapter and
  // fail the hosted-zone lookup on a stack that deployed fine the first time.
  const sstEnv = {
    SELFHOST_AWS_REGION: region,
    ...(env.SELFHOST_DNS_PROVIDER && {
      SELFHOST_DNS_PROVIDER: env.SELFHOST_DNS_PROVIDER,
    }),
    ...(env.CLOUDFLARE_API_TOKEN && {
      CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    }),
    ...(env.SELFHOST_CLOUDFLARE_ZONE_ID && {
      SELFHOST_CLOUDFLARE_ZONE_ID: env.SELFHOST_CLOUDFLARE_ZONE_ID,
    }),
  };

  // If a prior deploy already emitted URLs but never wrote them to
  // .env.selfhost (partial first deploy), backfill now so this deploy bakes
  // them in — otherwise the web app builds with empty NEXT_PUBLIC_APP_URL and
  // falls back to wraps.dev / localhost links.
  if (needsDeployedEnvVars(env)) {
    const backfilled = await backfillEnvVars(region, webDomain);
    if (backfilled.length > 0) {
      clack.log.info(
        `Recovered missing env vars from a previous deploy: ${backfilled.join(", ")}`
      );
    }
    env = parseEnvFile(await readFile(ENV_PATH, "utf-8"));
  }

  // A web domain added after the first deploy has to win over whatever URL is
  // already on file. The first deploy of a domainless stack correctly bakes the
  // CloudFront URL, and appendMissingEnvVars only ever writes absent keys — so
  // without this, attaching a domain later leaves the web build calling the old
  // CloudFront origin for /api/auth and failing CORS against its own dashboard.
  //
  // Must run before `sst deploy`: Next.js bakes NEXT_PUBLIC_* at build time, so
  // reading the deployed URL back out of the outputs afterwards is too late.
  if (webDomain) {
    const appUrl = appUrlForDomain(webDomain);
    if (env.NEXT_PUBLIC_APP_URL !== appUrl || env.BETTER_AUTH_URL !== appUrl) {
      await upsertEnvVars(ENV_PATH, {
        NEXT_PUBLIC_APP_URL: appUrl,
        BETTER_AUTH_URL: appUrl,
      });
      clack.log.info(
        `Repointed app URLs at ${appUrl} (was ${env.NEXT_PUBLIC_APP_URL ?? "unset"})`
      );
      env = parseEnvFile(await readFile(ENV_PATH, "utf-8"));
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
  if (needsDeployedEnvVars(env)) {
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

  await migrateWithProgress(databaseUrl);

  // Runs on upgrade as well as deploy: upsert is how an edited template ships,
  // and it is the recovery path for an install that predates provisioning.
  await provisionTemplatesWithProgress(region);

  const { apiUrl, webUrl } = await readOutputs();

  if (!apiUrl) {
    clack.log.error(
      "SST deploy did not emit an API URL. Check the selfhost.config.ts outputs."
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
    variant: "sst",
  };
  metadata.timestamp = now;
  await saveConnectionMetadata(metadata);

  // Runs after the upgrade's own bookkeeping is persisted: rerouting touches a
  // separate Pulumi stack and must not be able to discard a successful upgrade.
  let rerouteFailure: string | undefined;
  if (options.rerouteEvents) {
    try {
      clack.log.step("Rerouting email events to selfhost API...");
      await rerouteEmailEvents({
        metadata,
        accountId: identity.accountId,
        region,
        apiUrl,
      });
      clack.log.success(
        `Email events rerouted to ${pc.cyan(sesEventsWebhookUrl(apiUrl))}`
      );
    } catch (error) {
      rerouteFailure = `Could not reroute email events: ${describeError(error)}\nThe upgrade itself succeeded — SES events just still go to the Wraps platform rather than ${pc.cyan(sesEventsWebhookUrl(apiUrl))}.`;
    }
  }

  clack.log.info(`API: ${pc.cyan(apiUrl)}`);
  clack.log.info(`Web: ${pc.cyan(webUrl)}`);

  if (rerouteFailure) {
    clack.log.error(rerouteFailure);
    clack.outro(pc.yellow("Upgrade complete, but the event reroute failed."));
    process.exit(1);
  }

  clack.outro(pc.green("Upgrade complete!"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = mri(process.argv.slice(2), {
    string: [
      "region",
      "web-domain",
      "ai-gateway-api-key",
      "ai-provider",
      "ai-model",
      "openai-api-key",
      "openai-base-url",
      "anthropic-api-key",
      "anthropic-base-url",
      "ai-region",
      "sentry-dsn",
    ],
    boolean: ["yes", "reroute-events"],
    alias: {
      y: "yes",
      "web-domain": "webDomain",
      "ai-gateway-api-key": "aiGatewayApiKey",
      "ai-provider": "aiProvider",
      "ai-model": "aiModel",
      "openai-api-key": "openaiApiKey",
      "openai-base-url": "openaiBaseUrl",
      "anthropic-api-key": "anthropicApiKey",
      "anthropic-base-url": "anthropicBaseUrl",
      "ai-region": "aiRegion",
      "sentry-dsn": "sentryDsn",
      "reroute-events": "rerouteEvents",
    },
  });
  upgrade({
    region: flags.region,
    webDomain: flags["web-domain"],
    aiGatewayApiKey: flags["ai-gateway-api-key"],
    aiProvider: flags["ai-provider"],
    aiModel: flags["ai-model"],
    openaiApiKey: flags["openai-api-key"],
    openaiBaseUrl: flags["openai-base-url"],
    anthropicApiKey: flags["anthropic-api-key"],
    anthropicBaseUrl: flags["anthropic-base-url"],
    aiRegion: flags["ai-region"],
    sentryDsn: flags["sentry-dsn"],
    yes: flags.yes,
    rerouteEvents: flags["reroute-events"],
  }).catch((err) => {
    clack.log.error(describeError(err));
    process.exit(1);
  });
}
