"use client";

import { ArrowRight, Globe, ShieldCheck } from "lucide-react";
import { DocsLayout } from "@/components/docs-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const guides = [
  {
    title: "Production Access",
    description:
      "Move out of the AWS SES sandbox to send emails to any recipient. Learn what's required and how to get approved quickly.",
    href: "/docs/guides/production-access",
    icon: ShieldCheck,
    readTime: "2 min read",
  },
  {
    title: "Domain Verification",
    description:
      "Set up DKIM, SPF, and DMARC for your domain. Improve deliverability and protect your sender reputation.",
    href: "/docs/guides/domain-verification",
    icon: Globe,
    readTime: "4 min read",
  },
];

export default function GuidesPage() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Guides
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Getting Production-Ready
        </h1>
        <p className="text-lg text-muted-foreground">
          Step-by-step guides to help you move from development to production
          with confidence.
        </p>
      </div>

      {/* Guide Cards */}
      <div className="grid gap-6">
        {guides.map((guide) => {
          const Icon = guide.icon;
          return (
            <Card
              key={guide.title}
              className="group transition-all hover:border-primary/50 hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{guide.title}</CardTitle>
                    <span className="text-muted-foreground text-sm">
                      {guide.readTime}
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {guide.description}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild variant="outline">
                  <a href={guide.href}>
                    Read Guide
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Coming Soon */}
      <div className="mt-12 rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          More guides coming soon: IP warming, bounce handling, and compliance
          best practices.
        </p>
      </div>
    </DocsLayout>
  );
}
