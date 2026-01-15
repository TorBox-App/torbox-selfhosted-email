"use client";

import { ArrowRight, Check, Mail, Sparkles } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BillingToggle } from "./billing-toggle";

type BillingInterval = "monthly" | "annual";

const tiers = [
  {
    name: "Starter",
    price: 10,
    regularPrice: 19,
    annualPrice: 8,
    annualRegularPrice: 16,
    annualTotal: 100,
    contacts: "5,000",
    description: "Templates + transactional email",
    features: [
      "Unlimited templates",
      "50 AI generations/mo",
      "Basic broadcasts",
      "Email analytics",
      "1 AWS account",
    ],
    highlighted: false,
    earlyAdopter: true,
    planId: "starter",
    ctaText: "Get Started",
  },
  {
    name: "Pro",
    price: 30,
    regularPrice: 49,
    annualPrice: 25,
    annualRegularPrice: 41,
    annualTotal: 300,
    contacts: "25,000",
    description: "Add audience management",
    features: [
      "Everything in Starter",
      "Topics & preference center",
      "Segments & targeting",
      "Scheduled campaigns",
      "250 AI generations/mo",
      "3 AWS accounts",
    ],
    highlighted: true,
    popular: true,
    earlyAdopter: true,
    planId: "pro",
    ctaText: "Get Started",
  },
  {
    name: "Growth",
    price: 99,
    regularPrice: 149,
    annualPrice: 83,
    annualRegularPrice: 125,
    annualTotal: 990,
    contacts: "100,000",
    description: "Add automation & events",
    features: [
      "Everything in Pro",
      "Workflow automations",
      "Event tracking",
      "Advanced segments",
      "1,000 AI generations/mo",
      "Unlimited AWS accounts",
    ],
    highlighted: false,
    earlyAdopter: true,
    comingSoon: true,
    planId: "growth",
    ctaText: "Request Early Access",
  },
];

export function DashboardPricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  const getCtaLink = (tier: (typeof tiers)[0]) => {
    if (tier.comingSoon) {
      return "mailto:jarod@wraps.dev?subject=Growth%20Plan%20Early%20Access";
    }
    return `https://app.wraps.dev/auth?mode=signup&plan=${tier.planId}&interval=${billingInterval}`;
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
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Features unlock as you grow. No per-seat fees. No hidden costs.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <BillingToggle
            onChange={setBillingInterval}
            value={billingInterval}
          />
        </motion.div>

        {/* Pricing cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((tier, index) => {
            const displayPrice =
              billingInterval === "annual" ? tier.annualPrice : tier.price;
            const regularPrice =
              billingInterval === "annual"
                ? tier.annualRegularPrice
                : tier.regularPrice;

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
                {/* Badges - top left */}
                <div className="absolute top-4 left-4 flex gap-2">
                  {tier.earlyAdopter && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 font-medium text-white text-xs">
                      Early Adopter
                    </span>
                  )}
                  {tier.comingSoon && (
                    <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-medium text-blue-600 text-xs dark:text-blue-400">
                      <Sparkles className="size-3" />
                      Coming Soon
                    </span>
                  )}
                </div>

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
                  className={`border-b px-6 py-6 pt-14 ${
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
                    <span className="font-bold text-4xl">${displayPrice}</span>
                    {regularPrice && (
                      <span className="text-lg text-muted-foreground line-through">
                        ${regularPrice}
                      </span>
                    )}
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  {billingInterval === "annual" && (
                    <div className="mt-1 text-green-600 text-sm dark:text-green-400">
                      ${tier.annualTotal} billed annually
                    </div>
                  )}
                  <div className="mt-1 text-muted-foreground text-sm">
                    {tier.contacts} contacts
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
                      {tier.comingSoon ? (
                        <Mail className="ml-2 size-4" />
                      ) : (
                        <ArrowRight className="ml-2 size-4" />
                      )}
                    </a>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Early Adopter note */}
        <motion.div
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="mt-10 rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <p className="font-medium text-green-800 text-sm dark:text-green-200">
            🎉 Early Adopter Pricing — Grandfathered forever.
          </p>
          <p className="mt-1 text-green-700 text-xs dark:text-green-300">
            Sign up now and keep these rates even after prices increase. Your
            rate stays locked for as long as you're a customer.
          </p>
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
