"use client";

import {
  ArrowRight,
  Blocks,
  HardDrive,
  Mail,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { DocsLayout } from "@/components/docs-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const cliGuides = [
  {
    title: "Email",
    description:
      "Deploy production-ready email infrastructure using AWS SES. Send transactional emails, track delivery, and manage bounces.",
    href: "/docs/quickstart/email",
    icon: Mail,
    features: [
      "AWS SES setup",
      "Domain verification",
      "TypeScript SDK",
      "Analytics dashboard",
    ],
  },
  {
    title: "CDN",
    description:
      "Deploy S3 + CloudFront CDN for global file delivery with browser-based image optimization.",
    href: "/docs/quickstart/cdn",
    icon: HardDrive,
    features: [
      "S3 bucket + CDN",
      "Custom domain",
      "Image optimization",
      "AWS pricing",
    ],
  },
  {
    title: "SMS",
    description:
      "Send SMS messages through AWS End User Messaging. Perfect for OTP codes, notifications, and alerts.",
    href: "/docs/quickstart/sms",
    icon: MessageSquare,
    features: [
      "Toll-free number",
      "Batch sending",
      "Opt-out management",
      "Delivery tracking",
    ],
  },
];

const platformGuide = {
  title: "Platform",
  description:
    "Use the type-safe Platform SDK to manage contacts, segments, and send batch emails programmatically.",
  href: "/docs/quickstart/platform",
  icon: Blocks,
  features: [
    "Contact management",
    "Batch email sends",
    "Type-safe API client",
    "Full TypeScript support",
  ],
};

export default function QuickstartPage() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Quickstart Guides
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Get Started with Wraps
        </h1>
        <p className="text-lg text-muted-foreground">
          Choose a service to get started. Each quickstart guide will walk you
          through deploying infrastructure to your AWS account and sending your
          first message.
        </p>
      </div>

      {/* CLI Quickstart Cards - Email, Storage & SMS */}
      <div className="mb-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cliGuides.map((guide) => {
          const Icon = guide.icon;
          return (
            <Card
              className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg"
              key={guide.title}
            >
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">{guide.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{guide.description}</p>
                <ul className="grid grid-cols-2 gap-2 text-muted-foreground text-sm">
                  {guide.features.map((feature) => (
                    <li className="flex items-center gap-2" key={feature}>
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full">
                  <a href={guide.href}>
                    Get Started with {guide.title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Platform Card */}
      <Card className="group relative overflow-hidden transition-all hover:border-orange-500/50 hover:shadow-lg">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
            <Blocks className="h-6 w-6 text-orange-500" />
          </div>
          <CardTitle className="text-2xl">{platformGuide.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{platformGuide.description}</p>
          <ul className="grid grid-cols-2 gap-2 text-muted-foreground text-sm md:grid-cols-4">
            {platformGuide.features.map((feature) => (
              <li className="flex items-center gap-2" key={feature}>
                <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {feature}
              </li>
            ))}
          </ul>
          <Button
            asChild
            className="w-full bg-orange-500 text-white hover:bg-orange-600 md:w-auto"
          >
            <a
              href="https://app.wraps.dev/auth?mode=signup&plan=starter"
              rel="noopener noreferrer"
              target="_blank"
            >
              Subscribe to Platform
              <Sparkles className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="mt-12 bg-muted/50">
        <CardContent className="p-8 text-center">
          <h3 className="mb-2 font-bold text-xl">Not sure where to start?</h3>
          <p className="mb-4 text-muted-foreground">
            Most developers start with Email. It's the most common use case and
            takes about 2 minutes to set up.
          </p>
          <Button asChild variant="outline">
            <a href="/docs/quickstart/email">
              Start with Email
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </DocsLayout>
  );
}
