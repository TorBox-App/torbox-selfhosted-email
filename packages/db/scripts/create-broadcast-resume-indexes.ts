/**
 * Broadcast Resume: CONCURRENT index creation
 *
 * drizzle-kit migrate wraps every migration in a transaction, which blocks
 * CREATE INDEX CONCURRENTLY. Run this script out-of-band AFTER applying
 * migrations 0052 + 0053, and BEFORE shipping the DLQ consumer. Idempotent
 * via IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm tsx packages/db/scripts/create-broadcast-resume-indexes.ts
 *
 * Verification:
 *   psql $DATABASE_URL -c '\d message_send'
 *   psql $DATABASE_URL -c '\d contact'
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
    console.log("Creating message_send_dedup_idx (CONCURRENTLY)...");
    await pool.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "message_send_dedup_idx" ON "message_send" ("batch_send_id", "contact_id") WHERE contact_id IS NOT NULL`
    );
    console.log("  → message_send_dedup_idx OK");

    console.log("Creating contact_keyset_idx (CONCURRENTLY)...");
    await pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "contact_keyset_idx" ON "contact" ("organization_id", "created_at", "id")`
    );
    console.log("  → contact_keyset_idx OK");

    const { rows: messageIdxRows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'message_send_dedup_idx'`
    );
    const { rows: contactIdxRows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'contact_keyset_idx'`
    );

    if (messageIdxRows.length === 0 || contactIdxRows.length === 0) {
      console.error(
        `Verification failed: message_send_dedup_idx=${messageIdxRows.length}, contact_keyset_idx=${contactIdxRows.length}`
      );
      process.exit(1);
    }

    console.log("\nBoth indexes present. Safe to deploy DLQ consumer.");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
