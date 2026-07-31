/**
 * Email Search: pg_trgm extension + CONCURRENT index creation
 *
 * Thin wrapper: creates only this script's subset of the out-of-band indexes.
 * The DDL lives in ./index-manifest.ts — the single source of truth shared with
 * migrate-indexes.ts, which runs the whole set. Kept as its own entry point
 * because migration `-- NOTE:` comments point here by name.
 *
 * Prefer `pnpm --filter @wraps/db db:migrate-indexes` unless you specifically
 * want to re-run just these.
 *
 * Usage:
 *   pnpm --filter @wraps/db exec tsx scripts/create-email-search-indexes.ts
 */

import { runIndexSubset } from "./run-index-subset";

runIndexSubset([
  "message_send_search_recipient_trgm_idx",
  "message_send_search_subject_trgm_idx",
  "message_send_search_from_trgm_idx",
]);
