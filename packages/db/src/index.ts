import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "" });
export const db = drizzle(pool, { schema });

export type DbOrTx =
  | typeof db
  | PgTransaction<
      NodePgQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;

// Re-export commonly used drizzle-orm operators
export { and, desc, eq, or, sql as sqlExpr } from "drizzle-orm";

/**
 * Escape ILIKE special characters to prevent wildcard injection.
 * Use before interpolating user input into ILIKE patterns.
 */
export function escapeIlike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}
// Re-export repositories
export * from "./repositories";
// Re-export all schemas for use elsewhere
export * from "./schema";
// Re-export segment evaluator (SQL-based)
export {
  contactIdsMatchingCondition,
  contactMatchesCondition,
  getSegmentsByIds,
} from "./segment-evaluator";
// Re-export segment filter SQL builder
export { buildConditionSQL, buildFilterSQL } from "./segment-filter";
