import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getEmailMetricsFromPostgres } from "@/lib/analytics-fallback";
import {
  aggregateByDate,
  gapFillDates,
  generateDateRange,
  validateTimezone,
} from "@/lib/analytics-utils";
import { getCloudWatchMetricsBatch, SES_METRICS } from "@/lib/aws/cloudwatch";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;
    const log = createRequestLogger({
      path: "/api/[orgSlug]/analytics/email-chart",
      method: "GET",
      orgSlug,
    });

    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(
      365,
      Math.max(1, Number.parseInt(searchParams.get("days") || "30", 10))
    );
    const timezone = validateTimezone(searchParams.get("tz"));
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);
    const period = days <= 7 ? 3600 : days <= 30 ? 3600 * 6 : 3600 * 24;

    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        overview: {
          totalSent: 0,
          totalDelivered: 0,
          totalBounced: 0,
          totalComplaints: 0,
          deliveryRate: 0,
          bounceRate: 0,
          complaintRate: 0,
        },
        volume: [],
        engagement: [],
      });
    }

    // Fetch all 6 metrics in a single batched CloudWatch call per account
    const allMetrics = [
      SES_METRICS.SEND,
      SES_METRICS.DELIVERY,
      SES_METRICS.BOUNCE,
      SES_METRICS.COMPLAINT,
      SES_METRICS.OPEN,
      SES_METRICS.CLICK,
    ];

    const metricsResults = await Promise.all(
      accounts.map(async (account) => {
        try {
          return await getCloudWatchMetricsBatch({
            awsAccountId: account.id,
            metrics: allMetrics,
            period,
            startTime,
            endTime,
          });
        } catch (error) {
          log.error(
            { err: serializeError(error), accountId: account.id },
            "Failed to fetch metrics for account"
          );
          return null;
        }
      })
    );

    // Aggregate all metrics by date in a single pass
    const allKeys = [
      "sent",
      "delivered",
      "bounced",
      "complaints",
      "opens",
      "clicks",
    ] as const;
    let dailyMap = new Map<string, Record<(typeof allKeys)[number], number>>();

    for (const metrics of metricsResults) {
      if (!metrics) {
        continue;
      }

      const timestamps = metrics[SES_METRICS.SEND]?.[0]?.Timestamps || [];
      const perAccount = aggregateByDate(
        timestamps,
        [
          metrics[SES_METRICS.SEND]?.[0]?.Values || [],
          metrics[SES_METRICS.DELIVERY]?.[0]?.Values || [],
          metrics[SES_METRICS.BOUNCE]?.[0]?.Values || [],
          metrics[SES_METRICS.COMPLAINT]?.[0]?.Values || [],
          metrics[SES_METRICS.OPEN]?.[0]?.Values || [],
          metrics[SES_METRICS.CLICK]?.[0]?.Values || [],
        ],
        [...allKeys],
        timezone
      );

      for (const [dateStr, values] of perAccount) {
        const existing = dailyMap.get(dateStr) || {
          sent: 0,
          delivered: 0,
          bounced: 0,
          complaints: 0,
          opens: 0,
          clicks: 0,
        };
        dailyMap.set(dateStr, {
          sent: existing.sent + values.sent,
          delivered: existing.delivered + values.delivered,
          bounced: existing.bounced + values.bounced,
          complaints: existing.complaints + values.complaints,
          opens: existing.opens + values.opens,
          clicks: existing.clicks + values.clicks,
        });
      }
    }

    // Fallback to PostgreSQL message_send when CloudWatch returns no data
    if (dailyMap.size === 0) {
      dailyMap = await getEmailMetricsFromPostgres(
        orgWithMembership.id,
        startTime,
        endTime,
        timezone
      );
    }

    // Compute overview totals from daily aggregates
    let totalSent = 0;
    let totalDelivered = 0;
    let totalBounced = 0;
    let totalComplaints = 0;
    for (const day of dailyMap.values()) {
      totalSent += day.sent;
      totalDelivered += day.delivered;
      totalBounced += day.bounced;
      totalComplaints += day.complaints;
    }

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const complaintRate =
      totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0;

    const dateRange = generateDateRange(startTime, endTime, timezone);
    const defaults = {
      sent: 0,
      delivered: 0,
      bounced: 0,
      complaints: 0,
      opens: 0,
      clicks: 0,
    };
    const filled = gapFillDates(dateRange, dailyMap, defaults);

    const volume = filled.map((d) => ({
      date: d.date,
      timestamp: d.timestamp,
      sent: Math.round(d.sent),
      delivered: Math.round(d.delivered),
      bounced: Math.round(d.bounced),
    }));

    const engagement = filled.map((d) => {
      const openRate = d.delivered > 0 ? (d.opens / d.delivered) * 100 : 0;
      const clickRate = d.delivered > 0 ? (d.clicks / d.delivered) * 100 : 0;
      return {
        date: d.date,
        timestamp: d.timestamp,
        openRate: Number(openRate.toFixed(1)),
        clickRate: Number(clickRate.toFixed(1)),
      };
    });

    return NextResponse.json({
      overview: {
        totalSent: Math.round(totalSent),
        totalDelivered: Math.round(totalDelivered),
        totalBounced: Math.round(totalBounced),
        totalComplaints: Math.round(totalComplaints),
        deliveryRate: Number(deliveryRate.toFixed(2)),
        bounceRate: Number(bounceRate.toFixed(2)),
        complaintRate: Number(complaintRate.toFixed(2)),
      },
      volume,
      engagement,
    });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/analytics/email-chart",
      method: "GET",
    });
    log.error(
      { err: serializeError(error) },
      "Error fetching email chart data"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
