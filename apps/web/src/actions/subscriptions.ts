"use server";

import {
  createFreeSubscription as dbCreateFreeSubscription,
  getActiveSubscription,
} from "@wraps/db";
import { orgAction } from "./shared/org-action";

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
export const createFreeSubscription = orgAction(
  {
    name: "createFreeSubscription",
    resource: "billing",
    permission: ["write"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to create subscription",
  },
  async (
    ctx,
    organizationId: string
  ): Promise<CreateFreeSubscriptionResult> => {
    const existingSub = await getActiveSubscription(organizationId);
    if (existingSub) {
      return { success: true, subscription: toSubscriptionData(existingSub) };
    }

    const created = await dbCreateFreeSubscription(
      organizationId,
      ctx.access.userId
    );
    return { success: true, subscription: toSubscriptionData(created) };
  }
);

export const getOrganizationSubscription = orgAction(
  {
    name: "getOrganizationSubscription",
    resource: "billing",
    permission: ["read"],
    orgId: (organizationId: string) => organizationId,
    onError: "Failed to fetch subscription",
  },
  async (ctx, organizationId: string): Promise<GetSubscriptionResult> => {
    const sub = await getActiveSubscription(organizationId);
    return {
      success: true,
      subscription: sub ? toSubscriptionData(sub) : null,
    };
  }
);

function toSubscriptionData(sub: {
  id: string;
  plan: string;
  status: string;
  annual: boolean | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
  trialStart: Date | null;
  trialEnd: Date | null;
}): SubscriptionData {
  return {
    id: sub.id,
    plan: sub.plan,
    status: sub.status,
    annual: sub.annual,
    periodStart: sub.periodStart,
    periodEnd: sub.periodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialStart: sub.trialStart,
    trialEnd: sub.trialEnd,
  };
}
