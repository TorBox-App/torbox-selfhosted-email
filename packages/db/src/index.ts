import { neonConfig, Pool } from "@neondatabase/serverless";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "./schema";

neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "" });
export const db = drizzle(pool, { schema });

export type DbOrTx =
  | typeof db
  | PgTransaction<
      NeonQueryResultHKT,
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
