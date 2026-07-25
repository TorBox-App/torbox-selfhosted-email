import { join } from "node:path";
import * as clack from "@clack/prompts";
import {
  assertPostgresUrl,
  describeMigrationFailure,
  normalizeDatabaseUrl,
} from "../../packages/db/src/connection-url.js";
import { REPO_ROOT } from "./subprocess.js";

// Re-exported for the tests that pin the hint table against real pg failures.
export { migrationHint } from "../../packages/db/src/connection-url.js";

const MIGRATIONS_FOLDER = join(
  REPO_ROOT,
  "packages",
  "db",
  "src",
  "migrations"
);

/**
 * Apply pending Drizzle migrations against the self-hosted database.
 *
 * Runs on deploy as well as upgrade: better-auth writes to tables that only
 * exist after this, so a deployment that skips migrations looks completely
 * broken at the first signup.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  assertPostgresUrl(databaseUrl);
  const { url, notes } = normalizeDatabaseUrl(databaseUrl);
  for (const note of notes) {
    clack.log.info(note);
  }

  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } catch (error) {
    // No `cause` — describeMigrationFailure already flattens the whole chain,
    // and re-attaching it makes the top-level handler print it twice.
    throw new Error(describeMigrationFailure(error));
  } finally {
    await pool.end();
  }
}

/**
 * Run migrations with the console output shared by deploy and upgrade.
 */
export async function migrateWithProgress(
  databaseUrl: string | undefined
): Promise<void> {
  if (!databaseUrl) {
    clack.log.warn(
      "DATABASE_URL not found in metadata or .env.selfhost — skipping database migrations."
    );
    return;
  }

  clack.log.step("Running database migrations...");
  await runMigrations(databaseUrl);
  clack.log.success("Database migrations applied.");
}
