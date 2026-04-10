"use server";

import {
  batchSend,
  contact,
  contactEvent,
  db,
  messageSend,
  workflow,
  workflowExecution,
} from "@wraps/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { createActionLogger, serializeError } from "@/lib/logger";
import { verifyOrgAccess } from "./shared/verify-org-access";

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type TimelineEventType =
  | "message" // Consolidated message event (email or SMS)
  | "workflow_started"
  | "workflow_completed"
  | "workflow_failed"
  | "contact_created"
  | "custom_event"; // Custom events tracked from SDK

export type MessageStatusTimestamps = {
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  clickedAt?: Date | null;
  bouncedAt?: Date | null;
  complainedAt?: Date | null;
  optedOutAt?: Date | null; // SMS only
};

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  timestamp: Date;
  // Message-specific (type: "message")
  channel?: "email" | "sms";
  subject?: string | null;
  recipient?: string | null;
  sourceType?: "transactional" | "batch" | "campaign" | "workflow" | null;
  batchId?: string | null;
  batchName?: string | null;
  messageId?: string | null;
  status?: MessageStatusTimestamps; // Consolidated status timestamps
  // Workflow-specific
  workflowId?: string | null;
  workflowName?: string | null;
  executionId?: string | null;
  triggerType?: string | null;
  eventName?: string | null;
  eventData?: Record<string, unknown> | null;
};

export type GetContactTimelineResult =
  | { success: true; events: TimelineEvent[]; hasMore: boolean }
  | { success: false; error: string };

/**
 * Get timeline events for a contact
 */
