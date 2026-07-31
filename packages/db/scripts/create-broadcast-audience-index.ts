/**
 * Broadcast Audience Chunking: CONCURRENT index creation
 *
 * drizzle-kit migrate wraps every migration in a transaction, which blocks
 * CREATE INDEX CONCURRENTLY. Run this script out-of-band AFTER applying
 * migration 0070, and BEFORE relying on contact_org_id_idx (e.g. before
 * running large broadcasts). Idempotent via IF NOT EXISTS.
 *
 * Without this index, getContactsChunk's `WHERE organization_id = ? AND
 * id > ? ORDER BY id LIMIT 50` query (apps/api/src/workers/batch-sender.ts)
 * falls back to a contact_pkey scan filtered by organization, reading rows
 * that belong to other tenants on every chunk.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm tsx packages/db/scripts/create-broadcast-audience-index.ts
 *
 * Verification:
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
    console.log("Creating contact_org_id_idx (CONCURRENTLY)...");
    await pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "contact_org_id_idx" ON "contact" ("organization_id", "id")`
    );
    console.log("  → contact_org_id_idx OK");

    const { rows: contactIdxRows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'contact_org_id_idx'`
    );

    if (contactIdxRows.length === 0) {
      console.error(
        `Verification failed: contact_org_id_idx=${contactIdxRows.length}`
      );
      process.exit(1);
    }

    console.log("\ncontact_org_id_idx present. Safe to run broadcasts.");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
