"use client";

import {
  ArrowRight,
  Calculator,
  Check,
  Code,
  Copy,
  Lock,
  Server,
} from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const costComparison = [
  { volume: "10K/mo", saas: "$40-80", wraps: "~$3" },
  { volume: "50K/mo", saas: "$100-200", wraps: "~$8" },
  { volume: "100K/mo", saas: "$200-400", wraps: "~$15" },
  { volume: "500K/mo", saas: "$500-1,000", wraps: "~$55" },
  { volume: "1M/mo", saas: "$1,000+", wraps: "~$105" },
];

const securityPoints = [
  "Zero stored credentials - we use OIDC and IAM roles",
  "Infrastructure runs in your AWS account",
  "Your data stays in your account (data residency)",
  "Open source - audit the code yourself",
  "Inherits your AWS compliance (SOC2, HIPAA, etc.)",
];

const lockInPoints = [
  "All infrastructure is deployed to your AWS account",
  "If you stop using Wraps, everything keeps running",
  "Standard AWS services underneath (SES, DynamoDB, Lambda)",
  "Export data anytime - it's in your DynamoDB",
  "CLI and SDK are open source (AGPLv3)",
];

const faqItems = [
  {
    id: "cost",
    question: "What's the total cost of ownership?",
    answer:
      "AWS costs: $0.10/1K emails + ~$2-5/mo infrastructure (DynamoDB, Lambda, etc.). The CLI and SDK are free forever. Optional hosted dashboard starts at $10/mo. No hidden fees, no per-seat pricing.",
  },
  {
    id: "support",
    question: "What support is available?",
    answer:
      "Free tier: GitHub issues and community Discord. Paid dashboard: 48-hour email support. Enterprise: Dedicated support and SLAs available on request.",
  },
  {
    id: "compare",
    question: "How does this compare to building our own SES integration?",
    answer:
      "Building SES integration with proper event tracking, bounce handling, and analytics takes 40-80 engineering hours. Wraps does it in 2 minutes. You get the same infrastructure, just automated.",
  },
  {
    id: "migration",
    question: "What's the migration path from our current provider?",
    answer:
      "Deploy Wraps alongside your current provider, migrate traffic gradually, then decommission the old one. Your sending domain stays the same. Most teams migrate in a day.",
  },
  {
    id: "customize",
    question: "Can we customize the infrastructure?",
    answer:
      "Yes. The CLI offers presets (Starter, Production, Enterprise) or full customization. All infrastructure is Pulumi code you can fork and modify. Add your own Lambda triggers, change retention periods, etc.",
  },
];

export default function WhyWrapsPage() {
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText("https://wraps.dev/why-wraps");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <a className="flex items-center gap-2 font-bold text-xl" href="/">
            Wraps
          </a>
          <Button asChild variant="outline">
            <a href="/">Back to Home</a>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Page Header */}
          <div className="mb-12">
            <h1 className="mb-4 font-bold text-4xl tracking-tight">
              Why Wraps
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Everything you need to evaluate Wraps for your team. Share this
              page with your manager or teammates.
            </p>
            <Button
              className="mt-4"
              onClick={copyUrl}
              size="sm"
              variant="outline"
            >
              <Copy className="mr-2 size-4" />
              {copied ? "Copied!" : "Copy link to share"}
            </Button>
          </div>

          {/* Cost Comparison */}
          <section className="mb-16">
            <div className="mb-6 flex items-center gap-3">
              <Calculator className="size-6 text-primary" />
              <h2 className="font-semibold text-2xl">Cost Comparison</h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-4 text-left font-medium">
                          Monthly Volume
                        </th>
                        <th className="p-4 text-left font-medium">
                          Email SaaS
                        </th>
                        <th className="p-4 text-left font-medium text-primary">
                          Wraps (AWS)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {costComparison.map((row) => (
                        <tr key={row.volume}>
                          <td className="p-4 text-muted-foreground">
                            {row.volume}
                          </td>
                          <td className="p-4">{row.saas}</td>
                          <td className="p-4 font-medium text-primary">
                            {row.wraps}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <p className="mt-4 text-muted-foreground text-sm">
              Wraps costs include AWS SES ($0.10/1K) + infrastructure (~$2-5/mo
              for DynamoDB, Lambda, EventBridge).{" "}
              <a className="text-primary underline" href="/calculator">
                Calculate your exact costs
              </a>
            </p>
          </section>

          {/* Security & Compliance */}
          <section className="mb-16">
            <div className="mb-6 flex items-center gap-3">
              <Lock className="size-6 text-primary" />
              <h2 className="font-semibold text-2xl">Security & Compliance</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {securityPoints.map((point) => (
                    <li className="flex items-start gap-3" key={point}>
                      <Check className="mt-0.5 size-5 shrink-0 text-green-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* No Vendor Lock-in */}
          <section className="mb-16">
            <div className="mb-6 flex items-center gap-3">
              <Server className="size-6 text-primary" />
              <h2 className="font-semibold text-2xl">No Vendor Lock-in</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {lockInPoints.map((point) => (
                    <li className="flex items-start gap-3" key={point}>
                      <Check className="mt-0.5 size-5 shrink-0 text-green-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* Developer Experience */}
          <section className="mb-16">
            <div className="mb-6 flex items-center gap-3">
              <Code className="size-6 text-primary" />
              <h2 className="font-semibold text-2xl">Developer Experience</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">TypeScript SDK</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Full type safety, intuitive API, great autocomplete.{" "}
                    <code className="rounded bg-muted px-1">
                      wraps.emails.send()
                    </code>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">One-Command Setup</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    <code className="rounded bg-muted px-1">
                      npx @wraps.dev/cli email init
                    </code>{" "}
                    deploys everything.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Local Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Free local console for development. Hosted dashboard
                    optional.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Event Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Sends, deliveries, opens, clicks, bounces - all tracked in
                    DynamoDB.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* FAQ for Decision Makers */}
          <section className="mb-16">
            <h2 className="mb-6 font-semibold text-2xl">Common Questions</h2>
            <Accordion className="space-y-2" collapsible type="single">
              {faqItems.map((item) => (
                <AccordionItem
                  className="rounded-lg border px-4"
                  key={item.id}
                  value={item.id}
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* CTA */}
          <section className="rounded-lg border bg-muted/30 p-8 text-center">
            <h2 className="mb-2 font-semibold text-xl">Ready to try it?</h2>
            <p className="mb-6 text-muted-foreground">
              Deploy in 2 minutes. No credit card required.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <a href="/docs/quickstart">
                  Get Started
                  <ArrowRight className="ml-2 size-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/calculator">Calculate Your Costs</a>
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
