"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BillingToggle } from "./billing-toggle";

type BillingInterval = "monthly" | "annual";

const tiers = [
  {
    name: "Starter",
    price: 10,
    annualPrice: 100,
    events: "50,000",
    workflows: "5",
    retention: "30 days",
    description: "Templates + transactional email",
    features: [
      "Unlimited contacts",
      "Unlimited templates",
      "50 AI generations/mo",
      "Basic broadcasts",
      "Email analytics",
      "1 AWS account",
    ],
    highlighted: false,
    planId: "starter",
    ctaText: "Get Started",
  },
  {
    name: "Growth",
    price: 49,
    annualPrice: 490,
    events: "250,000",
    workflows: "25",
    retention: "90 days",
    description: "Add audience management & automation",
    features: [
      "Everything in Starter",
      "Topics & preference center",
      "Segments & targeting",
      "Scheduled campaigns",
      "Workflow automations",
      "250 AI generations/mo",
      "3 AWS accounts",
    ],
    highlighted: true,
    popular: true,
    planId: "growth",
    ctaText: "Get Started",
  },
  {
    name: "Scale",
    price: 149,
    annualPrice: 1490,
    events: "1,000,000",
    workflows: "Unlimited",
    retention: "1 year",
    description: "High-volume + advanced automation",
    features: [
      "Everything in Growth",
      // "Advanced event segments",
      "1,000 AI generations/mo",
      "Unlimited AWS accounts",
      "Dedicated support",
    ],
    highlighted: false,
    planId: "scale",
    ctaText: "Get Started",
  },
];

export function DashboardPricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  const getCtaLink = (tier: (typeof tiers)[0]) => {
    const annual = billingInterval === "annual" ? "&annual=true" : "";
    return `https://app.wraps.dev/auth?mode=signup&plan=${tier.planId}${annual}`;
  };

  const getDisplayPrice = (tier: (typeof tiers)[0]) => {
    if (billingInterval === "annual") {
      // Annual price per month (17% off)
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
            Unlimited contacts. Gate on events. No per-seat fees.
          </p>
          <BillingToggle
            onChange={setBillingInterval}
            value={billingInterval}
          />
        </motion.div>

        {/* Pricing cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((tier, index) => {
            return (
              <motion.div
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
                }
                className={`relative overflow-hidden rounded-2xl border-2 bg-background ${
                  tier.highlighted ? "border-orange-500" : "border-border"
                }`}
                initial={{ opacity: 0, y: 30 }}
                key={tier.name}
                transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 font-medium text-white text-xs">
                      <Sparkles className="size-3" />
                      Popular
                    </span>
                  </div>
                )}

                {/* Header */}
                <div
                  className={`border-b px-6 py-6 ${
                    tier.highlighted ? "bg-orange-500/5" : "bg-muted/30"
                  }`}
                >
                  <div
                    className={`mb-1 font-semibold ${
                      tier.highlighted ? "text-orange-500" : "text-foreground"
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
                  {billingInterval === "annual" ? (
                    <div className="mt-1 text-green-600 text-sm dark:text-green-400">
                      ${tier.annualPrice} billed annually (save 17%)
                    </div>
                  ) : (
                    <div className="mt-1 text-muted-foreground text-sm">
                      or ${tier.annualPrice}/yr (save 17%)
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block font-medium text-foreground">
                        {tier.events}
                      </span>
                      events/mo
                    </div>
                    <div>
                      <span className="block font-medium text-foreground">
                        {tier.workflows}
                      </span>
                      workflows
                    </div>
                    <div>
                      <span className="block font-medium text-foreground">
                        {tier.retention}
                      </span>
                      history
                    </div>
                  </div>
                  <p className="mt-3 text-muted-foreground text-sm">
                    {tier.description}
                  </p>
                </div>

                {/* Features */}
                <div className="p-6">
                  <ul className="mb-6 space-y-2.5">
                    {tier.features.map((feature) => (
                      <li
                        className="flex items-start gap-2 text-sm"
                        key={feature}
                      >
                        <Check
                          className={`mt-0.5 size-4 shrink-0 ${
                            tier.highlighted
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
                    className={`w-full ${tier.highlighted ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                    size="lg"
                    variant={tier.highlighted ? "default" : "outline"}
                  >
                    <a href={getCtaLink(tier)}>
                      {tier.ctaText}
                      <ArrowRight className="ml-2 size-4" />
                    </a>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Founding Member Program */}
        <motion.div
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="mt-10 rounded-xl border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xl">🚀</span>
            <p className="font-semibold text-orange-800 dark:text-orange-200">
              Founding Member Program — First 100 Customers
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-orange-700 text-sm dark:text-orange-300 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              <span>Direct Slack access to the founder</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              <span>Input on roadmap priorities</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              <span>Your logo on our website</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              <span>Locked-in pricing for life</span>
            </div>
          </div>
        </motion.div>

        {/* Footer note */}
        <motion.p
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="mt-6 text-center text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          AWS costs billed separately by AWS (~$0.10 per 1,000 emails). CLI and
          SDK are free forever.
        </motion.p>
      </div>
    </section>
  );
}
