"use client";

import { Check, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
      "All AWS SES features",
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
      "Email analytics and history",
      "Unlimited templates",
      "50 AI messages per month",
      "Unlimited team members",
      "Bulk sending (100/batch)",
      "Email support (48hr)",
    ],
  },
];

export function PricingSection() {
  return (
    <section className="bg-muted/40 py-24 sm:py-32" id="pricing">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Badge className="mb-4" variant="outline">
            Pricing
          </Badge>
          <h2 className="mb-4 font-bold text-3xl tracking-tight sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Use the CLI and SDK free forever. Add the hosted dashboard for
            $10/month.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto mb-16 grid max-w-5xl gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              className={`${plan.highlight ? "border-2 border-primary shadow-lg" : "border"}`}
              key={plan.name}
            >
              <CardContent className="p-8">
                <div className="mb-6">
                  <div className="mb-2 flex items-center gap-2">
                    {!plan.highlight && (
                      <Terminal className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-bold text-xl">{plan.name}</h3>
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
                  className="mb-8 w-full cursor-pointer"
                  size="lg"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  <a href={plan.ctaLink}>{plan.cta}</a>
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li className="flex items-start gap-3" key={feature}>
                      <Check
                        className={`mt-0.5 size-5 shrink-0 ${plan.highlight ? "text-primary" : "text-muted-foreground"}`}
                        strokeWidth={2.5}
                      />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Future Tiers */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="text-muted-foreground text-sm">
            Need more? <strong className="text-foreground">Pro ($49/mo)</strong>{" "}
            and <strong className="text-foreground">Growth ($99/mo)</strong>{" "}
            tiers coming soon with more AI messages, higher bulk limits, and
            multiple AWS accounts.
          </p>
        </div>

        {/* AWS Cost Note */}
        <div className="mx-auto max-w-2xl rounded-lg border bg-muted/50 p-6 text-center">
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
      </div>
    </section>
  );
}
