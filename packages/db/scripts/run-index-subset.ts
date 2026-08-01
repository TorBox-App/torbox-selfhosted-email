/**
 * Shared entry point for the per-area index scripts.
 *
 * Runs a named subset of the manifest, pulling in any prerequisite the subset
 * depends on. `migrate-indexes.ts` runs the whole set; these exist so a single
 * area can be re-run, and because migration `-- NOTE:` comments name them.
 *
 * Uses `pg` for the same reason migrate-indexes.ts does: the Neon serverless
 * driver only reaches Neon's WebSocket proxy, so it cannot connect to a
 * self-hosted Postgres at all.
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

export function runIndexSubset(names: string[]): void {
  let connectionString: string;
  try {
    const resolved = resolveDirectDatabaseUrl();
    for (const note of resolved.notes) {
      console.warn(note);
    }
    connectionString = resolved.url;
  } catch (err) {
    console.error(describe(err));
    process.exit(1);
  }

  const wanted = CONCURRENT_INDEXES.filter((i) => names.includes(i.name));
  const unknown = names.filter(
    (n) => !CONCURRENT_INDEXES.some((i) => i.name === n)
  );
  if (unknown.length > 0) {
    console.error(`Not in the index manifest: ${unknown.join(", ")}`);
    process.exit(1);
  }

  // Only the prerequisites this subset actually needs.
  const prereqs = INDEX_PREREQUISITES.filter((p) =>
    p.dependents.some((d) => names.includes(d))
  );

  (async () => {
    const pool = new Pool({ connectionString });
    try {
      for (const prereq of prereqs) {
        await pool.query(prereq.ddl);
        console.log(`extension ${prereq.name} OK`);
      }

      for (const index of wanted) {
        console.log(`creating ${index.name} (CONCURRENTLY)...`);
        await pool.query(index.ddl);
      }

      // Validity, not existence: a CONCURRENTLY build that fails partway
      // leaves an invalid index that IF NOT EXISTS then skips forever.
      const { rows } = await pool.query<{
        relname: string;
        indisvalid: boolean;
      }>(
        `SELECT c.relname, i.indisvalid
         FROM pg_class c
         JOIN pg_index i ON i.indexrelid = c.oid
         WHERE c.relname = ANY($1::text[])`,
        [names]
      );
      const byName = new Map(rows.map((r) => [r.relname, r.indisvalid]));
      const bad = names.filter((n) => byName.get(n) !== true);

      if (bad.length > 0) {
        console.error(
          `Missing or invalid after creation: ${bad.join(", ")}\n  For an invalid index: DROP INDEX CONCURRENTLY <name>;  then re-run.`
        );
        process.exit(1);
      }
      console.log(`\n${names.length}/${names.length} present and valid.`);
    } finally {
      await pool.end();
    }
  })().catch((err) => {
    console.error("Index creation failed:", describe(err));
    process.exit(1);
  });
}
