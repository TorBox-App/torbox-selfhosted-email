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
  AlertTriangle,
  ArrowRight,
  FileJson,
  Gauge,
  Server,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { DocsLayout } from "@/components/docs-layout";

const references = [
  {
    title: "API Reference",
    description:
      "REST API endpoints for the Wraps platform. Authentication, request/response formats, and available operations.",
    href: "/docs/reference/api",
    icon: Server,
  },
  {
    title: "Error Reference",
    description:
      "All CLI error codes and SDK error classes with explanations and solutions. Searchable by error code or message.",
    href: "/docs/reference/errors",
    icon: AlertTriangle,
  },
  {
    title: "Rate Limits",
    description:
      "API and AWS service rate limits. Includes per-endpoint limits, retry strategies, and how to request increases.",
    href: "/docs/reference/rate-limits",
    icon: Gauge,
  },
  {
    title: "JSON Output",
    description:
      "Machine-readable JSON output format for CLI commands. Useful for scripting, CI/CD pipelines, and automation.",
    href: "/docs/reference/json-output",
    icon: FileJson,
  },
  {
    title: "Environment Variables",
    description:
      "All environment variables for the CLI, SDKs, and CI/CD configuration. Includes defaults and override behavior.",
    href: "/docs/reference/environment-variables",
    icon: Settings,
  },
];

export default function ReferencePageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Reference
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Technical Reference
        </h1>
        <p className="text-lg text-muted-foreground">
          Detailed technical reference for the Wraps API, error codes, rate
          limits, output formats, and configuration.
        </p>
      </div>

      {/* Reference Cards */}
      <div className="grid gap-6">
        {references.map((ref) => {
          const Icon = ref.icon;
          return (
            <Card
              className="group transition-all hover:border-primary/50 hover:shadow-md"
              key={ref.title}
            >
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{ref.title}</CardTitle>
                  <p className="mt-2 text-muted-foreground">
                    {ref.description}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild variant="outline">
                  <Link href={ref.href}>
                    View Reference
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DocsLayout>
  );
}
