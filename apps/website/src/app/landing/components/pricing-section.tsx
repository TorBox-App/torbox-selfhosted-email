"use client";

import { Check, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "./section-card";

const plans = [
  {
    name: "CLI & SDK",
    price: "$0",
    period: "forever",
    description: "Deploy and send emails with the command line",
    highlight: false,
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
    name: "Starter",
    price: "$10",
    period: "/month",
    description: "Full hosted dashboard access",
    highlight: true,
    cta: "Subscribe",
    ctaLink: "https://app.wraps.dev/auth?mode=signup&plan=starter",
    features: [
      "Everything in CLI & SDK",
      "Hosted dashboard at wraps.dev",
      "Unlimited templates",
      "50 AI generations/month",
      "Unlimited team members",
      "Email support (48hr response)",
    ],
  },
];

export function PricingSection() {
  return (
    <SectionWrapper
      badge="Pricing"
      description="Use the CLI and SDK free forever. Add the hosted dashboard for $10/month."
      id="pricing"
      title="Simple, Transparent Pricing"
    >
      {/* Pricing Cards */}
      <div className="mb-12 grid gap-8 md:grid-cols-2">
        {plans.map((plan) => (
          <div
            className={`overflow-hidden rounded-2xl border bg-background ${plan.highlight ? "border-2 border-orange-500" : ""}`}
            key={plan.name}
          >
            <div className="p-8">
              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  {!plan.highlight && (
                    <Terminal className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h3 className="font-bold text-xl">{plan.name}</h3>
                  {plan.highlight && (
                    <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-500 text-xs">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="font-bold text-4xl">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <Button
                asChild
                className={`mb-8 w-full cursor-pointer ${plan.highlight ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                size="lg"
                variant={plan.highlight ? "default" : "outline"}
              >
                <a href={plan.ctaLink}>{plan.cta}</a>
              </Button>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li className="flex items-start gap-3" key={feature}>
                    <Check
                      className={`mt-0.5 size-5 shrink-0 ${plan.highlight ? "text-orange-500" : "text-muted-foreground"}`}
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

      {/* Future Tiers */}
      <p className="mb-8 text-center text-muted-foreground text-sm">
        Need more? <strong className="text-foreground">Pro ($49/mo)</strong> and{" "}
        <strong className="text-foreground">Growth ($99/mo)</strong> tiers
        coming soon with more AI messages and multiple AWS accounts.
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
