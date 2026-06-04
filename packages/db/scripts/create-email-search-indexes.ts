/**
 * Email search: pg_trgm extension + CONCURRENT GIN index creation
 *
 * Enables pg_trgm and creates trigram GIN indexes on recipient, subject, and
 * from so that ILIKE '%query%' searches on the /emails page hit an index
 * instead of doing a full table scan.
 *
 * drizzle-kit wraps migrations in a transaction, which blocks both
 * CREATE EXTENSION and CREATE INDEX CONCURRENTLY. Run this out-of-band.
 * Idempotent via IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm tsx packages/db/scripts/create-email-search-indexes.ts
 *
 * Verification:
 *   psql $DATABASE_URL -c '\d message_send'
 */

import { Pool } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../.env" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is required. Export it or put it in apps/web/.env.local."
  );
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("Enabling pg_trgm extension...");
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    console.log("  → pg_trgm OK");

    console.log(
      "Creating message_send_search_recipient_trgm_idx (CONCURRENTLY)..."
    );
    await pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "message_send_search_recipient_trgm_idx" ON "message_send" USING gin (recipient gin_trgm_ops)`
    );
    console.log("  → message_send_search_recipient_trgm_idx OK");

    console.log(
      "Creating message_send_search_subject_trgm_idx (CONCURRENTLY)..."
    );
    await pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "message_send_search_subject_trgm_idx" ON "message_send" USING gin (subject gin_trgm_ops) WHERE subject IS NOT NULL`
    );
    console.log("  → message_send_search_subject_trgm_idx OK");

    console.log("Creating message_send_search_from_trgm_idx (CONCURRENTLY)...");
    await pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "message_send_search_from_trgm_idx" ON "message_send" USING gin ("from" gin_trgm_ops) WHERE "from" IS NOT NULL`
    );
    console.log("  → message_send_search_from_trgm_idx OK");

    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname IN (
        'message_send_search_recipient_trgm_idx',
        'message_send_search_subject_trgm_idx',
        'message_send_search_from_trgm_idx'
      )`
    );

    if (rows.length < 3) {
      console.error(
        `Verification failed: expected 3 indexes, found ${rows.length}. Re-run the script to resume — all operations are idempotent.`
      );
      process.exit(1);
    }

    console.log(
      "\nAll search indexes present. /emails search queries are now fast."
    );
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
