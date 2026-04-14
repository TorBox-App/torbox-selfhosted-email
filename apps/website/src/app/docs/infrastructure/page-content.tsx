"use client";

import { Badge } from "@wraps/ui/components/ui/badge";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import {
  ArrowRight,
  Box,
  HardDrive,
  Layers,
  Mail,
  MessageSquare,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { DocsLayout } from "@/components/docs-layout";

const services = [
  {
    title: "Email",
    description:
      "SES configuration sets, DynamoDB tables, Lambda processors, EventBridge rules, SQS queues, and IAM roles. Three presets: Starter, Production, and Enterprise.",
    href: "/docs/infrastructure/email",
    icon: Mail,
  },
  {
    title: "SMS",
    description:
      "AWS End User Messaging, phone number provisioning, opt-out management, event processing pipeline, and IAM roles.",
    href: "/docs/infrastructure/sms",
    icon: MessageSquare,
  },
  {
    title: "CDN",
    description:
      "S3 bucket, CloudFront distribution, Origin Access Identity, optional ACM certificate, and custom domain configuration.",
    href: "/docs/infrastructure/cdn",
    icon: HardDrive,
  },
  {
    title: "EventBridge Events",
    description:
      "Full event type reference for email delivery events. Payloads, bounce/complaint subtypes, and how to create custom rules.",
    href: "/docs/infrastructure/events",
    icon: Zap,
  },
];

export default function InfrastructurePageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Infrastructure
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          What Gets Deployed
        </h1>
        <p className="text-lg text-muted-foreground">
          Wraps deploys infrastructure directly to your AWS account. You own
          every resource, see every cost, and can inspect everything in the AWS
          Console. Each page below details exactly what gets created.
        </p>
      </div>

      {/* Service Cards */}
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Card
              className="group transition-all hover:border-primary/50 hover:shadow-md"
              key={service.title}
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{service.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{service.description}</p>
                <Button asChild variant="outline">
                  <Link href={service.href}>
                    View Resources
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Infrastructure as Code */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Infrastructure as Code</h2>
        <p className="mb-6 text-muted-foreground">
          Prefer to manage infrastructure with your existing IaC toolchain?
          Wraps provides first-class CDK and Pulumi packages as alternatives to
          the CLI.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">CDK Construct</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Deploy Wraps infrastructure with AWS CDK using the{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  @wraps.dev/cdk
                </code>{" "}
                package.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/cdk-reference">
                  CDK Reference
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Pulumi Component</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Deploy Wraps infrastructure with Pulumi using the{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  @wraps.dev/pulumi
                </code>{" "}
                package.
              </p>
              <Button asChild variant="outline">
                <Link href="/docs/pulumi-reference">
                  Pulumi Reference
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </DocsLayout>
  );
}
