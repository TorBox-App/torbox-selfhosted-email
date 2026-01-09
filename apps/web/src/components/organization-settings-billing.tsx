"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  CreditCardIcon,
  ExternalLinkIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Loader from "@/components/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { PLANS, type PlanId } from "@/lib/plans";

type OrganizationSettingsBillingProps = {
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  userRole: "owner" | "admin" | "member";
};

export function OrganizationSettingsBilling({
  organization,
  userRole,
}: OrganizationSettingsBillingProps) {
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const canManageBilling = userRole === "owner" || userRole === "admin";

  // Get subscriptions for this organization
  const { data: subscriptions, isLoading: loadingSubscriptions } = useQuery({
    queryKey: ["subscriptions", organization.id],
    queryFn: async () => {
      if (!organization.id) {
        return [];
      }
      return authClient.subscription.list({
        query: { referenceId: organization.id },
      });
    },
    enabled: !!organization.id,
  });

  // Find active subscription
  const activeSubscription = (subscriptions as any)?.data?.find(
    (sub: { status: string }) =>
      sub.status === "active" || sub.status === "trialing"
  );

  const currentPlan = (activeSubscription?.plan || "starter") as PlanId;
  const planConfig = PLANS[currentPlan] || PLANS.starter;
  const isTrialing = activeSubscription?.status === "trialing";
  const isCancelled = activeSubscription?.cancelAtPeriodEnd === true;

  // Mutations
  const billingPortalMutation = useMutation({
    mutationFn: async () =>
      authClient.subscription.billingPortal({
        referenceId: organization.id,
        returnUrl: `${window.location.origin}/${organization.slug}/settings/billing`,
      }),
    onSuccess: (result) => {
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to open billing portal");
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (plan: string) =>
      authClient.subscription.upgrade({
        plan,
        referenceId: organization.id,
        successUrl: `${window.location.origin}/${organization.slug}/settings/billing?subscribed=true`,
        cancelUrl: `${window.location.origin}/${organization.slug}/settings/billing`,
      }),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upgrade subscription");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (subscriptionId: string) =>
      authClient.subscription.cancel({
        referenceId: organization.id,
        subscriptionId,
        returnUrl: `${window.location.origin}/${organization.slug}/settings/billing`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", organization.id],
      });
      setShowCancelDialog(false);
      toast.success("Subscription cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel subscription");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (subscriptionId: string) =>
      authClient.subscription.restore({
        referenceId: organization.id,
        subscriptionId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", organization.id],
      });
      toast.success("Subscription restored successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to restore subscription");
    },
  });

  if (loadingSubscriptions) {
    return <Loader />;
  }

  const trialEndsAt = activeSubscription?.trialEnd
    ? new Date(activeSubscription.trialEnd)
    : null;

  const periodEndsAt = activeSubscription?.periodEnd
    ? new Date(activeSubscription.periodEnd)
    : null;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Plan
                {isTrialing && <Badge variant="secondary">Free Trial</Badge>}
                {isCancelled && <Badge variant="destructive">Cancelling</Badge>}
              </CardTitle>
              <CardDescription>
                {isTrialing && trialEndsAt
                  ? `Your trial ends on ${trialEndsAt.toLocaleDateString()}`
                  : isCancelled && periodEndsAt
                    ? `Access ends on ${periodEndsAt.toLocaleDateString()}`
                    : "You're currently on this plan"}
              </CardDescription>
            </div>
            {activeSubscription && canManageBilling && (
              <Button
                loading={billingPortalMutation.isPending}
                onClick={() => billingPortalMutation.mutate()}
                variant="outline"
              >
                <CreditCardIcon className="mr-2 size-4" />
                Manage Billing
                <ExternalLinkIcon className="ml-2 size-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-4xl">{planConfig.name}</span>
            {planConfig.price !== null && planConfig.price > 0 && (
              <span className="text-muted-foreground">
                ${planConfig.price}
                {planConfig.period}
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {planConfig.featureList.map((feature) => (
              <li className="flex items-start gap-2 text-sm" key={feature}>
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {isCancelled && periodEndsAt && (
            <div className="flex items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Your subscription will end on{" "}
                {periodEndsAt.toLocaleDateString()}
              </p>
              <Button
                disabled={!canManageBilling}
                loading={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(activeSubscription.id)}
                size="sm"
                variant="outline"
              >
                Restore
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      {!isCancelled && currentPlan !== "growth" && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Your Plan</CardTitle>
            <CardDescription>
              Unlock more features and increase your limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Pro Plan */}
              {currentPlan === "starter" && (
                <div className="space-y-4 rounded-lg border p-6">
                  <div>
                    <h3 className="font-semibold text-lg">{PLANS.pro.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-bold text-3xl">
                        ${PLANS.pro.price}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {PLANS.pro.period}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {PLANS.pro.description}
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {PLANS.pro.featureList.slice(0, 4).map((feature) => (
                      <li
                        className="flex items-start gap-2 text-sm"
                        key={feature}
                      >
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    disabled={!canManageBilling}
                    loading={upgradeMutation.isPending}
                    onClick={() => upgradeMutation.mutate("pro")}
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              )}

              {/* Growth Plan */}
              <div className="space-y-4 rounded-lg border p-6">
                <div>
                  <h3 className="font-semibold text-lg">{PLANS.growth.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-bold text-3xl">
                      ${PLANS.growth.price}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {PLANS.growth.period}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {PLANS.growth.description}
                  </p>
                </div>

                <ul className="space-y-2">
                  {PLANS.growth.featureList.slice(0, 4).map((feature) => (
                    <li
                      className="flex items-start gap-2 text-sm"
                      key={feature}
                    >
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  disabled={!canManageBilling}
                  loading={upgradeMutation.isPending}
                  onClick={() => upgradeMutation.mutate("growth")}
                  variant={currentPlan === "starter" ? "outline" : "default"}
                >
                  Upgrade to Growth
                </Button>
              </div>
            </div>

            {!canManageBilling && (
              <p className="mt-4 text-center text-muted-foreground text-xs">
                Only organization owners and admins can manage billing
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* AWS Infrastructure Costs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ZapIcon className="size-5 text-primary" />
            <CardTitle>AWS Infrastructure Costs</CardTitle>
          </div>
          <CardDescription>
            Separate from your Wraps subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-sm">
          <p>
            <strong className="text-foreground">Email Sending:</strong> $0.10
            per 1,000 emails (paid directly to AWS)
          </p>
          <p>
            <strong className="text-foreground">Infrastructure:</strong>{" "}
            ~$2-5/month for DynamoDB, Lambda, EventBridge
          </p>
          <p className="text-xs">
            Free tier: First 3,000 emails/month are free for new AWS accounts
          </p>
        </CardContent>
      </Card>

      {/* Cancel Subscription */}
      {activeSubscription && !isCancelled && (
        <div className="border-t pt-6">
          <Button
            className="text-muted-foreground hover:text-destructive"
            disabled={!canManageBilling}
            onClick={() => setShowCancelDialog(true)}
            variant="ghost"
          >
            Cancel Subscription
          </Button>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!cancelMutation.isPending) {
            setShowCancelDialog(open);
          }
        }}
        open={showCancelDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel? You'll lose access to the
              dashboard at the end of your billing period
              {periodEndsAt && ` on ${periodEndsAt.toLocaleDateString()}`}. You
              can still use the CLI and SDK for free.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={cancelMutation.isPending}
              onClick={() => setShowCancelDialog(false)}
              variant="outline"
            >
              Keep Subscription
            </Button>
            <Button
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(activeSubscription?.id)}
              variant="destructive"
            >
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
