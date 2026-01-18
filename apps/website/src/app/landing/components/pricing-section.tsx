"use client";

import { Check, Sparkles, Terminal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BillingToggle } from "./billing-toggle";
import { SectionWrapper } from "./section-card";

type BillingInterval = "monthly" | "annual";

const plans = [
  {
    id: "cli",
    name: "CLI & SDK",
    price: 0,
    period: "forever",
    annualPrice: null,
    description: "Deploy and send emails with the command line",
    highlight: false,
    earlyAdopter: false,
    cta: "Get Started",
    ctaLink: "/docs/quickstart",
    features: [
      "One-command infrastructure deployment",
      "TypeScript SDK (@wraps.dev/email)",
      "Local console dashboard",
      "Email analytics & history",
      "Event tracking via EventBridge & DynamoDB",
      "Bounce & complaint handling",
      "Domain verification tools",
      "Community support on GitHub",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 10,
    period: "/mo",
    annualPrice: 100,
    description: "Templates + transactional email",
    highlight: false,
    earlyAdopter: false,
    cta: "Subscribe",
    ctaLink: "https://app.wraps.dev/auth?mode=signup&plan=starter",
    features: [
      "Unlimited contacts",
      "50,000 events/month",
      "5 active workflows",
      "30-day event history",
      "Unlimited templates",
      "50 AI generations/month",
      "1 AWS account",
      "Email support (48hr response)",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 49,
    period: "/mo",
    annualPrice: 490,
    description: "Add audience management & automation",
    highlight: true,
    popular: true,
    earlyAdopter: false,
    cta: "Subscribe",
    ctaLink: "https://app.wraps.dev/auth?mode=signup&plan=growth",
    features: [
      "Unlimited contacts",
      "250,000 events/month",
      "25 active workflows",
      "90-day event history",
      "Everything in Starter",
      "Topics & preference center",
      "Segments & targeting",
      "250 AI generations/month",
      "3 AWS accounts",
      "Priority support (24hr)",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    price: 149,
    period: "/mo",
    annualPrice: 1490,
    description: "High-volume + advanced automation",
    highlight: false,
    earlyAdopter: false,
    cta: "Subscribe",
    ctaLink: "https://app.wraps.dev/auth?mode=signup&plan=scale",
    features: [
      "Unlimited contacts",
      "1,000,000 events/month",
      "Unlimited workflows",
      "1-year event history",
      "Everything in Growth",
      "Advanced event segments",
      "1,000 AI generations/month",
      "Unlimited AWS accounts",
      "Dedicated support",
    ],
  },
];

export function PricingSection() {
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  const getDisplayPrice = (plan: (typeof plans)[0]) => {
    if (plan.annualPrice && billingInterval === "annual") {
      return Math.round(plan.annualPrice / 12);
    }
    return plan.price;
  };

  const getCtaLink = (plan: (typeof plans)[0]) => {
    if (!plan.ctaLink.startsWith("https://app.wraps.dev")) {
      return plan.ctaLink;
    }
    const annual = billingInterval === "annual" ? "&annual=true" : "";
    return `${plan.ctaLink}${annual}`;
  };

  return (
    <SectionWrapper
      badge="Pricing"
      description="Use the CLI and SDK free forever. Add the Wraps Platform starting at $10/month."
      id="pricing"
      title="Simple, Transparent Pricing"
    >
      {/* Billing Toggle */}
      <div className="mb-8 flex justify-center">
        <BillingToggle onChange={setBillingInterval} value={billingInterval} />
      </div>

      {/* Pricing Cards */}
      <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div
            className={`relative overflow-hidden rounded-2xl border bg-background ${plan.highlight ? "border-2 border-orange-500" : ""}`}
            key={plan.name}
          >
            {/* Early Adopter badge */}
            {plan.earlyAdopter && (
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 font-medium text-white text-xs">
                  Early Adopter
                </span>
              </div>
            )}

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
                  {plan.id === "cli" && (
                    <Terminal aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
              </div>

              <div className="mb-4">
                <span className="font-bold text-3xl">
                  ${getDisplayPrice(plan)}
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
                  <a href={getCtaLink(plan)}>{plan.cta}</a>
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

      {/* Founding Member Program */}
      <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xl">🚀</span>
          <p className="font-semibold text-orange-800 dark:text-orange-200">
            Founding Member Program — First 100 Customers
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 text-orange-700 text-sm dark:text-orange-300 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
            <span>Direct Slack access to the founder</span>
          </div>
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
            <span>Input on roadmap priorities</span>
          </div>
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
            <span>Your logo on our website</span>
          </div>
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
            <span>Locked-in pricing for life</span>
          </div>
        </div>
      </div>

      {/* Enterprise note */}
      <p className="mb-8 text-center text-muted-foreground text-sm">
        Need custom limits or on-prem deployment?{" "}
        <a
          className="text-primary hover:underline"
          href="mailto:support@wraps.dev"
        >
          Contact us for Enterprise
        </a>
      </p>

      {/* AWS Cost Note */}
      <div className="rounded-xl border bg-muted/30 p-6 text-center">
        <p className="mb-2 font-semibold text-foreground">
          AWS costs are separate
        </p>
        <p className="mb-4 text-muted-foreground text-sm">
          You pay AWS directly for email sending at{" "}
          <strong className="text-foreground">$0.10 per 1,000 emails</strong>{" "}
          plus infrastructure (~$2-5/mo). You own everything, zero vendor
          lock-in.
        </p>
        <Button asChild className="cursor-pointer" variant="outline">
          <a href="/calculator">Calculate Your Costs</a>
        </Button>
      </div>
    </SectionWrapper>
  );
}
