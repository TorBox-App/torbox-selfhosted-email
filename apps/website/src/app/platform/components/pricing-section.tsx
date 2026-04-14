"use client";

import { Button } from "@wraps/ui/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import {
  type BillingInterval,
  OVERAGE_RATES,
  PRICING_COPY,
  PRICING_TIERS,
  type PricingTier,
} from "@/config/pricing";
import { BillingToggle } from "./billing-toggle";

const allTiers = PRICING_TIERS;

export function DashboardPricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  const getCtaLink = (tier: PricingTier) => {
    const annual = billingInterval === "annual" ? "&annual=true" : "";
    return `https://app.wraps.dev/auth?mode=signup&plan=${tier.id}${annual}`;
  };

  const getDisplayPrice = (tier: PricingTier) => {
    if (billingInterval === "annual" && tier.annualPrice) {
      return Math.round(tier.annualPrice / 12);
    }
    return tier.price;
  };

  return (
    <section className="relative pt-32 pb-24" id="pricing" ref={ref}>
      {/* Diagonal transition from premium bg */}
      <div
        className="absolute inset-x-0 top-0 h-20 bg-stone-100/50 dark:bg-white/[0.06]"
        style={{
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-2 font-medium text-orange-500 text-sm">
            Grow Without Limits
          </p>
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            Simple, predictable pricing
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground mb-6">
            Unlimited contacts. Pay per message. No per-seat fees.
          </p>
          <BillingToggle
            onChange={setBillingInterval}
            value={billingInterval}
          />
        </motion.div>

        {/* Pricing cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {allTiers.map((tier) => {
            const overage = OVERAGE_RATES[tier.id];
            return (
              <div
                className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-background ${
                  tier.highlight ? "border-orange-500" : "border-border"
                }`}
                key={tier.name}
              >
                {/* Header */}
                <div
                  className={`border-b px-6 py-6 ${
                    tier.highlight ? "bg-orange-500/5" : "bg-muted/30"
                  }`}
                >
                  <div
                    className={`mb-1 font-semibold ${
                      tier.highlight ? "text-orange-500" : "text-foreground"
                    }`}
                  >
                    {tier.name}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-4xl">
                      ${getDisplayPrice(tier)}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  {tier.annualPrice &&
                    (billingInterval === "annual" ? (
                      <div className="mt-1 text-green-600 text-sm dark:text-green-400">
                        ${tier.annualPrice} billed annually{" "}
                      </div>
                    ) : (
                      <div className="mt-1 text-muted-foreground text-sm">
                        or ${tier.annualPrice}/yr{" "}
                      </div>
                    ))}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block font-medium text-foreground">
                        {tier.limits.messagesDisplay}
                      </span>
                      messages
                    </div>
                    <div>
                      <span className="block font-medium text-foreground">
                        {tier.limits.workflowsDisplay}
                      </span>
                      workflows
                    </div>
                  </div>
                  <p className="mt-3 text-muted-foreground text-sm">
                    {tier.description}
                  </p>
                </div>

                {/* Features */}
                <div className="flex flex-1 flex-col p-6">
                  <ul className="mb-6 space-y-2.5">
                    <li className="flex items-start gap-2 text-sm">
                      <Check
                        className={`mt-0.5 size-4 shrink-0 ${
                          tier.highlight ? "text-orange-500" : "text-green-500"
                        }`}
                      />
                      <span>Unlimited contacts</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check
                        className={`mt-0.5 size-4 shrink-0 ${
                          tier.highlight ? "text-orange-500" : "text-green-500"
                        }`}
                      />
                      <span>Then {overage.display}</span>
                    </li>
                    {tier.features.slice(2).map((feature) => (
                      <li
                        className="flex items-start gap-2 text-sm"
                        key={feature}
                      >
                        <Check
                          className={`mt-0.5 size-4 shrink-0 ${
                            tier.highlight
                              ? "text-orange-500"
                              : "text-green-500"
                          }`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className={`mt-auto w-full ${tier.highlight ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                    size="lg"
                    variant={tier.highlight ? "default" : "outline"}
                  >
                    <a href={getCtaLink(tier)}>
                      Get Started
                      <ArrowRight className="ml-2 size-4" />
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Founding Member Program */}
        <div className="mt-10 rounded-xl border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xl">🚀</span>
            <p className="font-semibold text-orange-800 dark:text-orange-200">
              {PRICING_COPY.foundingMemberTitle}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-orange-700 text-sm dark:text-orange-300 max-w-lg mx-auto">
            {PRICING_COPY.foundingMemberPerks.map((perk) => (
              <div className="flex items-center gap-2" key={perk}>
                <Check className="size-4 shrink-0" strokeWidth={2.5} />
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-muted-foreground text-sm">
          AWS costs billed separately by AWS (~$0.10 per 1,000 emails). Free
          tier available with 5,000 tracked events/month.
        </p>
      </div>
    </section>
  );
}
