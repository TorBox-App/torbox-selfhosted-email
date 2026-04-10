import { auth } from "@wraps/auth";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getEmailMetricsFromPostgres } from "@/lib/analytics-fallback";
import {
  gapFillDates,
  generateDateRange,
  validateTimezone,
} from "@/lib/analytics-utils";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

async function buildEmailChartData(
  orgId: string,
  days: number,
  timezone: string
) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

  const dailyMap = await getEmailMetricsFromPostgres(
    orgId,
    startTime,
    endTime,
    timezone
  );

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
  const bounceRate =
    effectiveSent > 0 ? (totalBounced / effectiveSent) * 100 : 0;
  const complaintRate =
    effectiveSent > 0 ? (totalComplaints / effectiveSent) * 100 : 0;

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
    sent: d.sent,
    delivered: d.delivered,
    bounced: d.bounced,
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
      totalSent,
      totalDelivered,
      totalBounced,
      totalComplaints,
      totalRenderingFailures,
      deliveryRate: Number(deliveryRate.toFixed(2)),
      bounceRate: Number(bounceRate.toFixed(2)),
      complaintRate: Number(complaintRate.toFixed(2)),
    },
    volume,
    engagement,
  };
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

    const getCachedData = unstable_cache(
      buildEmailChartData,
      ["email-chart", orgWithMembership.id, String(days), timezone],
      { revalidate: 300, tags: [`email-chart-${orgWithMembership.id}`] }
    );
    const result = await getCachedData(orgWithMembership.id, days, timezone);
    return NextResponse.json(result);
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
