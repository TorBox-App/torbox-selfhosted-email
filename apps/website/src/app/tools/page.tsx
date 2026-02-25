import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ToolsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email Tools",
  description:
    "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  openGraph: {
    title: "Email Tools | Wraps",
    description:
      "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  },
  twitter: {
    title: "Email Tools | Wraps",
    description:
      "Free tools to check your email deliverability setup. DMARC analyzer, SPF validator, and more.",
  },
  alternates: {
    canonical: "https://wraps.dev/tools",
  },
};

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Wraps Email Deliverability Checker",
  description:
    "Free tools to check your email deliverability setup including DMARC analyzer, SPF validator, DKIM checker, and domain reputation tools.",
  url: "https://wraps.dev/tools",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  provider: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
  },
  featureList: [
    "DMARC policy analyzer",
    "SPF record validator",
    "DKIM signature checker",
    "Domain reputation check",
    "MX record verification",
  ],
};

export default function ToolsPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        suppressHydrationWarning
        type="application/ld+json"
      />
      <div className="min-h-screen bg-background">
        <LandingNavbar />

        {/* Main Content */}
        <main className="container mx-auto px-4 pt-24 pb-12">
          <div className="mx-auto max-w-4xl">
            {/* Page Header */}
            <div className="mb-12 text-center">
              <Badge className="mb-4" variant="outline">
                Free Tool
              </Badge>
              <h1 className="mb-4 font-bold text-2xl tracking-tight sm:text-4xl">
                Email Deliverability Checker
              </h1>
              <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
                Check your domain's email authentication setup. We analyze SPF,
                DKIM, DMARC, and MX records to help you improve deliverability.
              </p>
            </div>

            {/* Interactive Widget */}
            <Suspense>
              <ToolsPageContent />
            </Suspense>

            {/* Info Section */}
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">What is SPF?</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  Sender Policy Framework (SPF) specifies which mail servers are
                  authorized to send email on behalf of your domain.{" "}
                  <a
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                    href="/tools/spf-builder"
                  >
                    Build your SPF record →
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">What is DKIM?</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  DomainKeys Identified Mail (DKIM) adds a digital signature to
                  emails, allowing receivers to verify the message hasn't been
                  altered.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">What is DMARC?</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  Domain-based Message Authentication (DMARC) tells receivers
                  how to handle emails that fail SPF or DKIM checks.
                </CardContent>
              </Card>
            </div>

            {/* Cost Calculator CTA */}
            <Card className="mt-8 border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
                  <div className="flex-1">
                    <h3 className="mb-2 font-bold text-xl">
                      Calculate your AWS SES costs
                    </h3>
                    <p className="text-muted-foreground">
                      See exactly what you&apos;ll pay for email sending plus
                      the full infrastructure — EventBridge, Lambda, SQS, and
                      DynamoDB.
                    </p>
                  </div>
                  <Button asChild size="lg">
                    <Link href="/tools/ses-calculator">
                      Open Calculator
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Learn More */}
            <div className="mt-8 text-center">
              <p className="mb-4 text-muted-foreground">
                Want to learn more about email authentication?
              </p>
              <Button asChild variant="outline">
                <Link href="/blog/your-dmarc-policy-is-useless">
                  Read: Why DMARC Is Broken
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
