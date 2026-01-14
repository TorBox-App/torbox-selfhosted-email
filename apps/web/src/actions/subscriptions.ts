"use server";

import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { subscription } from "@wraps/db/schema/auth";
import { eq } from "drizzle-orm";

export type SubscriptionData = {
  id: string;
  plan: string;
  status: string;
  annual: boolean | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
  trialStart: Date | null;
  trialEnd: Date | null;
};

export type GetSubscriptionResult =
  | {
      success: true;
      subscription: SubscriptionData | null;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Get subscription for an organization.
 * This fetches directly from our DB to include custom fields like `annual`.
 */
export async function getOrganizationSubscription(
  organizationId: string
): Promise<GetSubscriptionResult> {
  try {
    // 1. Get session
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to view subscription",
      };
    }

    // 2. Verify user is a member of the organization
    const membership = await db.query.member.findFirst({
      where: (members, { and, eq: eqOp }) =>
        and(
          eqOp(members.userId, session.user.id),
          eqOp(members.organizationId, organizationId)
        ),
    });

    if (!membership) {
      return {
        success: false,
        error: "You are not a member of this organization",
      };
    }

    // 3. Fetch subscription from DB
    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.referenceId, organizationId),
    });

    if (!sub) {
      return {
        success: true,
        subscription: null,
      };
    }

    return {
      success: true,
      subscription: {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        annual: sub.annual,
        periodStart: sub.periodStart,
        periodEnd: sub.periodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        trialStart: sub.trialStart,
        trialEnd: sub.trialEnd,
      },
    };
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return {
      success: false,
      error: "Failed to fetch subscription",
    };
  }
}
