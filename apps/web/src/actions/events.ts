"use server";

import { auth } from "@wraps/auth";
import { contact, contactEvent, db } from "@wraps/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import type {
  EventWithContact,
  GetEventNamesResult,
  GetEventResult,
  ListEventsOptions,
  ListEventsResult,
} from "@/lib/events";
import { buildEventsFilterConditions } from "@/lib/events-queries.server";
import { createActionLogger, serializeError } from "@/lib/logger";

// Re-export types for convenience
export type {
  EventWithContact,
  GetEventNamesResult,
  GetEventResult,
  ListEventsOptions,
  ListEventsResult,
} from "@/lib/events";

/**
 * Verify user has access to organization
 */
async function verifyOrgAccess(
  organizationId: string
): Promise<{ userId: string; role: string; orgSlug: string } | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const membership = await db.query.member.findFirst({
    where: (m, { and, eq }) =>
      and(eq(m.organizationId, organizationId), eq(m.userId, session.user.id)),
    with: {
      organization: {
        columns: { slug: true },
      },
    },
  });

  if (!membership?.organization.slug) {
    return null;
  }

  return {
    userId: session.user.id,
    role: membership.role,
    orgSlug: membership.organization.slug,
  };
}

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
  days: 7 | 30 = 30
): Promise<GetEventAnalyticsResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

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
          sql`${contactEvent.createdAt} >= ${startDate}`
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
          sql`${contactEvent.createdAt} >= ${startDate}`
        )
      );

    const activeContacts = Number(activeContactsResult?.count ?? 0);

    // Calculate average events per contact
    const avgEventsPerContact =
      activeContacts > 0
        ? Math.round((eventsThisPeriod / activeContacts) * 10) / 10
        : 0;

    // Get daily events data for chart
    // Cast DATE() to text so the Neon driver returns "YYYY-MM-DD" strings
    // instead of Date objects (which serialize as "YYYY-MM-DDT07:00:00.000Z")
    const dailyEventsData = await db
      .select({
        date: sql<string>`DATE(${contactEvent.createdAt})::text`,
        count: count(),
      })
      .from(contactEvent)
      .where(
        and(
          eq(contactEvent.organizationId, organizationId),
          sql`${contactEvent.createdAt} >= ${startDate}`
        )
      )
      .groupBy(sql`DATE(${contactEvent.createdAt})`)
      .orderBy(sql`DATE(${contactEvent.createdAt})`);

    // Fill in missing dates with 0 counts
    // Normalize DB date keys to YYYY-MM-DD in case driver returns Date objects
    const dailyEvents: Array<{ date: string; count: number }> = [];
    const dateMap = new Map(
      dailyEventsData.map((d) => [
        String(d.date).split("T")[0],
        Number(d.count),
      ])
    );

    // Use UTC dates to match the SQL DATE() which returns UTC dates
    const cursor = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate()
      )
    );
    const endUTC = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

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
          sql`${contactEvent.createdAt} >= ${startDate}`
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
