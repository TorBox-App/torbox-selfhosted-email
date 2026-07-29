import { randomBytes } from "node:crypto";
import { access, chmod, readFile, writeFile } from "node:fs/promises";
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
import { assertPostgresUrl } from "../../packages/db/src/connection-url.js";
import { resolveDnsConfig } from "./dns.js";
import { appendMissingEnvVars, buildDeployedEnvVars } from "./env.js";
import { describeError } from "./errors.js";
import { migrateWithProgress } from "./migrate.js";
import { rerouteEmailEvents, sesEventsWebhookUrl } from "./reroute.js";
import { REPO_ROOT, runSubprocess } from "./subprocess.js";
import { provisionTemplatesWithProgress } from "./templates.js";

const ENV_PATH = join(REPO_ROOT, ".env.selfhost");
const SST_DIR = join(REPO_ROOT, "infra");
const SST_CONFIG = "selfhost.config.ts";
const OUTPUTS_PATH = join(REPO_ROOT, "infra", ".sst", "outputs.json");

export type DeployOptions = {
  databaseUrl?: string;
  licenseKey?: string;
  region?: string;
  webDomain?: string;
  dnsProvider?: string;
  cloudflareApiToken?: string;
  cloudflareZoneId?: string;
  acmCertArn?: string;
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

  // Check the connection string before the 10-minute SST deploy, not after —
  // and before .env.selfhost is written, since its existence blocks a retry.
  try {
    assertPostgresUrl(databaseUrl);
  } catch (error) {
    clack.log.error(describeError(error));
    process.exit(1);
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
  const dns = await resolveDnsConfig(options);
  if (options.webDomain) {
    envLines.push(`SELFHOST_DNS_PROVIDER=${dns.provider}`);
    envLines.push(...dns.envLines);
  }
  if (options.aiGatewayApiKey)
    envLines.push(`AI_GATEWAY_API_KEY=${options.aiGatewayApiKey}`);
  // Selects which inference backend serves the template and workflow AI.
  // Defaults to the Vercel AI Gateway when unset.
  if (options.aiProvider)
    envLines.push(`WRAPS_AI_PROVIDER=${options.aiProvider}`);
  if (options.openaiApiKey)
    envLines.push(`OPENAI_API_KEY=${options.openaiApiKey}`);
  if (options.openaiBaseUrl)
    envLines.push(`OPENAI_BASE_URL=${options.openaiBaseUrl}`);
  if (options.anthropicApiKey)
    envLines.push(`ANTHROPIC_API_KEY=${options.anthropicApiKey}`);
  if (options.anthropicBaseUrl)
    envLines.push(`ANTHROPIC_BASE_URL=${options.anthropicBaseUrl}`);
  if (options.aiRegion) envLines.push(`WRAPS_AI_REGION=${options.aiRegion}`);
  if (options.aiModel) envLines.push(`AI_MODEL=${options.aiModel}`);
  // Flag only, never `process.env.SENTRY_DSN` — inheriting an ambient DSN from
  // the operator's shell would point a customer's error stream at whoever ran
  // the deploy. Opting in has to be explicit.
  if (options.sentryDsn) envLines.push(`SENTRY_DSN=${options.sentryDsn}`);

  await writeFile(ENV_PATH, `${envLines.join("\n")}\n`, "utf-8");
  await chmod(ENV_PATH, 0o600);
  clack.log.info("Wrote .env.selfhost");

  const sstEnv = {
    SELFHOST_AWS_REGION: region,
    ...(options.webDomain && { SELFHOST_DNS_PROVIDER: dns.provider }),
    ...dns.sstEnv,
  };

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
  // Normalized at the read site, not at each write: this one value becomes
  // WRAPS_API_URL in .env.selfhost, the apiUrl in connection metadata, and the
  // SES reroute target. SST emits a Lambda Function URL, which always ends in
  // `/`, and every consumer appends a path to it — `…on.aws//webhooks/ses/{id}`
  // is a route the API does not have, so events POST into a 404.
  const apiUrl: string = normalizeApiUrl(
    outputs.SelfhostApi?.url ?? outputs.apiUrl ?? ""
  );
  const webUrl: string = outputs.SelfhostWeb?.url ?? outputs.webUrl ?? "";

  if (!apiUrl) {
    clack.log.error(
      "SST deploy did not emit an API URL. Check the selfhost.config.ts outputs."
    );
    process.exit(1);
  }

  // An empty webUrl is silently corrosive: appendMissingEnvVars skips falsy
  // values, so NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL never reach .env.selfhost,
  // the second pass still runs (WRAPS_API_URL alone was appended) and reports
  // success, and the deployed API is left permanently unable to build a link.
  if (!webUrl) {
    clack.log.error(
      "SST deploy did not emit a web URL. Check the selfhost.config.ts outputs."
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
      ...(options.sentryDsn && { sentryDsn: options.sentryDsn }),
    },
    apiUrl,
    webUrl,
    deployedAt: now,
    variant: "sst",
  };
  metadata.timestamp = now;
  await saveConnectionMetadata(metadata);

  // Post-deploy steps run against live infrastructure and can fail on their
  // own (unreachable database, missing Pulumi CLI). Collect their failures
  // instead of throwing: the stack is already up, and the operator needs the
  // URLs and the remediation more than they need a stack trace.
  const failures: string[] = [];

  // better-auth signup writes to tables that only exist after this runs — a
  // deploy that skips migrations looks completely broken at the first signup.
  try {
    await migrateWithProgress(databaseUrl);
  } catch (error) {
    failures.push(
      `${describeError(error)}\nRe-run ${pc.cyan("pnpm selfhost:upgrade")} once the database is reachable — until migrations apply, signup and login will fail.`
    );
  }

  // The auth email senders address these templates by name. On the SaaS
  // platform they were created once by hand; nothing creates them in a fresh
  // account, so without this the whole send path is wired and still dies on
  // "Template email-verification does not exist" at the first signup.
  await provisionTemplatesWithProgress(region);

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
      try {
        clack.log.step("Rerouting email events to selfhost API...");
        await rerouteEmailEvents({
          metadata,
          accountId: identity.accountId,
          region,
          apiUrl,
        });
        clack.log.success("Email events rerouted to self-hosted API");
      } catch (error) {
        failures.push(
          `Could not reroute email events: ${describeError(error)}\nThe control plane itself deployed fine — SES events just still go to the Wraps platform rather than ${pc.cyan(sesEventsWebhookUrl(apiUrl))}. Retry with ${pc.cyan("pnpm selfhost:upgrade --reroute-events")}.`
        );
      }
    }
  }

  clack.log.info(`API: ${pc.cyan(apiUrl)}`);
  clack.log.info(`Web: ${pc.cyan(webUrl)}`);

  if (failures.length > 0) {
    for (const failure of failures) {
      clack.log.error(failure);
    }
    clack.outro(
      pc.yellow("Infrastructure deployed, but post-deploy steps failed.")
    );
    process.exit(1);
  }

  clack.outro(pc.green("Self-hosted deployment complete!"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = mri(process.argv.slice(2), {
    string: [
      "database-url",
      "license-key",
      "region",
      "web-domain",
      "dns-provider",
      "cloudflare-api-token",
      "cloudflare-zone-id",
      "acm-cert-arn",
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
      "database-url": "databaseUrl",
      "license-key": "licenseKey",
      "web-domain": "webDomain",
      "dns-provider": "dnsProvider",
      "cloudflare-api-token": "cloudflareApiToken",
      "cloudflare-zone-id": "cloudflareZoneId",
      "acm-cert-arn": "acmCertArn",
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
  deploy({
    databaseUrl: flags["database-url"],
    licenseKey: flags["license-key"],
    region: flags.region,
    webDomain: flags["web-domain"],
    dnsProvider: flags["dns-provider"],
    cloudflareApiToken: flags["cloudflare-api-token"],
    cloudflareZoneId: flags["cloudflare-zone-id"],
    acmCertArn: flags["acm-cert-arn"],
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
