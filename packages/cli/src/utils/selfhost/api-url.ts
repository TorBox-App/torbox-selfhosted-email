import type { ConnectionMetadata } from "../shared/metadata.js";
import { saveConnectionMetadata } from "../shared/metadata.js";

/**
 * Name of the self-hosted control-plane Lambda created by `selfhost deploy`.
 * The Lambda's Function URL is the source of truth for the API endpoint —
 * connection metadata only caches it.
 */
export const SELFHOST_API_FUNCTION_NAME = "wraps-selfhost-api";

/**
 * Resolve the live API URL for the self-hosted control plane directly from AWS.
 * Returns null when the function (or its URL) does not exist in the
 * account/region, or when credentials don't permit the lookup — recovery is
 * always best-effort so callers can fall back to their own error messaging.
 */
export async function resolveSelfhostApiUrl(
  region: string
): Promise<string | null> {
  try {
    const { LambdaClient, GetFunctionUrlConfigCommand } = await import(
      "@aws-sdk/client-lambda"
    );
    const lambda = new LambdaClient({ region });
    const result = await lambda.send(
      new GetFunctionUrlConfigCommand({
        FunctionName: SELFHOST_API_FUNCTION_NAME,
      })
    );
    return result.FunctionUrl ?? null;
    // baseline:allow-next-line no-swallowed-errors — recovery is best-effort
  } catch {
    return null;
  }
}

/**
 * Return the self-hosted API URL, reconciling a stale or empty metadata cache
 * against AWS. When metadata records a deployment but has no `apiUrl` (e.g. an
 * interrupted deploy wiped it), the live Function URL is fetched and written
 * back so every subsequent command sees the correct value.
 *
 * Mutates and persists the passed `metadata` in place when a URL is recovered.
 * Returns null only when there is genuinely no resolvable deployment.
 */
export async function reconcileSelfhostApiUrl(
  metadata: ConnectionMetadata,
  region: string
): Promise<string | null> {
  const selfhost = metadata.services.selfhost;
  if (!selfhost) {
    return null;
  }
  if (selfhost.apiUrl) {
    return selfhost.apiUrl;
  }

  const recovered = await resolveSelfhostApiUrl(region);
  if (!recovered) {
    return null;
  }

  selfhost.apiUrl = recovered;
  metadata.timestamp = new Date().toISOString();
  await saveConnectionMetadata(metadata);
  return recovered;
}
