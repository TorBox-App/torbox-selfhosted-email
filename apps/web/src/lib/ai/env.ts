import {
  DEPLOYMENT_MODE_ENV,
  type ProviderEnv,
  validateAIConfig,
} from "@wraps/ai";
import { logger } from "@/lib/logger";
import { isSelfHosted } from "@/lib/plan-limits";

/**
 * The env bag the AI provider registry resolves against.
 *
 * Deployment mode is derived from the signed license key via `isSelfHosted()`,
 * not read from the process env — so setting WRAPS_DEPLOYMENT_MODE=self-hosted
 * on Wraps Cloud cannot unlock a self-hosted-only provider like Bedrock.
 *
 * This lives in apps/web rather than in @wraps/ai because the package must not
 * depend on the dashboard's licensing code; the mode is passed in.
 */
export function aiEnv(): ProviderEnv {
  return {
    ...process.env,
    [DEPLOYMENT_MODE_ENV]: isSelfHosted() ? "self-hosted" : "saas",
  };
}

/**
 * Report AI misconfiguration once, at server start. Called from
 * `instrumentation.ts`.
 *
 * Logs rather than throws: bricking the whole dashboard over an AI env typo is
 * worse than degrading three routes, which already answer 503 on their own.
 * The point is that an operator learns about a bad WRAPS_AI_PROVIDER or
 * AI_MODEL from the boot log rather than from the first user who clicks
 * Generate.
 */
export function logAIConfigIssuesAtBoot(): void {
  const issues = validateAIConfig(aiEnv());
  if (issues.length === 0) {
    return;
  }

  logger.error(
    {
      event: "ai.config_invalid",
      // Spread out of the readonly tuples pino would otherwise serialize oddly.
      issues: issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        envVars: [...issue.envVars],
      })),
    },
    "AI provider is misconfigured — template and workflow AI will return 503"
  );
}
