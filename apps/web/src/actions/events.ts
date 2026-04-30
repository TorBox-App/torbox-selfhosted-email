"use server";

import { contact, contactEvent, db } from "@wraps/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type {
  EventWithContact,
  GetEventNamesResult,
  GetEventResult,
  ListEventsOptions,
  ListEventsResult,
} from "@/lib/events";
import { buildEventsFilterConditions } from "@/lib/events-queries.server";
import { createActionLogger, serializeError } from "@/lib/logger";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";

// Re-export types for convenience
export type {
  EventWithContact,
  GetEventNamesResult,
  GetEventResult,
  ListEventsOptions,
  ListEventsResult,
} from "@/lib/events";

/**
 * List events for an organization with pagination and search
 */
export async function listEvents(
  organizationId: string,
  options: ListEventsOptions = {}
): Promise<ListEventsResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["read"]);
    if (permError) return permError;

    const { page = 1, pageSize = 50 } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions using the utility function
    const conditions = buildEventsFilterConditions(organizationId, options);

    // Get total count with join
    // Join requires both contactId match AND contact belongs to same org (defense in depth)
    const [totalResult] = await db
      .select({ count: count() })
      .from(contactEvent)
      .innerJoin(
        contact,
        and(
          eq(contactEvent.contactId, contact.id),
          eq(contact.organizationId, organizationId)
        )
      )
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    // Get events with pagination
    // Join requires both contactId match AND contact belongs to same org (defense in depth)
    const events = await db
      .select({
        id: contactEvent.id,
        eventName: contactEvent.eventName,
        eventData: contactEvent.eventData,
        createdAt: contactEvent.createdAt,
        contactId: contactEvent.contactId,
        contactEmail: contact.email,
        contactFirstName: contact.firstName,
        contactLastName: contact.lastName,
      })
      .from(contactEvent)
      .innerJoin(
        contact,
        and(
          eq(contactEvent.contactId, contact.id),
          eq(contact.organizationId, organizationId)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(contactEvent.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      success: true,
      events: events as EventWithContact[],
      total,
      page,
      pageSize,
    };
  } catch (error) {
    const log = createActionLogger("listEvents", { orgSlug: organizationId });
    log.error({ err: serializeError(error) }, "Failed to list events");
    return { success: false, error: "Failed to fetch events" };
  }
}

/**
 * Get a single event by ID
 */