export async function getContactTimeline(
  contactId: string,
  organizationId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<GetContactTimelineResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

    const { limit = 20, offset = 0 } = options;
    const events: TimelineEvent[] = [];

    // Verify contact exists and get created date
    const contactRecord = await db.query.contact.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.id, contactId), eq(c.organizationId, organizationId)),
    });

    if (!contactRecord) {
      return { success: false, error: "Contact not found" };
    }

    // Add contact created event
    events.push({
      id: `contact_created_${contactRecord.id}`,
      type: "contact_created",
      timestamp: contactRecord.createdAt,
    });

    // Fetch messages sent to this contact
    const messages = await db
      .select({
        id: messageSend.id,
        channel: messageSend.channel,
        subject: messageSend.subject,
        recipient: messageSend.recipient,
        sourceType: messageSend.sourceType,
        batchSendId: messageSend.batchSendId,
        batchName: batchSend.name,
        messageId: messageSend.messageId,
        status: messageSend.status,
        sentAt: messageSend.sentAt,
        deliveredAt: messageSend.deliveredAt,
        openedAt: messageSend.openedAt,
        clickedAt: messageSend.clickedAt,
        bouncedAt: messageSend.bouncedAt,
        complainedAt: messageSend.complainedAt,
        optedOutAt: messageSend.optedOutAt,
        createdAt: messageSend.createdAt,
      })
      .from(messageSend)
      .leftJoin(batchSend, eq(messageSend.batchSendId, batchSend.id))
      .where(
        and(
          eq(messageSend.contactId, contactId),
          eq(messageSend.organizationId, organizationId)
        )
      )
      .orderBy(desc(messageSend.createdAt))
      .limit(50);

    // Convert messages to consolidated timeline events (one event per message)
    for (const msg of messages) {
      // Use sentAt as the primary timestamp, fallback to createdAt
      const timestamp = msg.sentAt ?? msg.createdAt;

      events.push({
        id: msg.id,
        type: "message",
        timestamp,
        channel: msg.channel as "email" | "sms",
        subject: msg.subject,
        recipient: msg.recipient,
        sourceType: msg.sourceType,
        batchId: msg.batchSendId,
        batchName: msg.batchName,
        messageId: msg.messageId,
        status: {
          sentAt: msg.sentAt,
          deliveredAt: msg.deliveredAt,
          openedAt: msg.openedAt,
          clickedAt: msg.clickedAt,
          bouncedAt: msg.bouncedAt,
          complainedAt: msg.complainedAt,
          optedOutAt: msg.optedOutAt,
        },
      });
    }

    // Fetch workflow executions for this contact
    const executions = await db
      .select({
        id: workflowExecution.id,
        workflowId: workflowExecution.workflowId,
        workflowName: workflow.name,
        status: workflowExecution.status,
        triggerType: workflow.triggerType,
        triggerConfig: workflow.triggerConfig,
        triggerData: workflowExecution.triggerData,
        startedAt: workflowExecution.startedAt,
        completedAt: workflowExecution.completedAt,
        createdAt: workflowExecution.createdAt,
      })
      .from(workflowExecution)
      .innerJoin(workflow, eq(workflowExecution.workflowId, workflow.id))
      .where(
        and(
          eq(workflowExecution.contactId, contactId),
          eq(workflowExecution.organizationId, organizationId)
        )
      )
      .orderBy(desc(workflowExecution.createdAt))
      .limit(20);

    // Convert workflow executions to timeline events
    for (const exec of executions) {
      const triggerConfig = exec.triggerConfig as { eventName?: string } | null;
      const baseEvent = {
        workflowId: exec.workflowId,
        workflowName: exec.workflowName,
        executionId: exec.id,
        triggerType: exec.triggerType,
        eventName: triggerConfig?.eventName ?? null,
        eventData: exec.triggerData as Record<string, unknown> | null,
      };

      // Add completion/failure event
      if (exec.status === "completed" && exec.completedAt) {
        events.push({
          id: `${exec.id}_completed`,
          type: "workflow_completed",
          timestamp: exec.completedAt,
          ...baseEvent,
        });
      } else if (exec.status === "failed" && exec.completedAt) {
        events.push({
          id: `${exec.id}_failed`,
          type: "workflow_failed",
          timestamp: exec.completedAt,
          ...baseEvent,
        });
      }

      // Add started event
      if (exec.startedAt) {
        events.push({
          id: `${exec.id}_started`,
          type: "workflow_started",
          timestamp: exec.startedAt,
          ...baseEvent,
        });
      }
    }

    // Fetch custom events for this contact
    const customEvents = await db
      .select({
        id: contactEvent.id,
        eventName: contactEvent.eventName,
        eventData: contactEvent.eventData,
        createdAt: contactEvent.createdAt,
      })
      .from(contactEvent)
      .where(
        and(
          eq(contactEvent.contactId, contactId),
          eq(contactEvent.organizationId, organizationId)
        )
      )
      .orderBy(desc(contactEvent.createdAt))
      .limit(50);

    // Convert custom events to timeline events
    for (const customEvent of customEvents) {
      events.push({
        id: customEvent.id,
        type: "custom_event",
        timestamp: customEvent.createdAt,
        eventName: customEvent.eventName,
        eventData: customEvent.eventData as Record<string, unknown> | null,
      });
    }

    // Sort all events by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const paginatedEvents = events.slice(offset, offset + limit);
    const hasMore = events.length > offset + limit;

    return {
      success: true,
      events: paginatedEvents,
      hasMore,
    };
  } catch (error) {
    const log = createActionLogger("getContactTimeline", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), contactId },
      "Failed to get contact timeline"
    );
    return { success: false, error: "Failed to fetch timeline" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

export type ContactAnalytics = {
  totalContacts: number;
  newContactsThisPeriod: number;
  growthPercent: number;
  avgOpenRate: number;
  avgClickRate: number;
  dailyGrowth: Array<{ date: string; count: number }>;
};

export type GetContactAnalyticsResult =
  | { success: true; analytics: ContactAnalytics }
  | { success: false; error: string };

/**
 * Get contact analytics for an organization
 */
export async function getContactAnalytics(
  organizationId: string,
  days: 7 | 30 = 30,
  timezone = "UTC"
): Promise<GetContactAnalyticsResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return {
        success: false,
        error: "You don't have access to this organization",
      };
    }

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
    const prevStartStr = new Date(Date.UTC(y, m - 1, d - days * 2))
      .toISOString()
      .split("T")[0];

    // SQL helper: convert stored UTC timestamp to user's timezone
    // Use sql.raw for the timezone literal so all references produce identical
    // SQL expressions — parameterized values get unique indices ($1, $3, $5...)
    // which PostgreSQL treats as distinct in GROUP BY.
    // Timezone is validated above via Intl.DateTimeFormat so this is injection-safe.
    const tzLiteral = sql.raw(`'${tz}'`);
    const createdAtLocal = sql`${contact.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}`;

    // Get total contacts
    const [totalResult] = await db
      .select({ count: count() })
      .from(contact)
      .where(eq(contact.organizationId, organizationId));

    const totalContacts = totalResult?.count ?? 0;

    // Get new contacts in this period
    const [newContactsResult] = await db
      .select({ count: count() })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          sql`DATE(${createdAtLocal}) >= ${startStr}::date`
        )
      );

    const newContactsThisPeriod = newContactsResult?.count ?? 0;

    // Get new contacts in previous period for growth calculation
    const [previousPeriodResult] = await db
      .select({ count: count() })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          sql`DATE(${createdAtLocal}) >= ${prevStartStr}::date`,
          sql`DATE(${createdAtLocal}) < ${startStr}::date`
        )
      );

    const previousPeriodContacts = previousPeriodResult?.count ?? 0;

    // Calculate growth percent
    const growthPercent =
      previousPeriodContacts > 0
        ? ((newContactsThisPeriod - previousPeriodContacts) /
            previousPeriodContacts) *
          100
        : newContactsThisPeriod > 0
          ? 100
          : 0;

    // Get average open and click rates
    const [engagementResult] = await db
      .select({
        totalSent: sql<number>`COALESCE(SUM(${contact.emailsSent}), 0)`,
        totalOpened: sql<number>`COALESCE(SUM(${contact.emailsOpened}), 0)`,
        totalClicked: sql<number>`COALESCE(SUM(${contact.emailsClicked}), 0)`,
      })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          sql`${contact.emailsSent} > 0`
        )
      );

    const totalSent = Number(engagementResult?.totalSent ?? 0);
    const totalOpened = Number(engagementResult?.totalOpened ?? 0);
    const totalClicked = Number(engagementResult?.totalClicked ?? 0);

    const avgOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const avgClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

    // Get daily growth data for chart, grouped by user's local date
    const dailyGrowthData = await db
      .select({
        date: sql<string>`DATE(${createdAtLocal})::text`,
        count: count(),
      })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          sql`DATE(${createdAtLocal}) >= ${startStr}::date`
        )
      )
      .groupBy(sql`DATE(${createdAtLocal})`)
      .orderBy(sql`DATE(${createdAtLocal})`);

    // Fill in missing dates with 0 counts
    const dailyGrowth: Array<{ date: string; count: number }> = [];
    const dateMap = new Map(
      dailyGrowthData.map((d) => [
        String(d.date).split("T")[0],
        Number(d.count),
      ])
    );

    // Walk from startStr to todayStr (both in user's timezone)
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = todayStr.split("-").map(Number);
    const cursor = new Date(Date.UTC(sy, sm - 1, sd));
    const endUTC = Date.UTC(ey, em - 1, ed);

    while (cursor.getTime() <= endUTC) {
      const dateStr = cursor.toISOString().split("T")[0];
      dailyGrowth.push({
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      success: true,
      analytics: {
        totalContacts,
        newContactsThisPeriod,
        growthPercent: Math.round(growthPercent * 10) / 10,
        avgOpenRate: Math.round(avgOpenRate * 10) / 10,
        avgClickRate: Math.round(avgClickRate * 10) / 10,
        dailyGrowth,
      },
    };
  } catch (error) {
    const log = createActionLogger("getContactAnalytics", {
      orgSlug: organizationId,
    });
    log.error(
      { err: serializeError(error), days },
      "Failed to get contact analytics"
    );
    return { success: false, error: "Failed to fetch contact analytics" };
  }
}
