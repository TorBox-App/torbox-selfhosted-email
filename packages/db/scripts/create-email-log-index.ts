/**
 * Email log pagination: CONCURRENT index creation
 *
 * drizzle-kit migrate wraps every migration in a transaction, which blocks
 * CREATE INDEX CONCURRENTLY. Run this script out-of-band AFTER applying the
 * migration that declares message_send_org_created_idx, and BEFORE shipping
 * the email logs endpoint. Idempotent via IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm tsx packages/db/scripts/create-email-log-index.ts
 *
 * Verification:
 *   psql $DATABASE_URL -c '\d message_send'
 */

import { Pool } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { resolveDirectDatabaseUrl } from "../src/connection-url";

dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../.env" });
// Self-hosted operators keep their config here, not in apps/web/.env.local.
dotenv.config({ path: "../../.env.selfhost" });

// Prefers DATABASE_DIRECT_URL. CREATE INDEX CONCURRENTLY cannot run through a
// transaction-mode pooler, and resolveDirectDatabaseUrl warns when the URL
// looks pooled. It also strips `sslrootcert=system`, which node-postgres would
// otherwise read as a filename and die with ENOENT before any SQL runs.
let CONNECTION_STRING: string;
try {
  const resolved = resolveDirectDatabaseUrl();
  for (const note of resolved.notes) {
    console.warn(note);
  }
  CONNECTION_STRING = resolved.url;
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: CONNECTION_STRING });

  try {
    console.log("Creating message_send_org_created_idx (CONCURRENTLY)...");
    await pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "message_send_org_created_idx" ON "message_send" ("organization_id", "created_at")`
    );
    console.log("  → message_send_org_created_idx OK");

    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'message_send_org_created_idx'`
    );

    if (rows.length === 0) {
      console.error(
        "Verification failed: message_send_org_created_idx not found"
      );
      process.exit(1);
    }

    console.log("\nIndex present. Safe to deploy email logs endpoint.");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
