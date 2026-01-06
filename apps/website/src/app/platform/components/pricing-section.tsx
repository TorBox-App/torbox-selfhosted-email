"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "@/app/landing/components/section-card";

const tiers = [
  {
    name: "Starter",
    price: 10,
    regularPrice: 19,
    contacts: "5,000",
    description: "Transactional email + simple broadcasts",
    features: [
      "Transactional + batch sending",
      "Wraps Platform access",
      "Unlimited templates",
      "50 AI generations/mo",
      "1 AWS account",
      "Email support (48hr)",
    ],
    highlighted: false,
    earlyAdopter: true,
    ctaLink: "https://app.wraps.dev/auth?mode=signup&plan=starter",
  },
  {
    name: "Pro",
    price: 30,
    regularPrice: 49,
    contacts: "25,000",
    description: "Add audience management",
    features: [
      "Everything in Starter",
      "Topics (subscriptions)",
      "Segments (targeting)",
      "Scheduled campaigns",
      "250 AI generations/mo",
      "3 AWS accounts",
    ],
    highlighted: true,
    popular: true,
    earlyAdopter: true,
    ctaLink: "https://app.wraps.dev/auth?mode=signup&plan=pro",
  },
  {
    name: "Growth",
    price: 149,
    regularPrice: null,
    contacts: "100,000",
    description: "Add automation & behavioral targeting",
    features: [
      "Everything in Pro",
      "Workflow automations",
      "Event tracking",
      "Advanced segments",
      "1,000 AI generations/mo",
      "Unlimited AWS accounts",
    ],
    highlighted: false,
    comingSoon: true,
    ctaLink: null,
  },
];

export function DashboardPricingSection() {
  return (
    <SectionWrapper
      badge="Pricing"
      description="Features unlock as you grow. No per-seat fees. No hidden costs."
      id="pricing"
      premium
      title="Simple, predictable pricing"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            className={`relative overflow-hidden rounded-2xl border-2 bg-background ${
              tier.highlighted
                ? "border-orange-500"
                : "border-border"
            }`}
            key={tier.name}
          >
            {/* Early Adopter Badge */}
            {tier.earlyAdopter && (
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 font-medium text-white text-xs">
                  Early Adopter
                </span>
              </div>
            )}

            {/* Coming Soon Badge */}
            {tier.comingSoon && (
              <div className="absolute top-4 left-4">
                <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-medium text-blue-600 text-xs dark:text-blue-400">
                  <Sparkles className="size-3" />
                  Coming Soon
                </span>
              </div>
            )}

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
                <span className="font-bold text-4xl">${tier.price}</span>
                {tier.regularPrice && (
                  <span className="text-lg text-muted-foreground line-through">
                    ${tier.regularPrice}
                  </span>
                )}
                <span className="text-muted-foreground">/mo</span>
              </div>
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
                  <li className="flex items-start gap-2 text-sm" key={feature}>
                    <Check className={`mt-0.5 size-4 shrink-0 ${
                      tier.highlighted ? "text-orange-500" : "text-green-500"
                    }`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {tier.ctaLink ? (
                <Button
                  asChild
                  className={`w-full ${tier.highlighted ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                  size="lg"
                  variant={tier.highlighted ? "default" : "outline"}
                >
                  <a href={tier.ctaLink}>
                    Get Started
                    <ArrowRight className="ml-2 size-4" />
                  </a>
                </Button>
              ) : (
                <Button
                  className="w-full cursor-not-allowed opacity-60"
                  disabled
                  size="lg"
                  variant="outline"
                >
                  Coming Soon
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Early Adopter note */}
      <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950">
        <p className="font-medium text-green-800 text-sm dark:text-green-200">
          Early Adopter Pricing - Lock in these rates before they increase.
        </p>
        <p className="mt-1 text-green-700 text-xs dark:text-green-300">
          Prices will rise to $19/mo and $49/mo when we add SMS features. Your
          rate stays locked forever.
        </p>
      </div>

      {/* Footer note */}
      <p className="mt-6 text-center text-muted-foreground text-sm">
        AWS costs billed separately by AWS. CLI and SDK are free forever.
      </p>
    </SectionWrapper>
  );
}
