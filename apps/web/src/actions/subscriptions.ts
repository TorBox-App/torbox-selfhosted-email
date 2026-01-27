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
export type CreateFreeSubscriptionResult =
  | {
      success: true;
      subscription: SubscriptionData;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Create a free subscription for an organization.
 * Used during onboarding when user selects the free plan.
 */
export async function createFreeSubscription(
  organizationId: string
): Promise<CreateFreeSubscriptionResult> {
  try {
    // 1. Get session
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to create a subscription",
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

    // 3. Check if subscription already exists
    const existingSub = await db.query.subscription.findFirst({
      where: eq(subscription.referenceId, organizationId),
    });

    if (existingSub) {
      // Already has a subscription, return it
      return {
        success: true,
        subscription: {
          id: existingSub.id,
          plan: existingSub.plan,
          status: existingSub.status,
          annual: existingSub.annual,
          periodStart: existingSub.periodStart,
          periodEnd: existingSub.periodEnd,
          cancelAtPeriodEnd: existingSub.cancelAtPeriodEnd,
          trialStart: existingSub.trialStart,
          trialEnd: existingSub.trialEnd,
        },
      };
    }

    // 4. Create free subscription
    const subscriptionId = crypto.randomUUID();
    const now = new Date();

    await db.insert(subscription).values({
      id: subscriptionId,
      plan: "free",
      referenceId: organizationId,
      status: "active",
      // No Stripe fields for free plan
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      // No billing period for free plan
      periodStart: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      seats: 1,
      annual: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      subscription: {
        id: subscriptionId,
        plan: "free",
        status: "active",
        annual: false,
        periodStart: null,
        periodEnd: null,
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      },
    };
  } catch (error) {
    console.error("Error creating free subscription:", error);
    return {
      success: false,
      error: "Failed to create subscription",
    };
  }
}

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
