import type { ConnectionMetadata } from "../shared/metadata.js";
import { saveConnectionMetadata } from "../shared/metadata.js";

/**
 * Strip trailing slashes from a base URL. Lambda Function URLs always carry a
 * trailing slash (`https://….on.aws/`), which would produce a double slash
 * (`//v1/connections`) when a path is appended — Elysia won't match that route
 * and returns 404. Normalizing at the source keeps every consumer's path
 * concatenation correct.
 */
export function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * SST v3 derives physical names as `{app}-{stage}-{logicalName}-{suffix}` where
 * the suffix is 8 random characters, so the function cannot be fetched by exact
 * name. List and match on the stable prefix instead.
 *
 * App name and stage are pinned by the deploy path: `infra/selfhost.config.ts`
 * sets `name: "wraps-selfhost"` and `scripts/selfhost/deploy.ts` always passes
 * `--stage production`. The observed shape is
 * `wraps-selfhost-production-SelfhostApiFunction-<suffix>` — match on the
 * prefix plus the logical-name substring rather than the full string, so a
 * change in how SST decorates the tail doesn't silently break recovery.
 */
const SST_FUNCTION_PREFIX = "wraps-selfhost-production-";
const SST_API_LOGICAL_NAME = "SelfhostApi";

/**
 * Resolve the live API URL for the self-hosted control plane directly from AWS
 * by scanning the account's Lambdas for the one the selfhost stack named.
 * Returns null when no deployment is found in the account/region, or when
 * credentials don't permit the lookup — recovery is always best-effort so
 * callers can fall back to their own error messaging.
 *
 * `ListFunctions` is paged — an account with many functions will not carry the
 * target on page one, so the whole listing must be walked or recovery fails
 * only on busy accounts.
 */
export async function resolveSelfhostApiUrl(
  region: string
): Promise<string | null> {
  try {
    const { LambdaClient, ListFunctionsCommand, GetFunctionUrlConfigCommand } =
      await import("@aws-sdk/client-lambda");
    const lambda = new LambdaClient({ region });

    const matches: string[] = [];
    let marker: string | undefined;
    do {
      const page = await lambda.send(
        new ListFunctionsCommand({ Marker: marker })
      );
      for (const fn of page.Functions ?? []) {
        const name = fn.FunctionName;
        // The Nextjs component ("SelfhostWeb") puts several Lambdas under the
        // same prefix; the logical name is what separates the API from them.
        if (
          name?.startsWith(SST_FUNCTION_PREFIX) &&
          name.includes(SST_API_LOGICAL_NAME)
        ) {
          matches.push(name);
        }
      }
      marker = page.NextMarker;
    } while (marker);

    // Never guess between candidates. Whatever URL comes back is where the CLI
    // POSTs the customer's control-plane API key, so no answer is strictly
    // safer than a wrong host.
    const match = matches.length === 1 ? matches[0] : undefined;
    if (!match) {
      return null;
    }

    const result = await lambda.send(
      new GetFunctionUrlConfigCommand({ FunctionName: match })
    );
    return result.FunctionUrl ? normalizeApiUrl(result.FunctionUrl) : null;
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
    return normalizeApiUrl(selfhost.apiUrl);
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
