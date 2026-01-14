"use client";

import { CreditCardIcon, ZapIcon } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BillingToggle } from "@/components/billing-toggle";
import { PlanSelector } from "@/components/plan-selector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import {
  getAnnualTotal,
  getPriceByInterval,
  hasEarlyAdopterPricing,
  PLANS,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";

type BillingStepProps = {
  onNext: () => void;
  onBack: () => void;
  organizationId: string;
};

export function BillingStep({
  onNext,
  onBack,
  organizationId,
}: BillingStepProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = params.orgSlug as string;

  // Get plan from URL param or localStorage, default to starter
  const planParam = searchParams.get("plan") as PlanId | null;
  const storedPlan =
    typeof window !== "undefined"
      ? (localStorage.getItem(`onboarding_plan_${orgSlug}`) as PlanId | null)
      : null;
  const initialPlan: PlanId =
    (planParam && ["starter", "pro", "growth", "scale"].includes(planParam)
      ? planParam
      : storedPlan &&
          ["starter", "pro", "growth", "scale"].includes(storedPlan)
        ? storedPlan
        : null) ?? "starter";

  // Get billing interval from URL param or localStorage, default to monthly
  const intervalParam = searchParams.get("interval") as BillingInterval | null;
  const storedInterval =
    typeof window !== "undefined"
      ? (localStorage.getItem(
          `onboarding_interval_${orgSlug}`
        ) as BillingInterval | null)
      : null;
  const initialInterval: BillingInterval =
    (intervalParam && ["monthly", "annual"].includes(intervalParam)
      ? intervalParam
      : storedInterval && ["monthly", "annual"].includes(storedInterval)
        ? storedInterval
        : null) ?? "monthly";

  const [selectedPlan, setSelectedPlan] = useState<PlanId>(initialPlan);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>(initialInterval);
  const [isLoading, setIsLoading] = useState(false);

  const plan = PLANS[selectedPlan];

  const handleSubscribe = async () => {
    setIsLoading(true);

    try {
      // Mark onboarding complete before redirecting to Stripe
      await fetch(`/api/${orgSlug}/onboarding/complete`, {
        method: "POST",
      });

      // Start Stripe checkout for selected plan
      const result = await authClient.subscription.upgrade({
        plan: selectedPlan,
        annual: billingInterval === "annual",
        referenceId: organizationId,
        successUrl: `${window.location.origin}/${orgSlug}/emails?subscribed=true`,
        cancelUrl: `${window.location.origin}/${orgSlug}/onboarding?step=5&plan=${selectedPlan}&interval=${billingInterval}`,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to start checkout");
        setIsLoading(false);
      }
      // Stripe will redirect automatically
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start subscription"
      );
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <CreditCardIcon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle>Choose Your Plan</CardTitle>
        <CardDescription>
          Get full access to the Wraps Platform.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Billing Interval Toggle */}
        <BillingToggle onChange={setBillingInterval} value={billingInterval} />

        {/* Plan Selector */}
        <PlanSelector
          billingInterval={billingInterval}
          onSelectPlan={setSelectedPlan}
          selectedPlan={selectedPlan}
        />

        {/* Selected Plan Summary */}
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{plan.name} Plan</h3>
              <p className="text-muted-foreground text-sm">
                {plan.description}
              </p>
            </div>
            <div className="text-right">
              <span className="font-bold text-2xl">
                ${getPriceByInterval(plan, billingInterval)}
              </span>
              {hasEarlyAdopterPricing(plan) && (
                <span className="ml-1 text-muted-foreground line-through">
                  ${billingInterval === "annual" ? plan.annualPrice : plan.price}
                </span>
              )}
              <span className="text-muted-foreground">/mo</span>
            </div>
          </div>
          {billingInterval === "annual" && getAnnualTotal(plan) && (
            <p className="mt-1 text-green-600 text-sm">
              ${getAnnualTotal(plan)} billed annually
            </p>
          )}
          {hasEarlyAdopterPricing(plan) && (
            <p className="mt-2 text-green-600 text-xs">
              Early adopter pricing - your rate stays locked forever
            </p>
          )}
        </div>

        {/* AWS Costs Note */}
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2">
            <ZapIcon className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">AWS costs are separate</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            Your subscription covers the Wraps dashboard. You'll pay AWS
            directly for email sending ($0.10 per 1,000 emails) and
            infrastructure (~$2-5/mo for most apps).
          </p>
        </div>

        {/* CLI-only alternative */}
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-muted-foreground text-sm">
            Just want the CLI?{" "}
            <a
              className="font-medium text-primary hover:underline"
              href="https://wraps.dev/docs/cli"
              rel="noopener noreferrer"
              target="_blank"
            >
              Use Wraps free forever
            </a>{" "}
            without a dashboard account.
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <Button disabled={isLoading} onClick={onBack} variant="outline">
          Back
        </Button>
        <Button loading={isLoading} onClick={handleSubscribe} size="lg">
          Subscribe to {plan.name}
        </Button>
      </CardFooter>
    </Card>
  );
}
