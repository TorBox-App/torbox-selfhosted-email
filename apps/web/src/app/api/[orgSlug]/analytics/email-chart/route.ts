import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getEmailMetricsFromPostgres } from "@/lib/analytics-fallback";
import {
  aggregateByDate,
  gapFillDates,
  generateDateRange,
  validateTimezone,
} from "@/lib/analytics-utils";
import {
  getCloudWatchMetricsBatch,
  getSESReputationMetrics,
  SES_METRICS,
} from "@/lib/aws/cloudwatch";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

function buildEmailChartData(orgId: string, days: number, timezone: string) {
  return unstable_cache(
    async () => {
      const endTime = new Date();
      const startTime = new Date(
        endTime.getTime() - days * 24 * 60 * 60 * 1000
      );
      const period = days <= 7 ? 3600 : days <= 30 ? 3600 * 6 : 3600 * 24;

      const accounts = await db.query.awsAccount.findMany({
        where: eq(awsAccount.organizationId, orgId),
      });

      if (accounts.length === 0) {
        return {
          overview: {
            totalSent: 0,
            totalDelivered: 0,
            totalBounced: 0,
            totalComplaints: 0,
            totalRenderingFailures: 0,
            deliveryRate: 0,
            bounceRate: 0,
            complaintRate: 0,
          },
          volume: [],
          engagement: [],
        };
      }

      const allMetrics = [
        SES_METRICS.SEND,
        SES_METRICS.DELIVERY,
        SES_METRICS.BOUNCE,
        SES_METRICS.COMPLAINT,
        SES_METRICS.OPEN,
        SES_METRICS.CLICK,
        SES_METRICS.RENDERING_FAILURE,
      ];

      const [metricsResults, reputationResults] = await Promise.all([
        Promise.all(
          accounts.map(async (account) => {
            try {
              return await getCloudWatchMetricsBatch({
                awsAccountId: account.id,
                metrics: allMetrics,
                period,
                startTime,
                endTime,
              });
            } catch {
              return null;
            }
          })
        ),
        Promise.all(
          accounts.map(async (account) => {
            try {
              return await getSESReputationMetrics(account.id);
            } catch {
              return null;
            }
          })
        ),
      ]);

      const allKeys = [
        "sent",
        "delivered",
        "bounced",
        "complaints",
        "opens",
        "clicks",
        "renderingFailures",
      ] as const;
      let dailyMap = new Map<
        string,
        Record<(typeof allKeys)[number], number>
      >();

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
            metrics[SES_METRICS.RENDERING_FAILURE]?.[0]?.Values || [],
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
            renderingFailures: 0,
          };
          dailyMap.set(dateStr, {
            sent: existing.sent + values.sent,
            delivered: existing.delivered + values.delivered,
            bounced: existing.bounced + values.bounced,
            complaints: existing.complaints + values.complaints,
            opens: existing.opens + values.opens,
            clicks: existing.clicks + values.clicks,
            renderingFailures:
              existing.renderingFailures + values.renderingFailures,
          });
        }
      }

      const pgData = await getEmailMetricsFromPostgres(
        orgId,
        startTime,
        endTime,
        timezone
      );
      if (dailyMap.size === 0) {
        // CloudWatch returned nothing (no metrics yet, or all accounts errored)
        dailyMap = pgData;
      } else {
        // CloudWatch Open/Click are always empty — no CloudWatch event destination
        // is deployed — so engagement comes from Postgres message_send.
        for (const [dateStr, m] of pgData) {
          const existing = dailyMap.get(dateStr);
          if (existing) {
            existing.opens = m.opens;
            existing.clicks = m.clicks;
          } else {
            // Day present in Postgres but absent from CloudWatch (period/timezone
            // boundary) — CloudWatch contributed nothing for it, so use the full
            // Postgres row rather than dropping the day.
            dailyMap.set(dateStr, {
              sent: m.sent,
              delivered: m.delivered,
              bounced: m.bounced,
              complaints: m.complaints,
              opens: m.opens,
              clicks: m.clicks,
              renderingFailures: m.renderingFailures,
            });
          }
        }
      }

      let totalSent = 0;
      let totalDelivered = 0;
      let totalBounced = 0;
      let totalComplaints = 0;
      let totalRenderingFailures = 0;
      for (const day of dailyMap.values()) {
        totalSent += day.sent;
        totalDelivered += day.delivered;
        totalBounced += day.bounced;
        totalComplaints += day.complaints;
        totalRenderingFailures += day.renderingFailures;
      }

      const effectiveSent = Math.max(0, totalSent - totalRenderingFailures);

      const deliveryRate =
        effectiveSent > 0 ? (totalDelivered / effectiveSent) * 100 : 0;

      const reputationBounceRate = reputationResults.reduce<number | null>(
        (worst, r) => {
          if (r?.bounceRate == null) return worst;
          const pct = r.bounceRate * 100;
          return worst === null ? pct : Math.max(worst, pct);
        },
        null
      );
      const reputationComplaintRate = reputationResults.reduce<number | null>(
        (worst, r) => {
          if (r?.complaintRate == null) return worst;
          const pct = r.complaintRate * 100;
          return worst === null ? pct : Math.max(worst, pct);
        },
        null
      );

      const bounceRate =
        reputationBounceRate !== null
          ? reputationBounceRate
          : effectiveSent > 0
            ? (totalBounced / effectiveSent) * 100
            : 0;
      const complaintRate =
        reputationComplaintRate !== null
          ? reputationComplaintRate
          : effectiveSent > 0
            ? (totalComplaints / effectiveSent) * 100
            : 0;

      const dateRange = generateDateRange(startTime, endTime, timezone);
      const defaults = {
        sent: 0,
        delivered: 0,
        bounced: 0,
        complaints: 0,
        opens: 0,
        clicks: 0,
        renderingFailures: 0,
      };
      const filled = gapFillDates(dateRange, dailyMap, defaults);

      const volume = filled.map((d) => ({
        date: d.date,
        timestamp: d.timestamp,
        sent: Math.round(d.sent),
        delivered: Math.round(d.delivered),
        bounced: Math.round(d.bounced),
        opens: Math.round(d.opens),
        clicks: Math.round(d.clicks),
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

      return {
        overview: {
          totalSent: Math.round(totalSent),
          totalDelivered: Math.round(totalDelivered),
          totalBounced: Math.round(totalBounced),
          totalComplaints: Math.round(totalComplaints),
          totalRenderingFailures: Math.round(totalRenderingFailures),
          deliveryRate: Number(deliveryRate.toFixed(2)),
          bounceRate: Number(bounceRate.toFixed(2)),
          complaintRate: Number(complaintRate.toFixed(2)),
        },
        volume,
        engagement,
      };
    },
    ["email-chart", orgId, String(days), timezone],
    { revalidate: 300, tags: [`email-chart-${orgId}`] }
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

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

    const getCachedData = buildEmailChartData(
      orgWithMembership.id,
      days,
      timezone
    );
    const result = await getCachedData();
    return NextResponse.json(result);
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/analytics/email-chart",
      method: "GET",
    });
    log.error({ err: error }, "Error fetching email chart data");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
