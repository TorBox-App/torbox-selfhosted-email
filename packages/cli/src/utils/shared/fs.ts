import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Get the Wraps configuration directory
 */
export function getWrapsDir(): string {
  return join(homedir(), ".wraps");
}

/**
 * Get the Pulumi workspace directory
 */
export function getPulumiWorkDir(): string {
  return join(getWrapsDir(), "pulumi");
}

/**
 * Ensure the Wraps configuration directory exists
 */
export async function ensureWrapsDir(): Promise<void> {
  const wrapsDir = getWrapsDir();
  if (!existsSync(wrapsDir)) {
    await mkdir(wrapsDir, { recursive: true });
  }
}

/**
 * Clear Pulumi stack lock files from the local backend.
 * Recursively finds and deletes .json files under ~/.wraps/pulumi/.pulumi/locks/.
 * Returns the number of locks cleared.
 */
export async function clearLocalStackLocks(): Promise<number> {
  const locksDir = join(getPulumiWorkDir(), ".pulumi", "locks");
  if (!existsSync(locksDir)) {
    return 0;
  }

  let count = 0;

  async function walkAndDelete(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkAndDelete(fullPath);
      } else if (entry.name.endsWith(".json")) {
        await rm(fullPath);
        count++;
      }
    }
  }

  await walkAndDelete(locksDir);
  return count;
}

/**
 * Ensure the Pulumi workspace directory exists and configure backend.
 *
 * When accountId and region are provided (and WRAPS_LOCAL_ONLY is not set),
 * uses S3 as the state backend for multi-machine/team workflows.
 * Falls back to local file backend on S3 errors or when no params given.
 */
export async function ensurePulumiWorkDir(options?: {
  accountId?: string;
  region?: string;
}): Promise<void> {
  await ensureWrapsDir();
  const pulumiDir = getPulumiWorkDir();
  if (!existsSync(pulumiDir)) {
    await mkdir(pulumiDir, { recursive: true });
  }

  // Always set passphrase
  process.env.PULUMI_CONFIG_PASSPHRASE = "";

  // Pre-resolve AWS credentials into env vars before spawning Pulumi.
  // Pulumi's S3 state backend (gocloud.dev) uses AWS Go SDK v1, which has
  // no SSO support. Without this, SSO users hit NoCredentialProviders even
  // though their JS SDK v3 calls work fine. See aws.ts for details.
  if (options?.accountId && options?.region) {
    const { resolveAWSCredentialsToEnv } = await import("./aws.js");
    await resolveAWSCredentialsToEnv();
  }

  const useS3 =
    options?.accountId &&
    options?.region &&
    process.env.WRAPS_LOCAL_ONLY !== "1";

  if (useS3) {
    try {
      const {
        ensureStateBucket,
        getS3BackendUrl,
        needsMigration,
        migrateLocalPulumiState,
      } = await import("./s3-state.js");

      const bucketName = await ensureStateBucket(
        options.accountId!,
        options.region!
      );

      // Check if local state needs to be migrated
      const shouldMigrate = await needsMigration(
        pulumiDir,
        options.accountId!,
        options.region!
      );

      if (shouldMigrate) {
        // Temporarily set local backend for export
        process.env.PULUMI_BACKEND_URL = `file://${pulumiDir}`;

        await migrateLocalPulumiState(
          pulumiDir,
          bucketName,
          options.accountId!,
          options.region!
        );
      }

      // Set S3 backend
      process.env.PULUMI_BACKEND_URL = getS3BackendUrl(
        options.accountId!,
        options.region!
      );
      return;
    } catch (error) {
      // Graceful fallback to local
      const clack = await import("@clack/prompts");
      clack.log.warn(
        `S3 state backend unavailable (${error instanceof Error ? error.message : error}). Using local state.`
      );
    }
  }

  // Default: local backend
  process.env.PULUMI_BACKEND_URL = `file://${pulumiDir}`;
}
