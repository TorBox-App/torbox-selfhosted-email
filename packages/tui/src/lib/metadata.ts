import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ConnectionMetadata } from "../types";

function getConnectionsDir(): string {
  return join(homedir(), ".wraps", "connections");
}

function getMetadataPath(accountId: string, region: string): string {
  return join(getConnectionsDir(), `${accountId}-${region}.json`);
}

export async function loadConnectionMetadata(
  accountId: string,
  region: string
): Promise<ConnectionMetadata | null> {
  const metadataPath = getMetadataPath(accountId, region);

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = await readFile(metadataPath, "utf-8");
    const data = JSON.parse(content) as Record<string, unknown>;

    // Handle legacy format (has emailConfig but no services)
    if ("emailConfig" in data && !("services" in data)) {
      return {
        version: "1.0.0",
        accountId: data.accountId as string,
        region: data.region as string,
        provider: data.provider as string,
        timestamp: data.timestamp as string,
        services: {
          email: {
            preset: data.preset as string | undefined,
            config: data.emailConfig as Record<string, unknown>,
            pulumiStackName: data.pulumiStackName as string | undefined,
            deployedAt: data.timestamp as string,
          },
        },
      };
    }

    return data as unknown as ConnectionMetadata;
  } catch {
    return null;
  }
}
