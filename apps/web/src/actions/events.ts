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
import { orgAction } from "./shared/org-action";

// Re-export types for convenience
export type {
  EventWithContact,
  GetEventNamesResult,
  GetEventResult,
  ListEventsOptions,
  ListEventsResult,
} from "@/lib/events";

export const listEvents = orgAction(
  {
    name: "listEvents",
    resource: "contacts",
    permission: ["read"],
    orgId: (organizationId: string, _options?: ListEventsOptions) =>
      organizationId,
    onError: "Failed to fetch events",
  },
  async (
    ctx,
    organizationId: string,
    options: ListEventsOptions = {}
  ): Promise<ListEventsResult> => {
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
  }
);

export const getEvent = orgAction(
  {
    name: "getEvent",
    resource: "contacts",
    permission: ["read"],
    orgId: (_eventId: string, organizationId: string) => organizationId,
    onError: "Failed to fetch event",
  },
  async (
    ctx,
    eventId: string,
    organizationId: string
  ): Promise<GetEventResult> => {
    const event = await getContactEvent(eventId, organizationId);

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    return {
      success: true,
      event: event as EventWithContact,
    };
  }
);

export const getEventNames = orgAction(
  {
    name: "getEventNames",
    resource: "contacts",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to fetch event names",
  },
  async (ctx, organizationId: string): Promise<GetEventNamesResult> => {
    const eventNames = await listDistinctEventNames(organizationId);

    return { success: true, eventNames };
  }
);

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

export const getEventAnalytics = orgAction(
  {
    name: "getEventAnalytics",
    resource: "contacts",
    permission: ["read"],
    orgId: (organizationId: string, _days?: 7 | 30, _timezone?: string) =>
      organizationId,
    onError: "Failed to fetch event analytics",
  },
  async (
    ctx,
    organizationId: string,
    days: 7 | 30 = 30,
    timezone = "UTC"
  ): Promise<GetEventAnalyticsResult> => {
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
  }
);
