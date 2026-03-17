// Server-only query builders for events
// This file imports @wraps/db and must only be used in server components/actions

import { contact, contactEvent, escapeIlike } from "@wraps/db";
import { eq, gte, ilike, lte, type SQL, sql } from "drizzle-orm";
import type { ListEventsOptions } from "./events";

/**
 * Build search condition for events query.
 * Searches across event name, event data JSON, contact email, first name, and last name.
 */
export function buildEventsSearchCondition(search: string): SQL {
  const pattern = `%${escapeIlike(search)}%`;
  // Use parameterized SQL with explicit table.column references
  return sql`(
    "contact_event"."event_name" ILIKE ${pattern}
    OR "contact_event"."event_data"::text ILIKE ${pattern}
    OR "contact"."email" ILIKE ${pattern}
    OR COALESCE("contact"."first_name", '') ILIKE ${pattern}
    OR COALESCE("contact"."last_name", '') ILIKE ${pattern}
  )`;
}

/**
 * Build all filter conditions for events query.
 * Returns an array of SQL conditions to be combined with `and()`.
 */
export function buildEventsFilterConditions(
  organizationId: string,
  options: ListEventsOptions
): SQL[] {
  const { search, eventName, contactEmail, dateFrom, dateTo } = options;
  const conditions: SQL[] = [eq(contactEvent.organizationId, organizationId)];

  // Filter by specific event name
  if (eventName) {
    conditions.push(eq(contactEvent.eventName, eventName));
  }

  // Date range filters
  if (dateFrom) {
    conditions.push(gte(contactEvent.createdAt, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(contactEvent.createdAt, dateTo));
  }

  // Build search condition (search in eventName, eventData JSON, and contact fields)
  if (search) {
    conditions.push(buildEventsSearchCondition(search));
  }

  // Build contact email filter
  if (contactEmail) {
    conditions.push(ilike(contact.email, `%${escapeIlike(contactEmail)}%`));
  }

  return conditions;
}
