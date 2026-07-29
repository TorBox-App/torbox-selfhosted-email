import { existsSync } from "node:fs";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureWrapsDir, getWrapsDir } from "./fs.js";

// ── URL Helpers ──

export function getApiBaseUrl(): string {
  return process.env.WRAPS_API_URL || "https://api.wraps.dev";
}

export function getAppBaseUrl(): string {
  return process.env.WRAPS_APP_URL || "https://app.wraps.dev";
}

export type OrgInfo = {
  id: string;
  name: string;
  slug: string;
};

export type SessionAuth = {
  token: string;
  tokenType: "session" | "api-key";
  expiresAt?: string;
  organizations?: OrgInfo[];
  // Self-hosted sessions record the instance's API URL next to the app URL
  // they're keyed by. Commands that talk to the control plane can then reach
  // it without AWS credentials — the URL otherwise only lives in connection
  // metadata, which is keyed by account + region.
  apiUrl?: string;
};

export type AuthConfig = {
  // SaaS (app.wraps.dev) session.
  auth?: SessionAuth;
  // Self-hosted sessions, keyed by the instance's app URL, so they coexist
  // with the SaaS session and with each other instead of sharing one slot.
  selfhost?: Record<string, SessionAuth>;
  // Which control plane every other command talks to: a `selfhost` key, or
  // absent for the SaaS. Whichever login ran last wins, so the two planes
  // coexist in one config without either guessing which one is meant.
  activeInstance?: string;
};

const CONFIG_FILE = "config.json";

function getConfigPath(): string {
  return join(getWrapsDir(), CONFIG_FILE);
}

export async function readAuthConfig(): Promise<AuthConfig | null> {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as AuthConfig;
  } catch {
    return null;
  }
}

export async function saveAuthConfig(config: AuthConfig): Promise<void> {
  await ensureWrapsDir();
  const path = getConfigPath();
  const existing = await readAuthConfig();
  const merged = existing ? { ...existing, ...config } : config;
  await writeFile(path, JSON.stringify(merged, null, 2), "utf-8");
  await chmod(path, 0o600);
}

export async function clearAuthConfig(): Promise<void> {
  const existing = await readAuthConfig();
  if (existing) {
    existing.auth = undefined;
    await saveAuthConfig(existing);
  }
}

// Self-hosted instances are identified by their app URL. Normalize so
// trailing-slash and case variants resolve to the same stored session.
export function normalizeInstanceKey(baseURL: string): string {
  return baseURL.trim().replace(/\/+$/, "").toLowerCase();
}

export async function saveSelfhostAuth(
  baseURL: string,
  auth: SessionAuth
): Promise<void> {
  const existing = await readAuthConfig();
  const selfhost = { ...existing?.selfhost };
  selfhost[normalizeInstanceKey(baseURL)] = auth;
  await saveAuthConfig({ ...existing, selfhost });
}

export async function readSelfhostAuth(
  baseURL: string
): Promise<SessionAuth | null> {
  const config = await readAuthConfig();
  return config?.selfhost?.[normalizeInstanceKey(baseURL)] ?? null;
}

export async function clearSelfhostAuth(baseURL: string): Promise<void> {
  const existing = await readAuthConfig();
  if (!existing?.selfhost) {
    return;
  }
  const key = normalizeInstanceKey(baseURL);
  delete existing.selfhost[key];
  // Signing out of the active instance hands the CLI back to the SaaS rather
  // than leaving it pointed at a plane it no longer has a session for.
  if (existing.activeInstance === key) {
    existing.activeInstance = undefined;
  }
  await saveAuthConfig(existing);
}

/**
 * Point subsequent commands at a self-hosted instance (by app URL) or, with
 * `null`, back at the Wraps SaaS.
 */
export async function setActiveInstance(baseURL: string | null): Promise<void> {
  const existing = (await readAuthConfig()) ?? {};
  existing.activeInstance = baseURL ? normalizeInstanceKey(baseURL) : undefined;
  await saveAuthConfig(existing);
}

/**
 * Resolve a usable token for a self-hosted instance. Honors an explicit
 * `--token` flag, otherwise reads the per-instance session and rejects
 * expired ones. Never falls back to the SaaS session or `WRAPS_API_KEY`.
 */
export async function resolveSelfhostToken(
  baseURL: string,
  flags?: { token?: string }
): Promise<string | null> {
  if (flags?.token) {
    return flags.token;
  }
  const session = await readSelfhostAuth(baseURL);
  if (!session?.token) {
    return null;
  }
  if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
    return null;
  }
  return session.token;
}

export function resolveToken(flags?: { token?: string }): string | null {
  return flags?.token || process.env.WRAPS_API_KEY || null;
}

export async function resolveTokenAsync(flags?: {
  token?: string;
}): Promise<string | null> {
  const sync = resolveToken(flags);
  if (sync) {
    return sync;
  }
  const config = await readAuthConfig();
  if (!config?.auth?.token) {
    return null;
  }
  if (config.auth.expiresAt && new Date(config.auth.expiresAt) <= new Date()) {
    return null;
  }
  return config.auth.token;
}
