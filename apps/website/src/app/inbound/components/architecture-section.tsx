"use client";

import { ArrowRight, Cloud, Code2, HardDrive, Lock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const architectureNodes = [
  {
    id: "ses",
    label: "SES Receipt",
    sublabel: "MX Records",
    icon: Cloud,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  {
    id: "s3",
    label: "S3 Bucket",
    sublabel: "Raw Storage",
    icon: HardDrive,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  {
    id: "lambda",
    label: "Lambda",
    sublabel: "Parser",
    icon: Code2,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  {
    id: "eventbridge",
    label: "EventBridge",
    sublabel: "Webhooks",
    icon: Zap,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
];

export function ArchitectureSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <p className="text-lg text-muted-foreground">
            Your AWS account.{" "}
            <span className="text-foreground">Your infrastructure.</span>
          </p>
        </div>

        {/* Architecture diagram */}
        <div className="overflow-hidden rounded-2xl border-2 border-cyan-500/30 bg-background">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-cyan-500/5 px-6 py-4">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-cyan-500" />
              <span className="font-medium text-sm">Your AWS Account</span>
            </div>
            <span className="rounded bg-cyan-500/10 px-2 py-1 text-cyan-600 text-xs dark:text-cyan-400">
              Full Ownership
            </span>
          </div>

          {/* Diagram */}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              {architectureNodes.map((node, index) => {
                const Icon = node.icon;
                return (
                  <div className="flex items-center" key={node.id}>
                    {/* Node */}
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

                    {/* Arrow */}
                    {index < architectureNodes.length - 1 && (
                      <ArrowRight className="mx-1 size-5 shrink-0 text-cyan-500 sm:mx-2" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Description */}
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
                <p className="font-medium text-green-500 text-sm">S3 Stores</p>
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
              description: "Infrastructure stays in your AWS if you churn",
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
  );
}
