/**
 * Create every out-of-band index the schema declares but no migration creates.
 *
 * Run AFTER `db:migrate`:
 *   pnpm --filter @wraps/db db:migrate-indexes
 *
 * Safe to run any time — every statement is CONCURRENTLY + IF NOT EXISTS, so
 * it takes no blocking locks and re-runs cost nothing.
 *
 * Two failure modes this exists to make visible:
 *
 * 1. A transaction-mode pooler (PlanetScale PSBouncer :6432, PgBouncer) cannot
 *    run CREATE INDEX CONCURRENTLY. Set DATABASE_DIRECT_URL to the direct
 *    endpoint; resolveDirectDatabaseUrl warns when the URL looks pooled.
 *
 * 2. A CONCURRENTLY build that fails partway leaves an INVALID index behind.
 *    IF NOT EXISTS then silently skips it forever, so a green re-run can still
 *    mean no usable index — the planner ignores invalid ones. Hence the
 *    pg_index.indisvalid check rather than a mere existence check.
 *
 * Connect with `pg`, the same driver the app runtime and the selfhost migrator
 * use. @neondatabase/serverless speaks only to Neon's WebSocket proxy, so on any
 * other Postgres every statement here died in the handshake — reported, before
 * describeMigrationError learned to read event-style throwables, as the useless
 * `[object ErrorEvent]`. It is also a devDependency, absent from a production
 * self-hosted install.
 */

import dotenv from "dotenv";
import { Pool } from "pg";
import {
  describeMigrationError,
  migrationHint,
  resolveDirectDatabaseUrl,
} from "../src/connection-url";
import { CONCURRENT_INDEXES, INDEX_PREREQUISITES } from "./index-manifest";

dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../.env" });
// Self-hosted operators keep their config here, not in apps/web/.env.local.
dotenv.config({ path: "../../.env.selfhost" });

/** The failure plus the fix, when we recognize one. */
function describe(err: unknown): string {
  const description = describeMigrationError(err);
  const hint = migrationHint(description);
  return hint ? `${description}\n  ${hint}` : description;
}

let CONNECTION_STRING: string;
try {
  const resolved = resolveDirectDatabaseUrl();
  for (const note of resolved.notes) {
    console.warn(note);
  }
  CONNECTION_STRING = resolved.url;
} catch (err) {
  console.error(describe(err));
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: CONNECTION_STRING });
  const skipped = new Set<string>();
  const failed: string[] = [];

  try {
    for (const prereq of INDEX_PREREQUISITES) {
      try {
        await pool.query(prereq.ddl);
        console.log(`extension ${prereq.name} OK`);
      } catch (err) {
        // Managed providers can restrict extension creation. Skip what depends
        // on it and keep going — an unrelated index shouldn't be lost to this.
        console.warn(
          `extension ${prereq.name} FAILED: ${describe(err)}\n  skipping dependents: ${prereq.dependents.join(", ")}`
        );
        for (const dependent of prereq.dependents) {
          skipped.add(dependent);
        }
      }
    }

    for (const index of CONCURRENT_INDEXES) {
      if (skipped.has(index.name)) {
        continue;
      }
      try {
        console.log(`creating ${index.name} (CONCURRENTLY)...`);
        await pool.query(index.ddl);
      } catch (err) {
        console.error(`  ${index.name} FAILED: ${describe(err)}`);
        failed.push(index.name);
      }
    }

    // Validity, not existence. An invalid index exists in pg_class but the
    // planner will not use it, and IF NOT EXISTS will never replace it.
    const expected = CONCURRENT_INDEXES.map((i) => i.name).filter(
      (n) => !skipped.has(n)
    );
    const { rows } = await pool.query<{ relname: string; indisvalid: boolean }>(
      `SELECT c.relname, i.indisvalid
       FROM pg_class c
       JOIN pg_index i ON i.indexrelid = c.oid
       WHERE c.relname = ANY($1::text[])`,
      [expected]
    );

    const byName = new Map(rows.map((r) => [r.relname, r.indisvalid]));
    const missing = expected.filter((n) => !byName.has(n));
    const invalid = expected.filter((n) => byName.get(n) === false);

    console.log(
      `\n${expected.length - missing.length - invalid.length}/${expected.length} indexes present and valid.`
    );
    if (skipped.size > 0) {
      console.warn(`skipped (prerequisite failed): ${[...skipped].join(", ")}`);
    }
    if (missing.length > 0) {
      console.error(`MISSING: ${missing.join(", ")}`);
    }
    if (invalid.length > 0) {
      console.error(
        `INVALID (build failed partway; the planner ignores these): ${invalid.join(", ")}\n  Fix with: DROP INDEX CONCURRENTLY <name>;  then re-run.`
      );
    }

    if (missing.length > 0 || invalid.length > 0 || failed.length > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Index creation failed:", describe(err));
  process.exit(1);
});
