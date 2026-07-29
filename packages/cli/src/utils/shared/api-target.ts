import { normalizeApiUrl } from "../selfhost/api-url.js";
import type { AuthConfig, OrgInfo, SessionAuth } from "./config.js";
import {
  getApiBaseUrl,
  getAppBaseUrl,
  normalizeInstanceKey,
  readAuthConfig,
  resolveToken,
} from "./config.js";
import { listConnections } from "./metadata.js";

/**
 * Where a command should send control-plane requests, and with what token.
 *
 * Self-hosted customers sign in with `wraps selfhost login`, which stores a
 * per-instance session — not the SaaS slot. Every command that resolved a
 * token from the SaaS slot alone therefore reported "No API token" to a
 * customer who was signed in, and would have POSTed to api.wraps.dev even if
 * one had been found. Resolve both together so the URL and the credential can
 * never come from different planes.
 */
export type ApiTarget = {
  /** Base URL for API calls, or null when a self-hosted URL can't be found. */
  apiBase: string | null;
  /** Dashboard URL — for links and sign-in hints. */
  appUrl: string;
  token: string | null;
  tokenType?: "session" | "api-key";
  organizations?: OrgInfo[];
  selfhosted: boolean;
  loginCommand: string;
};

function unexpiredToken(session: SessionAuth | undefined): string | null {
  if (!session?.token) {
    return null;
  }
  if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
    return null;
  }
  return session.token;
}

/**
 * Which self-hosted instance (if any) this machine is currently pointed at.
 *
 * The stored pointer is authoritative. The fallback covers sessions saved
 * before the pointer existed: with no SaaS session to be ambiguous with and
 * exactly one instance signed in, there is only one plane it could mean — so
 * customers who already ran `selfhost login` don't have to run it again after
 * upgrading. Anything ambiguous stays on the SaaS, because silently retargeting
 * a SaaS user's push at a self-hosted plane is the worse failure.
 */
function pickInstance(config: AuthConfig | null): [string, SessionAuth] | null {
  const instances = config?.selfhost;
  if (!instances) {
    return null;
  }

  const active = config?.activeInstance;
  if (active) {
    const session = instances[active];
    return session ? [active, session] : null;
  }

  const keys = Object.keys(instances);
  if (config?.auth?.token || keys.length !== 1) {
    return null;
  }
  return [keys[0], instances[keys[0]]];
}

/**
 * Recover an instance's API URL from connection metadata for sessions stored
 * before `apiUrl` was saved alongside them. Matches on the app URL the session
 * is keyed by; needs no AWS calls, only the local metadata files.
 */
async function findSelfhostApiUrl(instanceKey: string): Promise<string | null> {
  const connections = await listConnections();
  for (const connection of connections) {
    const selfhost = connection.services?.selfhost;
    const appUrl = selfhost?.config?.appUrl;
    if (!(selfhost?.apiUrl && appUrl)) {
      continue;
    }
    if (normalizeInstanceKey(appUrl) === instanceKey) {
      return selfhost.apiUrl;
    }
  }
  return null;
}

export async function resolveApiTarget(flags?: {
  token?: string;
}): Promise<ApiTarget> {
  const config = await readAuthConfig();
  // An explicit WRAPS_API_URL is a deliberate override of where to send
  // requests, so it outranks the stored pointer.
  const instance = process.env.WRAPS_API_URL ? null : pickInstance(config);
  // `--token`/`WRAPS_API_KEY` win over any stored session, but they're read as
  // credentials for whichever plane is active — never as a reason to switch.
  const explicit = resolveToken(flags);
  const session = instance ? instance[1] : config?.auth;
  const token = explicit ?? unexpiredToken(session);
  const tokenType = explicit ? ("api-key" as const) : session?.tokenType;

  if (!instance) {
    return {
      apiBase: getApiBaseUrl(),
      appUrl: getAppBaseUrl(),
      token,
      tokenType,
      organizations: config?.auth?.organizations,
      selfhosted: false,
      loginCommand: "wraps auth login",
    };
  }

  const [instanceKey] = instance;
  const apiUrl = session?.apiUrl ?? (await findSelfhostApiUrl(instanceKey));

  return {
    apiBase: apiUrl ? normalizeApiUrl(apiUrl) : null,
    appUrl: instanceKey,
    token,
    tokenType,
    organizations: session?.organizations,
    selfhosted: true,
    loginCommand: "wraps selfhost login",
  };
}

/** A target with everything needed to make a call. */
export type UsableApiTarget = ApiTarget & { apiBase: string; token: string };

/**
 * Narrow a target to a usable one, or explain what's missing in the words of
 * whichever plane the CLI is pointed at. Callers compose `reason` with what
 * they're skipping.
 */
export function checkApiTarget(
  target: ApiTarget
):
  | { ok: true; target: UsableApiTarget }
  | { ok: false; reason: string; suggestion: string } {
  if (!target.token) {
    return {
      ok: false,
      reason: "No API token",
      suggestion: `Run: ${target.loginCommand}`,
    };
  }
  if (!target.apiBase) {
    return {
      ok: false,
      reason: `No API URL found for ${target.appUrl}`,
      suggestion: `Run: ${target.loginCommand}`,
    };
  }
  return {
    ok: true,
    target: target as UsableApiTarget,
  };
}
