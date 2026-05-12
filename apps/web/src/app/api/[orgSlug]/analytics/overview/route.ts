import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getEmailMetricsFromPostgres } from "@/lib/analytics-fallback";
import {
  getSESMetricsSummary,
  getSESReputationMetrics,
} from "@/lib/aws/cloudwatch";
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
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        totalSent: 0,
        totalDelivered: 0,
        totalBounced: 0,
        totalComplaints: 0,
        totalRenderingFailures: 0,
        deliveryRate: 0,
        bounceRate: 0,
        complaintRate: 0,
      });
    }

    const [metricsResults, reputationResults] = await Promise.all([
      Promise.all(
        accounts.map(async (account) => {
          try {
            return await getSESMetricsSummary({
              awsAccountId: account.id,
              startTime,
              endTime,
              period: 3600,
            });
          } catch (error) {
            log.error(
              { err: serializeError(error), accountId: account.id },
              "Failed to fetch metrics for account"
            );
            return null;
          }
        })
      ),
      Promise.all(
        accounts.map(async (account) => {
          try {
            return await getSESReputationMetrics(account.id);
          } catch (error) {
            log.error(
              { err: serializeError(error), accountId: account.id },
              "Failed to fetch reputation metrics for account"
            );
            return null;
          }
        })
      ),
    ]);

    const calculateTotal = (
      metricName:
        | "sends"
        | "deliveries"
        | "bounces"
        | "complaints"
        | "renderingFailures"
    ) =>
      metricsResults.reduce((total, metrics) => {
        if (!metrics) {
          return total;
        }
        const values = metrics[metricName]?.[0]?.Values || [];
        return total + values.reduce((sum, val) => sum + (val || 0), 0);
      }, 0);

    let totalSent = calculateTotal("sends");
    let totalDelivered = calculateTotal("deliveries");
    let totalBounced = calculateTotal("bounces");
    let totalComplaints = calculateTotal("complaints");
    let totalRenderingFailures = calculateTotal("renderingFailures");

    // Fallback to PostgreSQL message_send when CloudWatch returns no data
    if (totalSent === 0) {
      const pgData = await getEmailMetricsFromPostgres(
        orgWithMembership.id,
        startTime,
        endTime
      );
      for (const m of pgData.values()) {
        totalSent += m.sent;
        totalDelivered += m.delivered;
        totalBounced += m.bounced;
        totalComplaints += m.complaints;
        totalRenderingFailures += m.renderingFailures;
      }
    }

    // Rendering failures are counted as "sends" by CloudWatch but never
    // actually left SES. Subtract them to get the true send denominator.
    const effectiveSent = Math.max(0, totalSent - totalRenderingFailures);

    const deliveryRate =
      effectiveSent > 0 ? (totalDelivered / effectiveSent) * 100 : 0;

    // Use SES account-level reputation metrics for bounce/complaint rates when
    // available. SES computes these over its own rolling window (covering full
    // account history), which matches what the SES console displays. Computing
    // rates from period-filtered sends produces inflated numbers for accounts
    // with low recent volume (e.g., 1 bounce / 13 sends = 7.5% vs SES's 0.02%).
    //
    // Reputation metrics are decimals (0–1); multiply by 100 for percentages.
    // Take the worst rate across accounts since each account's reputation is
    // independent and any bad actor affects the org's health.
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

    return NextResponse.json({
      totalSent: Math.round(totalSent),
      totalDelivered: Math.round(totalDelivered),
      totalBounced: Math.round(totalBounced),
      totalComplaints: Math.round(totalComplaints),
      totalRenderingFailures: Math.round(totalRenderingFailures),
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
