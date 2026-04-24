/**
 * Segment Filter SQL Builder
 *
 * Pure SQL builder functions that translate segment FilterCondition trees
 * into Drizzle SQL fragments. No database dependency — only builds SQL.
 *
 * Used by both the web dashboard (server actions) and the batch sender (Lambda worker).
 */

import { and, or, type SQL, sql } from "drizzle-orm";
import type { FilterCondition, SegmentFilter } from "./schema/segments";

const VALID_UNITS = new Set(["days", "hours", "minutes"]);

function validateInterval(
  value: unknown,
  unit: string | undefined
): string | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
    return null;
  }
  if (unit && !VALID_UNITS.has(unit)) {
    return null;
  }
  const resolvedUnit = unit && VALID_UNITS.has(unit) ? unit : "days";
  return `${num} ${resolvedUnit}`;
}

const COLUMN_MAP: Record<string, string> = {
  status: "status",
  email: "email",
  lastActivityAt: "last_activity_at",
  lastEmailSentAt: "last_email_sent_at",
  lastEmailOpenedAt: "last_email_opened_at",
  lastEmailClickedAt: "last_email_clicked_at",
  emailsSent: "emails_sent",
  emailsOpened: "emails_opened",
  emailsClicked: "emails_clicked",
  createdAt: "created_at",
  confirmedAt: "confirmed_at",
};

