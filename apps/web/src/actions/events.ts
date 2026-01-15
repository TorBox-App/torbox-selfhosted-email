"use server";

import { auth } from "@wraps/auth";
import { contact, contactEvent, db } from "@wraps/db";
import { and, count, desc, eq } from "drizzle-orm";
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
