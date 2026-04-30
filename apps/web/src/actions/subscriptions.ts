"use server";

import {
  createFreeSubscription as dbCreateFreeSubscription,
  getActiveSubscription,
} from "@wraps/db";
import { checkPermission } from "./shared/permissions";
import { verifyOrgAccess } from "./shared/verify-org-access";

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
export async function createFreeSubscription(
  organizationId: string
): Promise<CreateFreeSubscriptionResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) return { success: false, error: "No access" };

    const permError = checkPermission(access.role, "billing", ["write"]);
    if (permError) return permError;

    const existingSub = await getActiveSubscription(organizationId);
    if (existingSub) {
      return { success: true, subscription: toSubscriptionData(existingSub) };
    }

    const created = await dbCreateFreeSubscription(
      organizationId,
      access.userId
    );
    return { success: true, subscription: toSubscriptionData(created) };
  } catch (error) {
    return { success: false, error: "Failed to create subscription" };
  }
}

export async function getOrganizationSubscription(
  organizationId: string
): Promise<GetSubscriptionResult> {
  try {
    const access = await verifyOrgAccess(organizationId);
    if (!access) return { success: false, error: "No access" };

    const permError = checkPermission(access.role, "billing", ["read"]);
    if (permError) return permError;

    const sub = await getActiveSubscription(organizationId);
    return {
      success: true,
      subscription: sub ? toSubscriptionData(sub) : null,
    };
  } catch (error) {
    return { success: false, error: "Failed to fetch subscription" };
  }
}

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
