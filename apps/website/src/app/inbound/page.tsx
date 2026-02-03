import {
  ArrowRight,
  BookOpen,
  Cloud,
  Code2,
  HardDrive,
  Inbox,
  Lock,
  Mail,
  Terminal,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnatomyInteractive } from "./components/anatomy-interactive";
import { AnimatedInbox } from "./components/animated-inbox";
import { PipelineInteractive } from "./components/pipeline-interactive";
import { SdkTabs } from "./components/sdk-tabs";
import { UseCasesCarousel } from "./components/use-cases-carousel";
import {
  architectureNodesData,
  codeExamples,
  type IconName,
  pipelineSteps,
  useCases,
} from "./data";

// Icon map for server-side rendering of architecture section
const iconMap: Record<IconName, typeof Mail> = {
  Mail,
  Cloud,
  HardDrive,
  Code2,
  Zap,
  Database: Mail,
  Headphones: Mail,
  Package: Mail,
  FileText: Mail,
  Users: Mail,
  MessageSquare: Mail,
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Wraps Inbound Email",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "AWS",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Receive and process inbound emails in your AWS account. Parse headers, extract attachments, detect spam, and trigger webhooks with EventBridge.",
  url: "https://wraps.dev/inbound",
  author: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
  },
  programmingLanguage: "TypeScript",
};

