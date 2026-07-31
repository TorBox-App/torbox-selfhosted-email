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
import { normalizeDatabaseUrl } from "../src/connection-url";

dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../.env" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is required. Export it or put it in apps/web/.env.local."
  );
  process.exit(1);
}

// The Neon driver bundles pg-connection-string, which readFileSync()s
// sslrootcert — a provider URL carrying `sslrootcert=system` dies with ENOENT
// before any SQL runs.
const CONNECTION_STRING = normalizeDatabaseUrl(DATABASE_URL).url;

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
