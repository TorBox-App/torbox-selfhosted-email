import { getApiBaseUrl, readAuthConfig, resolveTokenAsync } from "./config.js";

export type ApiCall = (
  path: string,
  body?: Record<string, unknown>
) => Promise<Response>;

export type AgentApiClient =
  | { ok: true; get: ApiCall; post: ApiCall }
  | { ok: false; reason: string };

/**
 * Thin authenticated client for the Wraps Platform API. Mirrors the auth
 * mechanism used by `email logs` (Bearer token from `resolveTokenAsync`) and
 * adds `X-Organization-Id` when a single org is resolvable, matching
 * `platform connect`. API keys (`wraps_*`) derive the org server-side, so the
 * header is a no-op for them.
 */
export async function createAgentApiClient(
  tokenFlag?: string
): Promise<AgentApiClient> {
  const token = await resolveTokenAsync({ token: tokenFlag });
  if (!token) {
    return { ok: false, reason: "not-authenticated" };
  }

  const apiBase = getApiBaseUrl();
  const orgHeader: Record<string, string> = {};
  const orgs = (await readAuthConfig())?.auth?.organizations;
  if (orgs && orgs.length === 1) {
    orgHeader["X-Organization-Id"] = orgs[0].id;
  }

  const call: (method: string) => ApiCall = (method) => (path, body) =>
    fetch(`${apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...orgHeader,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  return { ok: true, get: call("GET"), post: call("POST") };
}

export async function parseAgentApiError(resp: Response): Promise<string> {
  const data = (await resp.json().catch(() => ({}))) as { error?: string };
  return data.error ?? `HTTP ${resp.status}`;
}
