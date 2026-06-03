/**
 * Email log status filter: CONCURRENT index creation
 *
 * Adds a composite index on (organization_id, channel, sent_at) to cover the
 * /emails dashboard query, which filters by org + channel='email' + sent_at
 * time window (+ optional status). The existing message_send_org_created_idx
 * covers created_at, not sent_at, so status filters caused full org-table scans.
 *
 * drizzle-kit migrate wraps every migration in a transaction, which blocks
 * CREATE INDEX CONCURRENTLY. Run this script out-of-band against production.
 * Idempotent via IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm tsx packages/db/scripts/create-email-sent-at-idx.ts
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
    console.log(
      "Creating message_send_org_channel_sent_at_idx (CONCURRENTLY)..."
    );
    await pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "message_send_org_channel_sent_at_idx" ON "message_send" ("organization_id", "channel", "sent_at")`
    );
    console.log("  → message_send_org_channel_sent_at_idx OK");

    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'message_send_org_channel_sent_at_idx'`
    );

    if (rows.length === 0) {
      console.error("Verification failed: index not found after creation");
      process.exit(1);
    }

    console.log("\nIndex present. /emails status filter queries are now fast.");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
