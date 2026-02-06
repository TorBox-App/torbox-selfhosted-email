import { existsSync } from "node:fs";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureWrapsDir, getWrapsDir } from "./fs.js";

export type OrgInfo = {
  id: string;
  name: string;
  slug: string;
};

type AuthConfig = {
  auth?: {
    token: string;
    tokenType: "session" | "api-key";
    expiresAt?: string;
    organizations?: OrgInfo[];
  };
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
  await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
  await chmod(path, 0o600);
}

export async function clearAuthConfig(): Promise<void> {
  const existing = await readAuthConfig();
  if (existing) {
    existing.auth = undefined;
    await saveAuthConfig(existing);
  }
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
  return config?.auth?.token || null;
}
