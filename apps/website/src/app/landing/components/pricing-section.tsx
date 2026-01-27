"use client";

import { Check, Sparkles } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type BillingInterval,
  getCtaLink,
  getDisplayPrice,
  PRICING_COPY,
  PRICING_TIERS,
} from "@/config/pricing";
import { BillingToggle } from "./billing-toggle";
import { SectionWrapper } from "./section-card";

export const PricingSection = memo(function PricingSection() {
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  return (
    <SectionWrapper
      badge="Pricing"
      description={PRICING_COPY.subheadline}
      id="pricing"
      title={PRICING_COPY.headline}
    >
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
                      ${plan.annualPrice} billed annually (save 17%)
                    </div>
                  ) : (
                    <div className="mt-1 text-muted-foreground text-sm">
                      or ${plan.annualPrice}/yr (save 17%)
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
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Enterprise note */}
      <p className="mb-8 text-center text-muted-foreground text-sm">
        {PRICING_COPY.enterpriseNote.split("Contact us")[0]}
        <a
          className="text-primary hover:underline"
          href="mailto:support@wraps.dev"
        >
          Contact us for Enterprise
        </a>
      </p>

      {/* AWS Cost Note */}
      <div className="rounded-xl border bg-muted/30 p-6">
        <p className="mb-2 font-semibold text-foreground">
          AWS costs are separate
        </p>
        <p className="mb-4 text-muted-foreground text-sm">
          You pay AWS directly for sending at{" "}
          <strong className="text-foreground">$0.10 per 1,000 emails</strong>{" "}
          plus infrastructure (~$2-5/mo). <br />
          Your sending infrastructure stays in your account — leave anytime,
          keep everything.
        </p>
        <Button asChild className="cursor-pointer" variant="outline">
          <a href="/calculator">Calculate Your Costs</a>
        </Button>
      </div>
    </SectionWrapper>
  );
});
