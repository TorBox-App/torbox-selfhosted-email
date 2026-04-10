/**
 * PostgreSQL analytics queries.
 *
 * Primary data source for the email chart and analytics endpoints.
 * Aggregates from the `message_send` table with bot open filtering.
 */

import { db } from "@wraps/db";
import { messageSend } from "@wraps/db/schema/batch";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { BOT_UA_KEYWORDS } from "./email-bot-detection";

/**
 * SQL fragment that returns TRUE when the open_user_agent is NOT a bot.
 * Derives from the same BOT_UA_KEYWORDS list as the TypeScript `isBotOpen()`.
 * null/empty UAs are considered bots.
 */
const botPattern = BOT_UA_KEYWORDS.join("|");
const isNotBotOpen = sql`(
  ${messageSend.openUserAgent} IS NOT NULL
  AND ${messageSend.openUserAgent} != ''
  AND ${messageSend.openUserAgent} !~* ${botPattern}
)`;

// ---------------------------------------------------------------------------
// Daily email volume (sent / delivered / bounced / complaints / opens / clicks)
// ---------------------------------------------------------------------------

export type DailyEmailMetrics = {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  complaints: number;
  opens: number;
  clicks: number;
  renderingFailures: number;
};

export async function getEmailMetricsFromPostgres(
  organizationId: string,
  startTime: Date,
  endTime: Date,
  timezone = "UTC"
): Promise<Map<string, DailyEmailMetrics>> {
  const tzLiteral = sql`${timezone}`;
  const rows = await db
    .select({
      date: sql<string>`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`,
      sent: sql<number>`count(*) filter (where ${messageSend.status} != 'failed')::int`,
      delivered: sql<number>`count(*) filter (where ${messageSend.deliveredAt} is not null)::int`,
      bounced: sql<number>`count(*) filter (where ${messageSend.bouncedAt} is not null)::int`,
      complaints: sql<number>`count(*) filter (where ${messageSend.complainedAt} is not null)::int`,
      opens: sql<number>`count(*) filter (where ${messageSend.openedAt} is not null and ${isNotBotOpen})::int`,
      clicks: sql<number>`count(*) filter (where ${messageSend.clickedAt} is not null)::int`,
      renderingFailures: sql<number>`count(*) filter (where ${messageSend.status} = 'failed')::int`,
    })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.channel, "email"),
        isNotNull(messageSend.sentAt),
        gte(messageSend.sentAt, startTime),
        lte(messageSend.sentAt, endTime)
      )
    )
    .groupBy(
      sql`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`
    );

  const map = new Map<string, DailyEmailMetrics>();
  for (const row of rows) {
    map.set(row.date, {
      date: row.date,
      sent: row.sent,
      delivered: row.delivered,
      bounced: row.bounced,
      complaints: row.complaints,
      opens: row.opens,
      clicks: row.clicks,
      renderingFailures: row.renderingFailures,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Daily bounce breakdown (permanent / transient / undetermined)
// ---------------------------------------------------------------------------

export type DailyBounceMetrics = {
  permanent: number;
  transient: number;
  undetermined: number;
  sent: number;
};

export async function getBounceMetricsFromPostgres(
  organizationId: string,
  startTime: Date,
  endTime: Date,
  timezone = "UTC"
): Promise<Map<string, DailyBounceMetrics>> {
  const tzLiteral = sql`${timezone}`;
  const rows = await db
    .select({
      date: sql<string>`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`,
      sent: sql<number>`count(*)::int`,
      permanent: sql<number>`count(*) filter (where ${messageSend.bounceType} = 'Permanent')::int`,
      transient: sql<number>`count(*) filter (where ${messageSend.bounceType} = 'Transient')::int`,
      undetermined: sql<number>`count(*) filter (where ${messageSend.bouncedAt} is not null and (${messageSend.bounceType} is null or ${messageSend.bounceType} not in ('Permanent', 'Transient')))::int`,
    })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.channel, "email"),
        isNotNull(messageSend.sentAt),
        gte(messageSend.sentAt, startTime),
        lte(messageSend.sentAt, endTime)
      )
    )
    .groupBy(
      sql`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`
    );

  const map = new Map<string, DailyBounceMetrics>();
  for (const row of rows) {
    map.set(row.date, {
      permanent: row.permanent,
      transient: row.transient,
      undetermined: row.undetermined,
      sent: row.sent,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Daily complaint metrics
// ---------------------------------------------------------------------------

export type DailyComplaintMetrics = {
  complaints: number;
  sent: number;
};

export async function getComplaintMetricsFromPostgres(
  organizationId: string,
  startTime: Date,
  endTime: Date,
  timezone = "UTC"
): Promise<Map<string, DailyComplaintMetrics>> {
  const tzLiteral = sql`${timezone}`;
  const rows = await db
    .select({
      date: sql<string>`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`,
      sent: sql<number>`count(*)::int`,
      complaints: sql<number>`count(*) filter (where ${messageSend.complainedAt} is not null)::int`,
    })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.channel, "email"),
        isNotNull(messageSend.sentAt),
        gte(messageSend.sentAt, startTime),
        lte(messageSend.sentAt, endTime)
      )
    )
    .groupBy(
      sql`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`
    );

  const map = new Map<string, DailyComplaintMetrics>();
  for (const row of rows) {
    map.set(row.date, { complaints: row.complaints, sent: row.sent });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Daily suppression metrics
// ---------------------------------------------------------------------------

export type DailySuppressionMetrics = {
  accountLevel: number;
  globalLevel: number;
  sent: number;
};

export async function getSuppressionMetricsFromPostgres(
  organizationId: string,
  startTime: Date,
  endTime: Date,
  timezone = "UTC"
): Promise<Map<string, DailySuppressionMetrics>> {
  const tzLiteral = sql`${timezone}`;
  const rows = await db
    .select({
      date: sql<string>`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`,
      sent: sql<number>`count(*)::int`,
      suppressed: sql<number>`count(*) filter (where ${messageSend.suppressedAt} is not null)::int`,
    })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.channel, "email"),
        isNotNull(messageSend.sentAt),
        gte(messageSend.sentAt, startTime),
        lte(messageSend.sentAt, endTime)
      )
    )
    .groupBy(
      sql`to_char(${messageSend.sentAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLiteral}, 'YYYY-MM-DD')`
    );

  const map = new Map<string, DailySuppressionMetrics>();
  for (const row of rows) {
    map.set(row.date, {
      accountLevel: 0,
      globalLevel: row.suppressed,
      sent: row.sent,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Top performers (grouped by subject)
// ---------------------------------------------------------------------------

export type TopPerformer = {
  subject: string;
  openRate: number;
  clickRate: number;
  sent: number;
  opens: number;
  clicks: number;
  sentAt: number;
};

export async function getTopPerformersFromPostgres(
  organizationId: string,
  startTime: Date,
  endTime: Date,
  limit: number
): Promise<TopPerformer[]> {
  const rows = await db
    .select({
      subject: messageSend.subject,
      sent: sql<number>`count(*)::int`,
      opens: sql<number>`count(*) filter (where ${messageSend.openedAt} is not null and ${isNotBotOpen})::int`,
      clicks: sql<number>`count(*) filter (where ${messageSend.clickedAt} is not null)::int`,
      earliestSent: sql<Date>`min(${messageSend.sentAt})`,
    })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.channel, "email"),
        isNotNull(messageSend.deliveredAt),
        isNotNull(messageSend.subject),
        gte(messageSend.sentAt, startTime),
        lte(messageSend.sentAt, endTime)
      )
    )
    .groupBy(messageSend.subject)
    .orderBy(
      desc(
        sql`count(*) filter (where ${messageSend.clickedAt} is not null) * 2 + count(*) filter (where ${messageSend.openedAt} is not null)`
      )
    )
    .limit(limit);

  return rows.map((r) => {
    const openRate = r.sent > 0 ? (r.opens / r.sent) * 100 : 0;
    const clickRate = r.sent > 0 ? (r.clicks / r.sent) * 100 : 0;
    return {
      subject: r.subject!,
      openRate: Number(openRate.toFixed(1)),
      clickRate: Number(clickRate.toFixed(1)),
      sent: r.sent,
      opens: r.opens,
      clicks: r.clicks,
      sentAt: r.earliestSent.getTime(),
    };
  });
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

export type RecentActivity = {
  id: string;
  subject: string;
  eventType: string;
  timestamp: number;
  sentAt: number;
  timestampFormatted: string;
  metadata: Record<string, unknown>;
};

export async function getRecentActivityFromPostgres(
  organizationId: string,
  limit: number
): Promise<RecentActivity[]> {
  const rows = await db
    .select({
      id: messageSend.id,
      subject: messageSend.subject,
      status: messageSend.status,
      sentAt: messageSend.sentAt,
      deliveredAt: messageSend.deliveredAt,
      openedAt: messageSend.openedAt,
      clickedAt: messageSend.clickedAt,
      bouncedAt: messageSend.bouncedAt,
      complainedAt: messageSend.complainedAt,
      recipient: messageSend.recipient,
    })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, organizationId),
        eq(messageSend.channel, "email")
      )
    )
    .orderBy(desc(messageSend.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const statusToEventType: Record<string, string> = {
      sent: "Send",
      delivered: "Delivery",
      opened: "Open",
      clicked: "Click",
      bounced: "Bounce",
      complained: "Complaint",
      suppressed: "Suppressed",
      failed: "Reject",
      pending: "Send",
      queued: "Send",
    };
    const eventType = statusToEventType[r.status] ?? "Send";
    const sentAtTs = r.sentAt?.getTime() ?? Date.now();

    // Use the most recent event timestamp, not always sentAt
    const eventTimeMap: Record<string, number | undefined> = {
      Open: r.openedAt?.getTime(),
      Click: r.clickedAt?.getTime(),
      Bounce: r.bouncedAt?.getTime(),
      Complaint: r.complainedAt?.getTime(),
    };
    const ts = eventTimeMap[eventType] ?? sentAtTs;

    return {
      id: r.id,
      subject: r.subject ?? "(no subject)",
      eventType,
      timestamp: ts,
      sentAt: sentAtTs,
      timestampFormatted: new Date(ts).toISOString(),
      metadata: { to: r.recipient },
    };
  });
}