export const metadata: Metadata = {
  title: "Inbound Email - Receive Emails in Your AWS | Wraps",
  description:
    "Receive and process emails in your AWS account. Parse headers, extract attachments, detect spam, and trigger webhooks with EventBridge.",
  openGraph: {
    title: "Inbound Email | Wraps",
    description:
      "Receive emails in your AWS with EventBridge webhooks. Full parsing, attachments, and threading support.",
    images: [
      {
        url: "/blog/wraps-inbound-og.png",
        width: 1200,
        height: 630,
        alt: "Wraps Inbound Email - Receive and process emails in your AWS",
      },
    ],
  },
  twitter: {
    title: "Inbound Email | Wraps",
    description:
      "Receive emails in your AWS with EventBridge webhooks. Full parsing, attachments, and threading support.",
    images: ["/blog/wraps-inbound-og.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/inbound",
  },
};

export default function InboundPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        id="software-schema"
        type="application/ld+json"
      />

      <div className="min-h-screen bg-background">
        <LandingNavbar />

        <main>
          {/* Hero Section */}
          <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-28">
            <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                {/* Left column - Text content */}
                <div>
                  <div className="mb-6">
                    <Badge
                      className="border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-cyan-600 dark:text-cyan-400"
                      variant="outline"
                    >
                      <Inbox className="mr-2 size-4" />
                      Inbound Email
                    </Badge>
                  </div>

                  <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-5xl">
                    <span className="text-cyan-500">Every inbox.</span>
                    <br />
                    Your infrastructure.
                  </h1>

                  <p className="mb-8 max-w-lg text-pretty text-lg text-muted-foreground">
                    Receive, parse, and process emails in your AWS account.
                    Build support inboxes, automate order processing, or create
                    email-to-ticket workflows.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      "SES + S3 + Lambda + EventBridge",
                      "Parse headers & attachments",
                      "Spam & virus detection",
                      "Reply with threading",
                    ].map((feature) => (
                      <div className="flex items-center gap-2" key={feature}>
                        <div className="size-1.5 rounded-full bg-cyan-500" />
                        <span className="text-muted-foreground text-sm">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right column - Animated Inbox (client component) */}
                <div className="group relative">
                  <div className="absolute -inset-4 rounded-3xl bg-cyan-500/10 opacity-50 blur-2xl transition-opacity group-hover:opacity-70" />
                  <AnimatedInbox />
                </div>
              </div>
            </div>
          </section>

          {/* Pipeline Section */}
          <section className="py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 text-center">
                <h2 className="mb-2 font-bold text-2xl">The Email Pipeline</h2>
                <p className="text-lg text-muted-foreground">
                  Follow the journey.{" "}
                  <span className="text-foreground">
                    From inbox to your application.
                  </span>
                </p>
              </div>

              {/* Pipeline steps - server rendered list for SEO */}
              <div className="sr-only">
                <ol>
                  {pipelineSteps.map((step) => (
                    <li key={step.id}>
                      <strong>{step.label}</strong>: {step.description}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Interactive pipeline (client component) */}
              <PipelineInteractive steps={pipelineSteps} />
            </div>
          </section>

          {/* Anatomy Section */}
          <section className="bg-muted/30 py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 text-center">
                <h2 className="mb-2 font-bold text-2xl">
                  Parsed Email Structure
                </h2>
                <p className="text-lg text-muted-foreground">
                  Every field parsed.{" "}
                  <span className="text-foreground">
                    Hover to explore the structure.
                  </span>
                </p>
              </div>

              {/* Email structure description for SEO */}
              <div className="sr-only">
                <h3>Parsed Email Fields</h3>
                <ul>
                  <li>
                    <strong>emailId</strong>: Unique identifier for the inbound
                    email
                  </li>
                  <li>
                    <strong>from</strong>: Sender address and name
                  </li>
                  <li>
                    <strong>to</strong>: Recipient addresses
                  </li>
                  <li>
                    <strong>subject</strong>: Email subject line
                  </li>
                  <li>
                    <strong>html</strong>: HTML body content
                  </li>
                  <li>
                    <strong>text</strong>: Plain text body content
                  </li>
                  <li>
                    <strong>attachments</strong>: File attachments with
                    filename, content type, and size
                  </li>
                  <li>
                    <strong>spamVerdict</strong>: AWS SES spam detection result
                  </li>
                  <li>
                    <strong>virusVerdict</strong>: AWS SES virus scan result
                  </li>
                </ul>
              </div>

              {/* Interactive anatomy (client component) */}
              <AnatomyInteractive />
            </div>
          </section>

          {/* Use Cases Section */}
          <section className="py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8 text-center">
                <h2 className="mb-2 font-bold text-2xl">What Can You Build?</h2>
                <p className="text-lg text-muted-foreground">
                  Endless possibilities.{" "}
                  <span className="text-foreground">
                    Build any email-driven workflow.
                  </span>
                </p>
              </div>

              {/* Use cases for SEO */}
              <div className="sr-only">
                {useCases.map((useCase) => (
                  <article key={useCase.id}>
                    <h3>{useCase.title}</h3>
                    <p>{useCase.description}</p>
                    <pre>
                      <code>{useCase.code}</code>
                    </pre>
                  </article>
                ))}
              </div>

              {/* Interactive carousel (client component) */}
              <UseCasesCarousel useCases={useCases} />
            </div>
          </section>

          {/* SDK Section */}
          <section className="bg-muted/30 py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8 text-center">
                <h2 className="mb-2 font-bold text-2xl">TypeScript SDK</h2>
                <p className="text-lg text-muted-foreground">
                  Simple SDK.{" "}
                  <span className="text-foreground">
                    Full control over your inbox.
                  </span>
                </p>
              </div>

              {/* SDK examples for SEO */}
              <div className="sr-only">
                <h3>SDK Code Examples</h3>
                {Object.entries(codeExamples).map(([key, example]) => (
                  <article key={key}>
                    <h4>{example.label}</h4>
                    <pre>
                      <code>{example.code}</code>
                    </pre>
                  </article>
                ))}
              </div>

              {/* Interactive SDK tabs (client component) */}
              <SdkTabs examples={codeExamples} />
            </div>
          </section>

          {/* Architecture Section - fully server rendered */}
          <section className="py-16 sm:py-24">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 text-center">
                <h2 className="mb-2 font-bold text-2xl">Your Infrastructure</h2>
                <p className="text-lg text-muted-foreground">
                  Your AWS account.{" "}
                  <span className="text-foreground">Your infrastructure.</span>
                </p>
              </div>

              {/* Architecture diagram */}
              <div className="overflow-hidden rounded-2xl border-2 border-cyan-500/30 bg-background">
                <div className="flex items-center justify-between border-b bg-cyan-500/5 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-cyan-500" />
                    <span className="font-medium text-sm">
                      Your AWS Account
                    </span>
                  </div>
                  <span className="rounded bg-cyan-500/10 px-2 py-1 text-cyan-600 text-xs dark:text-cyan-400">
                    Full Ownership
                  </span>
                </div>

                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                    {architectureNodesData.map((node, index) => {
                      const Icon = iconMap[node.iconName];
                      return (
                        <div className="flex items-center" key={node.id}>
                          <div
                            className={cn(
                              "flex flex-col items-center rounded-xl border-2 p-4 transition-all hover:shadow-lg",
                              node.bgColor,
                              node.borderColor
                            )}
                          >
                            <div
                              className={cn(
                                "mb-2 flex size-12 items-center justify-center rounded-lg",
                                node.bgColor
                              )}
                            >
                              <Icon className={cn("size-6", node.color)} />
                            </div>
                            <span className="font-semibold text-sm">
                              {node.label}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {node.sublabel}
                            </span>
                          </div>

                          {index < architectureNodesData.length - 1 && (
                            <ArrowRight className="mx-1 size-5 shrink-0 text-cyan-500 sm:mx-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 grid gap-4 text-center sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="font-medium text-orange-500 text-sm">
                        SES Receives
                      </p>
                      <p className="text-muted-foreground text-xs">
                        MX records route to SES
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-green-500 text-sm">
                        S3 Stores
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Raw email saved securely
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-yellow-500 text-sm">
                        Lambda Parses
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Headers, body, attachments
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-purple-500 text-sm">
                        EventBridge Triggers
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Your webhooks & rules
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key benefits */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    title: "No Vendor Lock-in",
                    description:
                      "Infrastructure stays in your AWS if you churn",
                  },
                  {
                    title: "Data Residency",
                    description: "Emails never leave your AWS account",
                  },
                  {
                    title: "AWS Pricing",
                    description: "Pay AWS directly, no markup",
                  },
                ].map((benefit) => (
                  <div
                    className="rounded-lg border bg-muted/30 p-4 text-center"
                    key={benefit.title}
                  >
                    <p className="font-medium text-sm">{benefit.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section - mostly server rendered */}
          <section className="bg-muted/30 py-16 sm:py-24">
            <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
              <div className="mb-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
                  <Inbox className="size-4 text-cyan-500" />
                  <span className="font-medium text-cyan-600 text-sm dark:text-cyan-400">
                    Ready to receive?
                  </span>
                </div>
                <h2 className="mb-4 font-bold text-3xl sm:text-4xl">
                  Start receiving emails in minutes
                </h2>
                <p className="mx-auto max-w-xl text-muted-foreground">
                  One command deploys inbound email infrastructure to your AWS
                  account. Configure MX records and start processing emails.
                </p>
              </div>

              {/* Install command */}
              <div className="mx-auto mb-8 max-w-md">
                <div className="overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a0a0a] shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                  <div className="flex items-center gap-3 border-b border-cyan-500/20 bg-[#0a0a0a] px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="size-2.5 rounded-full bg-red-500/80" />
                      <div className="size-2.5 rounded-full bg-yellow-500/80" />
                      <div className="size-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="font-mono text-cyan-400/70 text-sm">
                      CLI
                    </span>
                  </div>
                  <div className="p-4 text-left font-mono text-cyan-400">
                    <span className="inline-flex items-center gap-2">
                      <Terminal className="size-4 text-cyan-600" />
                      npx @wraps.dev/cli email inbound init
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  asChild
                  className="gap-2 bg-cyan-500 hover:bg-cyan-600"
                  size="lg"
                >
                  <Link href="/docs/quickstart/email/inbound">
                    Get Started
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild className="gap-2" size="lg" variant="outline">
                  <Link href="/docs/cli-reference/email">
                    <BookOpen className="size-4" />
                    View Documentation
                  </Link>
                </Button>
              </div>

              {/* Trust badges */}
              <div className="mt-12 flex flex-wrap justify-center gap-6 text-muted-foreground text-sm">
                <span>No credit card required</span>
                <span className="hidden sm:inline">•</span>
                <span>AWS pricing only</span>
                <span className="hidden sm:inline">•</span>
                <span>Full ownership</span>
              </div>
            </div>
          </section>
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
