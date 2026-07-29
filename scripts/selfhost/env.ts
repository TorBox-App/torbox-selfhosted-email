import { chmod, readFile, writeFile } from "node:fs/promises";
// Both self-hosted variants publish the same auth-email config, so the
// discovery and the from-address rule live in packages/cli where the Pulumi
// variant's commands can reach them too.
import { resolveAuthEmailFrom } from "../../packages/cli/src/utils/selfhost/email-stack.js";

export function parseEnvFile(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx), l.slice(idx + 1)];
      })
  );
}

/**
 * Append vars that are not already present in the env file.
 * Falsy values are skipped. Returns the keys that were appended.
 */
export async function appendMissingEnvVars(
  envPath: string,
  vars: Record<string, string | null | undefined>
): Promise<string[]> {
  const content = await readFile(envPath, "utf-8");
  const existing = parseEnvFile(content);
  const missing = Object.entries(vars).filter(
    ([key, value]) => value && existing[key] === undefined
  );
  if (missing.length === 0) {
    return [];
  }
  const lines = missing.map(([key, value]) => `${key}=${value}`);
  await writeFile(
    envPath,
    `${content.trimEnd()}\n${lines.join("\n")}\n`,
    "utf-8"
  );
  await chmod(envPath, 0o600);
  return missing.map(([key]) => key);
}

/**
 * Set vars in the env file, replacing existing values.
 * Falsy values are skipped (never deletes).
 */
export async function upsertEnvVars(
  envPath: string,
  vars: Record<string, string | null | undefined>
): Promise<void> {
  const content = await readFile(envPath, "utf-8");
  let lines = content.trimEnd().split("\n");
  for (const [key, value] of Object.entries(vars)) {
    if (!value) {
      continue;
    }
    const line = `${key}=${value}`;
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx === -1) {
      lines = [...lines, line];
    } else {
      lines[idx] = line;
    }
  }
  await writeFile(envPath, `${lines.join("\n")}\n`, "utf-8");
  await chmod(envPath, 0o600);
}

/**
 * The deployment's own base URL for a configured web domain.
 *
 * No trailing slash, and it tolerates one being passed: CORS_ORIGIN is derived
 * from this value and ends up in better-auth's trustedOrigins, which is
 * compared against the browser's Origin header — and that never carries a
 * trailing slash. A stray one reads as a CORS failure with no useful error.
 */
export function appUrlForDomain(webDomain: string): string {
  const host = webDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${host}`;
}

/**
 * The env vars a deployed stack needs baked into the web build. Written after
 * the first `sst deploy` emits URLs, consumed by the next `sst deploy`.
 * NEXT_PUBLIC_APP_URL doubles as the completion marker for a finished deploy.
 */
export function buildDeployedEnvVars(options: {
  apiUrl: string;
  webUrl: string;
  webDomain?: string;
  emailStack: {
    roleArn: string | null;
    configSetName: string | null;
    verifiedDomains: string[];
  };
}): Record<string, string | null | undefined> {
  const { apiUrl, webUrl, webDomain, emailStack } = options;
  return {
    NEXT_PUBLIC_APP_URL: webUrl,
    WRAPS_API_URL: apiUrl,
    BETTER_AUTH_URL: webUrl,
    WRAPS_EMAIL_ROLE_ARN: emailStack.roleArn,
    AUTH_EMAIL_CONFIGURATION_SET: emailStack.configSetName,
    // No longer gated on the configuration set: that only adds event tracking,
    // and withholding the from-address because of it left auth email dead in
    // an account that could send perfectly well.
    AUTH_EMAIL_FROM: resolveAuthEmailFrom({
      webDomain,
      verifiedDomains: emailStack.verifiedDomains,
    }),
  };
}
