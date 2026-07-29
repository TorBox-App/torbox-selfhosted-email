import { anthropicSpec } from "./providers/anthropic";
import { bedrockSpec } from "./providers/bedrock";
import { gatewaySpec } from "./providers/gateway";
import { noopSpec } from "./providers/noop";
import { openaiSpec } from "./providers/openai";
import {
  type ConfigIssue,
  createRegistry,
  memoizeAsync,
  type ProviderEnv,
} from "./registry";
import type { AIProvider, ModelRequest, ResolvedModel } from "./types";

export { DEFAULT_MODEL_KEY, MODEL_CATALOG } from "./catalog";
export type { ConfigIssue, ProviderEnv } from "./registry";
export { isProviderConfigError } from "./registry";
export type {
  AICapability,
  AIProvider,
  ModelRequest,
  ReasoningEffort,
  ResolvedModel,
} from "./types";

export const WRAPS_AI_PROVIDER_ENV = "WRAPS_AI_PROVIDER";

/**
 * Deployment mode, supplied by the caller — never read from the raw process env
 * by the app. `apps/web` derives it from the signed license key, so setting
 * WRAPS_DEPLOYMENT_MODE=self-hosted on Wraps Cloud achieves nothing.
 */
export const DEPLOYMENT_MODE_ENV = "WRAPS_DEPLOYMENT_MODE";

/**
 * Providers restricted to self-hosted deployments.
 *
 * Bedrock bills inference to the deployment's own AWS account, which only makes
 * sense when the customer owns that account.
 */
const SELF_HOSTED_ONLY = new Set(["bedrock"]);

export const aiRegistry = createRegistry<AIProvider>({
  domain: "AI provider",
  selectorEnvVar: WRAPS_AI_PROVIDER_ENV,
  defaultId: "gateway",
  specs: [gatewaySpec, openaiSpec, anthropicSpec, bedrockSpec, noopSpec],
  gate: (id, env) => {
    if (!SELF_HOSTED_ONLY.has(id)) {
      return;
    }
    if (env[DEPLOYMENT_MODE_ENV] === "self-hosted") {
      return;
    }
    return {
      code: "provider_requires_self_hosted",
      message: `The "${id}" AI provider is only available on self-hosted deployments. Wraps Cloud routes AI through the Vercel AI Gateway.`,
      envVars: [WRAPS_AI_PROVIDER_ENV, DEPLOYMENT_MODE_ENV],
    };
  },
});

/**
 * Pure. Run at boot to surface misconfiguration as one structured log line.
 *
 * Deliberately returns issues instead of throwing: bricking the dashboard over
 * an AI env typo is worse than degrading a single feature. Request paths throw
 * via `getAIModel` and degrade to a 503 there.
 */
export function validateAIConfig(env: ProviderEnv): readonly ConfigIssue[] {
  return aiRegistry.validate(env);
}

const resolveProvider = (env: ProviderEnv) =>
  memoizeAsync(() => aiRegistry.resolve(env));

const cache = new Map<string, () => Promise<AIProvider>>();

/**
 * Non-secret env vars that change which provider or model a resolution yields.
 *
 * Credentials are deliberately excluded — they must not become Map keys. A
 * rotated API key therefore needs `resetAIProviderCache()` or a restart, which
 * is already true of env vars under Lambda and Next.
 */
const CACHE_KEY_ENV = [
  WRAPS_AI_PROVIDER_ENV,
  "AI_MODEL",
  "OPENAI_BASE_URL",
] as const;

function providerFor(env: ProviderEnv): Promise<AIProvider> {
  // Keyed by every selector a spec reads at prepare() time, not just the
  // provider. `prepare` closes over AI_MODEL, so keying on the provider alone
  // would serve one pinned to a stale model. Per-org config would extend this
  // key rather than change the interface.
  const key = CACHE_KEY_ENV.map((name) => env[name] ?? "").join("|");
  let resolver = cache.get(key);
  if (!resolver) {
    resolver = resolveProvider(env);
    cache.set(key, resolver);
  }
  return resolver();
}

/**
 * Resolve a model for the configured provider.
 *
 * Throws `ProviderConfigError` when the deployment is misconfigured — callers
 * should catch with `isProviderConfigError` and return a 503.
 */
export async function getAIModel(
  request: ModelRequest = {},
  env: ProviderEnv = process.env
): Promise<ResolvedModel> {
  const provider = await providerFor(env);
  return provider.languageModel(request);
}

/** Test-only: drop memoized providers so env changes take effect. */
export function resetAIProviderCache(): void {
  cache.clear();
}
