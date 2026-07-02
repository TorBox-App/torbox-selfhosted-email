import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getEmailMetricsFromPostgres } from "@/lib/analytics-fallback";
import {
  gapFillDates,
  generateDateRange,
  validateTimezone,
} from "@/lib/analytics-utils";
import { createRequestLogger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

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
      Math.max(1, Number.parseInt(searchParams.get("days") || "90", 10))
    );
    const timezone = validateTimezone(searchParams.get("tz"));
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
    });

    if (accounts.length === 0) {
      return NextResponse.json([]);
    }

    // SES publishes no Open/Click metrics to CloudWatch without a CloudWatch
    // event destination (Wraps deploys EventBridge only) — Postgres
    // message_send is the only source of engagement data.
    const pgData = await getEmailMetricsFromPostgres(
      orgWithMembership.id,
      startTime,
      endTime,
      timezone
    );
    const dailyMap = new Map<
      string,
      { sent: number; delivered: number; opens: number; clicks: number }
    >();
    for (const [dateStr, m] of pgData) {
      dailyMap.set(dateStr, {
        sent: m.sent,
        delivered: m.delivered,
        opens: m.opens,
        clicks: m.clicks,
      });
    }

    const dateRange = generateDateRange(startTime, endTime, timezone);
    const dataPoints = gapFillDates(dateRange, dailyMap, {
      sent: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
    }).map((d) => {
      const openRate = d.delivered > 0 ? (d.opens / d.delivered) * 100 : 0;
      const clickRate = d.delivered > 0 ? (d.clicks / d.delivered) * 100 : 0;
      const ctr = d.opens > 0 ? (d.clicks / d.opens) * 100 : 0;

      return {
        date: d.date,
        timestamp: d.timestamp,
        openRate: Number(openRate.toFixed(1)),
        clickRate: Number(clickRate.toFixed(1)),
        ctr: Number(ctr.toFixed(1)),
      };
    });

    return NextResponse.json(dataPoints);
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/analytics/engagement",
      method: "GET",
    });
    log.error({ err: error }, "Error fetching engagement analytics");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