export function buildFilterSQL(filter: SegmentFilter): SQL | null {
  const { field, operator, value, unit } = filter;

  // Handle event-based operators (field is the event name)
  if (
    operator === "triggered" ||
    operator === "triggeredWithin" ||
    operator === "notTriggered"
  ) {
    const eventName = field;
    if (operator === "triggered") {
      return sql`EXISTS (SELECT 1 FROM "contact_event" WHERE "contact_id" = "contact"."id" AND "event_name" = ${eventName})`;
    }
    if (operator === "triggeredWithin") {
      const interval = validateInterval(value, unit);
      if (!interval) {
        return null;
      }
      return sql`EXISTS (SELECT 1 FROM "contact_event" WHERE "contact_id" = "contact"."id" AND "event_name" = ${eventName} AND "created_at" > NOW() - INTERVAL ${interval})`;
    }
    // notTriggered
    return sql`NOT EXISTS (SELECT 1 FROM "contact_event" WHERE "contact_id" = "contact"."id" AND "event_name" = ${eventName})`;
  }

  // Handle topic-based filters via raw SQL (no db dependency)
  if (field === "topics") {
    const topicId = value as string;
    if (operator === "hasTopic") {
      return sql`EXISTS (SELECT 1 FROM "contact_topic" WHERE "contact_id" = "contact"."id" AND "topic_id" = ${topicId} AND "status" = 'subscribed')`;
    }
    if (operator === "notHasTopic") {
      return sql`NOT EXISTS (SELECT 1 FROM "contact_topic" WHERE "contact_id" = "contact"."id" AND "topic_id" = ${topicId} AND "status" = 'subscribed')`;
    }
    return null;
  }

  // Handle custom properties (field starts with "properties.")
  if (field.startsWith("properties.")) {
    const propertyKey = field.replace("properties.", "");
    switch (operator) {
      case "equals":
        return sql`properties->>${propertyKey} = ${String(value)}`;
      case "notEquals":
        return sql`properties->>${propertyKey} != ${String(value)}`;
      case "contains":
        return sql`properties->>${propertyKey} ILIKE ${`%${String(value)}%`}`;
      case "notContains":
        return sql`properties->>${propertyKey} NOT ILIKE ${`%${String(value)}%`}`;
      case "startsWith":
        return sql`properties->>${propertyKey} ILIKE ${`${String(value)}%`}`;
      case "endsWith":
        return sql`properties->>${propertyKey} ILIKE ${`%${String(value)}`}`;
      case "greaterThan":
        return sql`(CASE WHEN properties->>${propertyKey} ~ '^-?[0-9]*\.?[0-9]+$' THEN (properties->>${propertyKey})::numeric END) > ${value}`;
      case "lessThan":
        return sql`(CASE WHEN properties->>${propertyKey} ~ '^-?[0-9]*\.?[0-9]+$' THEN (properties->>${propertyKey})::numeric END) < ${value}`;
      case "greaterThanOrEqual":
        return sql`(CASE WHEN properties->>${propertyKey} ~ '^-?[0-9]*\.?[0-9]+$' THEN (properties->>${propertyKey})::numeric END) >= ${value}`;
      case "lessThanOrEqual":
        return sql`(CASE WHEN properties->>${propertyKey} ~ '^-?[0-9]*\.?[0-9]+$' THEN (properties->>${propertyKey})::numeric END) <= ${value}`;
      case "exists":
        return sql`properties ? ${propertyKey}`;
      case "notExists":
        return sql`NOT (properties ? ${propertyKey})`;
      case "inList": {
        const values = value as string[];
        if (values.length === 0) {
          return sql`FALSE`;
        }
        return sql`properties->>${propertyKey} = ANY(${values})`;
      }
      case "notInList": {
        const values = value as string[];
        if (values.length === 0) {
          return sql`TRUE`;
        }
        return sql`properties->>${propertyKey} != ALL(${values})`;
      }
      default:
        return null;
    }
  }

  // Handle standard contact fields
  const columnName = COLUMN_MAP[field];
  if (!columnName) {
    return null;
  }

  const col = sql.raw(`"${columnName}"`);

  switch (operator) {
    case "equals":
      return sql`${col} = ${value}`;
    case "notEquals":
      return sql`${col} != ${value}`;
    case "contains":
      return sql`${col} ILIKE ${`%${String(value)}%`}`;
    case "notContains":
      return sql`${col} NOT ILIKE ${`%${String(value)}%`}`;
    case "startsWith":
      return sql`${col} ILIKE ${`${String(value)}%`}`;
    case "endsWith":
      return sql`${col} ILIKE ${`%${String(value)}`}`;
    case "greaterThan":
      return sql`${col} > ${value}`;
    case "lessThan":
      return sql`${col} < ${value}`;
    case "greaterThanOrEqual":
      return sql`${col} >= ${value}`;
    case "lessThanOrEqual":
      return sql`${col} <= ${value}`;
    case "exists":
      return sql`${col} IS NOT NULL`;
    case "notExists":
      return sql`${col} IS NULL`;
    case "inList": {
      const values = value as string[];
      if (values.length === 0) {
        return sql`FALSE`;
      }
      return sql`${col} = ANY(${values})`;
    }
    case "notInList": {
      const values = value as string[];
      if (values.length === 0) {
        return sql`TRUE`;
      }
      return sql`${col} != ALL(${values})`;
    }
    case "within": {
      const interval = validateInterval(value, unit);
      if (!interval) {
        return null;
      }
      return sql`${col} > NOW() - INTERVAL ${interval}`;
    }
    default:
      return null;
  }
}

export function buildConditionSQL(condition: FilterCondition): SQL | null {
  const groupConditions: SQL[] = [];

  for (const group of condition.groups) {
    const filterConditions: SQL[] = [];

    for (const filter of group.filters) {
      const filterSQL = buildFilterSQL(filter);
      if (filterSQL) {
        filterConditions.push(filterSQL);
      }
    }

    if (group.nested) {
      const nestedSQL = buildConditionSQL(group.nested);
      if (nestedSQL) {
        filterConditions.push(nestedSQL);
      }
    }

    if (filterConditions.length > 0) {
      groupConditions.push(and(...filterConditions)!);
    }
  }

  if (groupConditions.length === 0) {
    return null;
  }

  if (condition.logic === "OR") {
    return or(...groupConditions) ?? null;
  }
  return and(...groupConditions) ?? null;
}
