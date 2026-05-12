"use server";

import {
  countActiveContactsWithEvents,
  countAllContactEvents,
  countContactEventsInPeriod,
  type EventFilters,
  getContactEvent,
  getDailyContactEventCounts,
  getTopContactEventNames,
  listContactEvents,
  listDistinctEventNames,
} from "@wraps/db";
import type {
  EventWithContact,
  GetEventNamesResult,
  GetEventResult,
  ListEventsOptions,
  ListEventsResult,
} from "@/lib/events";
import { createActionLogger } from "@/lib/logger";
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

    const { page = 1, pageSize = 50, ...filters } = options;
    const { events, total } = await listContactEvents(
      organizationId,
      filters as EventFilters,
      { page, pageSize }
    );

    return {
      success: true,
      events: events as EventWithContact[],
      total,
      page,
      pageSize,
    };
  } catch (error) {
    const log = createActionLogger("listEvents", { orgSlug: organizationId });
    log.error({ err: error }, "Failed to list events");
    return { success: false, error: "Failed to fetch events" };
  }
}

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

    const event = await getContactEvent(eventId, organizationId);

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    return {
      success: true,
      event: event as EventWithContact,
    };
  } catch (error) {
    const log = createActionLogger("getEvent", { orgSlug: organizationId });
    log.error({ err: error, eventId }, "Failed to get event");
    return { success: false, error: "Failed to fetch event" };
  }
}

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

    const eventNames = await listDistinctEventNames(organizationId);

    return { success: true, eventNames };
  } catch (error) {
    const log = createActionLogger("getEventNames", {
      orgSlug: organizationId,
    });
    log.error({ err: error }, "Failed to get event names");
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

    const [
      totalEvents,
      eventsThisPeriod,
      activeContacts,
      dailyEventsData,
      topEventNamesData,
    ] = await Promise.all([
      countAllContactEvents(organizationId),
      countContactEventsInPeriod(organizationId, startStr, tz),
      countActiveContactsWithEvents(organizationId, startStr, tz),
      getDailyContactEventCounts(organizationId, startStr, tz),
      getTopContactEventNames(organizationId, startStr, tz, 5),
    ]);

    const avgEventsPerContact =
      activeContacts > 0
        ? Math.round((eventsThisPeriod / activeContacts) * 10) / 10
        : 0;

    // Fill in missing dates with 0 counts
    const dailyEvents: Array<{ date: string; count: number }> = [];
    const dateMap = new Map(dailyEventsData.map((d) => [d.date, d.count]));

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

    return {
      success: true,
      analytics: {
        totalEvents,
        eventsThisPeriod,
        activeContacts,
        avgEventsPerContact,
        dailyEvents,
        topEventNames: topEventNamesData,
      },
    };
  } catch (error) {
    const log = createActionLogger("getEventAnalytics", {
      orgSlug: organizationId,
    });
    log.error({ err: error, days }, "Failed to get event analytics");
    return { success: false, error: "Failed to fetch event analytics" };
  }
}
