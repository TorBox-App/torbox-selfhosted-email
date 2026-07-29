import { DEPLOYMENT_MODE_ENV, type ProviderEnv } from "@wraps/ai";
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
