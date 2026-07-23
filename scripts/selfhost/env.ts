import { chmod, readFile, writeFile } from "node:fs/promises";
import { GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import {
  ListConfigurationSetsCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

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

export async function detectEmailStack(region: string): Promise<{
  roleArn: string | null;
  configSetName: string | null;
}> {
  try {
    const iam = new IAMClient({ region });
    const ses = new SESv2Client({ region });
    const [roleResult, setsResult] = await Promise.allSettled([
      iam.send(new GetRoleCommand({ RoleName: "wraps-email-role" })),
      ses.send(new ListConfigurationSetsCommand({})),
    ]);
    const roleArn =
      roleResult.status === "fulfilled"
        ? (roleResult.value.Role?.Arn ?? null)
        : null;
    const sets =
      setsResult.status === "fulfilled"
        ? (setsResult.value.ConfigurationSets ?? []).filter((n) =>
            n.startsWith("wraps-email-")
          )
        : [];
    const configSetName =
      sets.find((n) => n !== "wraps-email-tracking") ?? sets[0] ?? null;
    return { roleArn, configSetName };
  } catch {
    return { roleArn: null, configSetName: null };
  }
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
  emailStack: { roleArn: string | null; configSetName: string | null };
}): Record<string, string | null | undefined> {
  const { apiUrl, webUrl, webDomain, emailStack } = options;
  return {
    NEXT_PUBLIC_APP_URL: webUrl,
    WRAPS_API_URL: apiUrl,
    BETTER_AUTH_URL: webUrl,
    WRAPS_EMAIL_ROLE_ARN: emailStack.roleArn,
    AUTH_EMAIL_CONFIGURATION_SET: emailStack.configSetName,
    AUTH_EMAIL_FROM:
      emailStack.configSetName && webDomain ? `noreply@${webDomain}` : null,
  };
}
