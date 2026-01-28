"use client";

import { Check, Sparkles } from "lucide-react";
import { memo, useState } from "react";
import { TrackedEventTooltip } from "@/components/tracked-event-tooltip";
import { Button } from "@/components/ui/button";
import {
  type BillingInterval,
  getCtaLink,
  getDisplayPrice,
  PRICING_TIERS,
} from "@/config/pricing";
import { BillingToggle } from "./billing-toggle";

/**
 * Renders a feature string, replacing only "tracked events" with a tooltip
 * while keeping surrounding text (numbers, "/month", etc.) as regular text
 */
function FeatureText({ text }: { text: string }) {
  if (!text.toLowerCase().includes("tracked events")) {
    return <>{text}</>;
  }

  // Split on "tracked events" (case-insensitive) and reassemble with tooltip
  const parts = text.split(/(tracked events)/i);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === "tracked events" ? (
          <TrackedEventTooltip key={i}>{part}</TrackedEventTooltip>
        ) : (
          part
        )
      )}
    </>
  );
}

export const PricingCards = memo(function PricingCards() {
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  return (
    <>
      {/* Billing Toggle */}
      <div className="mb-8 flex justify-center">
        <BillingToggle onChange={setBillingInterval} value={billingInterval} />
      </div>

      {/* Pricing Cards */}
      <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PRICING_TIERS.map((plan) => (
          <div
            className={`relative overflow-hidden rounded-2xl border bg-background ${plan.highlight ? "border-2 border-orange-500" : ""}`}
            key={plan.name}
          >
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 font-medium text-white text-xs">
                  <Sparkles aria-hidden="true" className="h-3 w-3" />
                  Popular
                </span>
              </div>
            )}

            <div className="p-6">
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
              </div>

              <div className="mb-4">
                <span className="font-bold text-3xl">
                  ${getDisplayPrice(plan, billingInterval)}
                </span>
                <span className="text-muted-foreground">{plan.period}</span>
                {plan.annualPrice &&
                  (billingInterval === "annual" ? (
                    <div className="mt-1 text-green-600 text-sm">
                      ${plan.annualPrice} billed annually{" "}
                    </div>
                  ) : (
                    <div className="mt-1 text-muted-foreground text-sm">
                      or ${plan.annualPrice}/yr{" "}
                    </div>
                  ))}
              </div>

              {plan.ctaLink ? (
                <Button
                  asChild
                  className={`mb-6 w-full cursor-pointer ${plan.highlight ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                  size="default"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  <a href={getCtaLink(plan, billingInterval)}>{plan.cta}</a>
                </Button>
              ) : (
                <Button
                  className="mb-6 w-full cursor-not-allowed opacity-60"
                  disabled
                  size="default"
                  variant="outline"
                >
                  {plan.cta}
                </Button>
              )}

              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li className="flex items-start gap-2" key={feature}>
                    <Check
                      aria-hidden="true"
                      className={`mt-0.5 size-4 shrink-0 ${plan.highlight ? "text-orange-500" : "text-muted-foreground"}`}
                      strokeWidth={2.5}
                    />
                    <span className="text-sm">
                      <FeatureText text={feature} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </>
  );
});
