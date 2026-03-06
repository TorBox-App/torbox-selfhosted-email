import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { messageSend } from "@wraps/db/schema";
import { awsAccount } from "@wraps/db/schema/app";
import { and, count, eq, gte, isNotNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSESMetricsSummary } from "@/lib/aws/cloudwatch";
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
      path: "/api/[orgSlug]/analytics/overview",
      method: "GET",
      orgSlug,
    });

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify organization membership
    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get time range from query params
    const { searchParams } = new URL(request.url);
    const days = Number.parseInt(searchParams.get("days") || "30", 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

    // Get all AWS accounts for this organization
    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        totalSent: 0,
        totalDelivered: 0,
        totalBounced: 0,
        totalComplaints: 0,
        deliveryRate: 0,
        bounceRate: 0,
        complaintRate: 0,
      });
    }

    // Fetch metrics for all accounts in parallel
    const metricsResults = await Promise.all(
      accounts.map(async (account) => {
        try {
          return await getSESMetricsSummary({
            awsAccountId: account.id,
            startTime,
            endTime,
            period: 3600, // 1 hour aggregation
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

    // Aggregate metrics across all accounts
    const calculateTotal = (
      metricName: "sends" | "deliveries" | "bounces" | "complaints"
    ) =>
      metricsResults.reduce((total, metrics) => {
        if (!metrics) {
          return total;
        }
        const values = metrics[metricName]?.[0]?.Values || [];
        return total + values.reduce((sum, val) => sum + (val || 0), 0);
      }, 0);

    const totalSent = calculateTotal("sends");
    const totalDelivered = calculateTotal("deliveries");
    const totalBounced = calculateTotal("bounces");
    const totalComplaints = calculateTotal("complaints");

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const complaintRate =
      totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0;

    // If CloudWatch has no data, fall back to PostgreSQL messageSend table
    if (totalSent === 0) {
      const [pgOverview] = await db
        .select({
          totalSent: count(),
          totalDelivered: count(messageSend.deliveredAt),
          totalBounced: count(messageSend.bouncedAt),
          totalComplaints: count(messageSend.complainedAt),
        })
        .from(messageSend)
        .where(
          and(
            eq(messageSend.organizationId, orgWithMembership.id),
            eq(messageSend.channel, "email"),
            isNotNull(messageSend.sentAt),
            gte(messageSend.sentAt, startTime),
            lte(messageSend.sentAt, endTime)
          )
        );

      if (pgOverview && Number(pgOverview.totalSent) > 0) {
        const pgSent = Number(pgOverview.totalSent);
        const pgDelivered = Number(pgOverview.totalDelivered);
        const pgBounced = Number(pgOverview.totalBounced);
        const pgComplaints = Number(pgOverview.totalComplaints);

        return NextResponse.json({
          totalSent: pgSent,
          totalDelivered: pgDelivered,
          totalBounced: pgBounced,
          totalComplaints: pgComplaints,
          deliveryRate: Number(((pgDelivered / pgSent) * 100).toFixed(2)),
          bounceRate: Number(((pgBounced / pgSent) * 100).toFixed(2)),
          complaintRate: Number(((pgComplaints / pgSent) * 100).toFixed(2)),
        });
      }
    }

    return NextResponse.json({
      totalSent: Math.round(totalSent),
      totalDelivered: Math.round(totalDelivered),
      totalBounced: Math.round(totalBounced),
      totalComplaints: Math.round(totalComplaints),
      deliveryRate: Number(deliveryRate.toFixed(2)),
      bounceRate: Number(bounceRate.toFixed(2)),
      complaintRate: Number(complaintRate.toFixed(2)),
    });
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/analytics/overview",
      method: "GET",
    });
    log.error(
      { err: serializeError(error) },
      "Error fetching analytics overview"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
