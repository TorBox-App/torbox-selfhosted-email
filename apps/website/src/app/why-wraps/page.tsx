import {
  ArrowRight,
  Calculator,
  Check,
  Code,
  Lock,
  Server,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyLinkButton } from "./components/copy-link-button";
import { FaqSection } from "./components/faq-section";

export const metadata: Metadata = {
  title: "Why Wraps - AWS SES Pricing with Modern Developer Experience",
  description:
    "Own your infrastructure, pay AWS prices, keep the great DX. No vendor lock-in, full data control.",
  openGraph: {
    title: "Why Wraps | Wraps",
    description:
      "Own your infrastructure, pay AWS prices, keep the great DX. No vendor lock-in, full data control.",
  },
  twitter: {
    title: "Why Wraps | Wraps",
    description:
      "Own your infrastructure, pay AWS prices, keep the great DX. No vendor lock-in, full data control.",
  },
  alternates: {
    canonical: "https://wraps.dev/why-wraps",
  },
};

const costComparison = [
  { volume: "1K/mo", saas: "$20-40", aws: "~$0.10", total: "Free" },
  { volume: "10K/mo", saas: "$40-80", aws: "~$1", total: "~$30" },
  { volume: "50K/mo", saas: "$150-300", aws: "~$5", total: "~$104" },
  { volume: "250K/mo", saas: "$400-800", aws: "~$25", total: "~$274" },
  { volume: "500K/mo", saas: "$700-1,200", aws: "~$50", total: "~$549" },
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

export default function WhyWrapsPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
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
            <CopyLinkButton />
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
                        <th className="p-4 text-left font-medium">AWS Only</th>
                        <th className="p-4 text-left font-medium text-primary">
                          Wraps Total
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
                          <td className="p-4 text-muted-foreground">
                            {row.aws}
                          </td>
                          <td className="p-4 font-medium text-primary">
                            {row.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <p className="mt-4 text-muted-foreground text-sm">
              AWS costs: SES at $0.10/1K emails. Wraps Total includes platform
              fee ($0-249/mo) plus message overages ($1-2/1K).{" "}
              <a className="text-primary underline" href="/platform#pricing">
                See pricing tiers
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
                    Free local console for development. Wraps Platform is
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
          <FaqSection />

          {/* CTA */}
          <section className="rounded-lg border bg-muted/30 p-8 text-center">
            <h2 className="mb-2 font-semibold text-xl">Ready to try it?</h2>
            <p className="mb-6 text-muted-foreground">
              Deploy in 2 minutes. No credit card required.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/docs/quickstart">
                  Get Started
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/tools/ses-calculator">Calculate Your Costs</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