export async function getEvent(
  eventId: string,
  organizationId: string
): Promise<GetEventResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["read"]);
    if (permError) return permError;

    // Join requires both contactId match AND contact belongs to same org (defense in depth)
    const [event] = await db
      .select({
        id: contactEvent.id,
        eventName: contactEvent.eventName,
        eventData: contactEvent.eventData,
        createdAt: contactEvent.createdAt,
        contactId: contactEvent.contactId,
        contactEmail: contact.email,
        contactFirstName: contact.firstName,
        contactLastName: contact.lastName,
      })
      .from(contactEvent)
      .innerJoin(
        contact,
        and(
          eq(contactEvent.contactId, contact.id),
          eq(contact.organizationId, organizationId)
        )
      )
      .where(
        and(
          eq(contactEvent.id, eventId),
          eq(contactEvent.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    return {
      success: true,
      event: event as EventWithContact,
    };
  } catch (error) {
    const log = createActionLogger("getEvent", { orgSlug: organizationId });
    log.error({ err: serializeError(error), eventId }, "Failed to get event");
    return { success: false, error: "Failed to fetch event" };
  }
}

/**
 * Get unique event names for an organization (for dropdown filter)
 */
export async function getEventNames(
  organizationId: string
): Promise<GetEventNamesResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["read"]);
    if (permError) return permError;

    const results = await db
      .selectDistinct({ eventName: contactEvent.eventName })
      .from(contactEvent)
      .where(eq(contactEvent.organizationId, organizationId))
      .orderBy(contactEvent.eventName);

    return {
      success: true,
      eventNames: results.map((r) => r.eventName),
    };
  } catch (error) {
    const log = createActionLogger("getEventNames", {
      orgSlug: organizationId,
    });
    log.error({ err: serializeError(error) }, "Failed to get event names");
    return { success: false, error: "Failed to fetch event names" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

export type EventAnalytics = {
  totalEvents: number;
  eventsThisPeriod: number;
  activeContacts: number;
  avgEventsPerContact: number;
  dailyEvents: Array<{ date: string; count: number }>;
  topEventNames: Array<{ name: string; count: number }>;
};

export type GetEventAnalyticsResult =
  | { success: true; analytics: EventAnalytics }
  | { success: false; error: string };

/**
 * Get event analytics for an organization
 */
export async function getEventAnalytics(
  organizationId: string,
  days: 7 | 30 = 30,
  timezone = "UTC"
): Promise<GetEventAnalyticsResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }
    const permError = checkPermission(access.role, "contacts", ["read"]);
    if (permError) return permError;

    const now = new Date();

    // Validate timezone — fall back to UTC if invalid
    let tz = timezone;
    try {
      Intl.DateTimeFormat("en-CA", { timeZone: tz });
    } catch {
      tz = "UTC";
    }

    // Compute date boundaries in user's timezone
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });
    const [y, m, d] = todayStr.split("-").map(Number);
    const startStr = new Date(Date.UTC(y, m - 1, d - days))
      .toISOString()
      .split("T")[0];

    // SQL helper: convert stored UTC timestamp to user's timezone
    // Use sql.raw for the timezone literal so all references produce identical
    // SQL expressions — parameterized values get unique indices ($1, $3, $5...)
    // which PostgreSQL treats as distinct in GROUP BY.
    // Timezone is validated above via Intl.DateTimeFormat so this is injection-safe.
    const tzLiteral = sql.raw(`'${tz}'`);
    const createdAtLocal = sql`${contactEvent.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}`;

    // Get total events (all time)
    const [totalResult] = await db
      .select({ count: count() })
      .from(contactEvent)
      .where(eq(contactEvent.organizationId, organizationId));

    const totalEvents = totalResult?.count ?? 0;

    // Get events in this period
    const [periodEventsResult] = await db
      .select({ count: count() })
      .from(contactEvent)
      .where(
        and(
          eq(contactEvent.organizationId, organizationId),
          sql`DATE(${createdAtLocal}) >= ${startStr}::date`
        )
      );

    const eventsThisPeriod = periodEventsResult?.count ?? 0;

    // Get distinct contacts with events in this period
    const [activeContactsResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${contactEvent.contactId})`,
      })
      .from(contactEvent)
      .where(
        and(
          eq(contactEvent.organizationId, organizationId),
          sql`DATE(${createdAtLocal}) >= ${startStr}::date`
        )
      );

    const activeContacts = Number(activeContactsResult?.count ?? 0);

    // Calculate average events per contact
    const avgEventsPerContact =
      activeContacts > 0
        ? Math.round((eventsThisPeriod / activeContacts) * 10) / 10
        : 0;

    // Get daily events data for chart, grouped by user's local date
    const dailyEventsData = await db
      .select({
        date: sql<string>`DATE(${createdAtLocal})::text`,
        count: count(),
      })
      .from(contactEvent)
      .where(
        and(
          eq(contactEvent.organizationId, organizationId),
          sql`DATE(${createdAtLocal}) >= ${startStr}::date`
        )
      )
      .groupBy(sql`DATE(${createdAtLocal})`)
      .orderBy(sql`DATE(${createdAtLocal})`);

    // Fill in missing dates with 0 counts
    const dailyEvents: Array<{ date: string; count: number }> = [];
    const dateMap = new Map(
      dailyEventsData.map((d) => [
        String(d.date).split("T")[0],
        Number(d.count),
      ])
    );

    // Walk from startStr to todayStr (both in user's timezone)
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const cursor = new Date(Date.UTC(sy, sm - 1, sd));
    const [ey, em, ed] = todayStr.split("-").map(Number);
    const endUTC = Date.UTC(ey, em - 1, ed);

    while (cursor.getTime() <= endUTC) {
      const dateStr = cursor.toISOString().split("T")[0];
      dailyEvents.push({
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Get top 5 event names by count in this period
    const topEventNamesData = await db
      .select({
        name: contactEvent.eventName,
        count: count(),
      })
      .from(contactEvent)
      .where(
        and(
          eq(contactEvent.organizationId, organizationId),
          sql`DATE(${createdAtLocal}) >= ${startStr}::date`
        )
      )
      .groupBy(contactEvent.eventName)
      .orderBy(desc(count()))
      .limit(5);

    const topEventNames = topEventNamesData.map((e) => ({
      name: e.name,
      count: Number(e.count),
    }));

    return {
      success: true,
      analytics: {
        totalEvents,
        eventsThisPeriod,
        activeContacts,
        avgEventsPerContact,
        dailyEvents,
        topEventNames,
      },
    };
  } catch (error) {
    const log = createActionLogger("getEventAnalytics", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), days },
      "Failed to get event analytics"
    );
    return { success: false, error: "Failed to fetch event analytics" };
  }
}
