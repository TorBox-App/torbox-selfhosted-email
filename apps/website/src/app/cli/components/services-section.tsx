"use client";

import {
  HardDrive,
  Mail,
  MessageSquare,
  Sparkles,
  Terminal,
} from "lucide-react";
import { CopyButton } from "@/components/ui/shadcn-io/copy-button";

const services = [
  {
    id: "email",
    name: "Email",
    icon: Mail,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    description: "Production-ready transactional email via AWS SES",
    command: "wraps email init",
    features: [
      "SES configuration & domain verification",
      "DKIM, SPF, DMARC setup guidance",
      "EventBridge + SQS event pipeline",
      "DynamoDB for email history",
      "Lambda for event processing",
      "Bounce & complaint handling",
    ],
    status: "available",
  },
  {
    id: "cdn",
    name: "CDN",
    icon: HardDrive,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    description: "S3 + CloudFront CDN for global asset delivery",
    command: "wraps cdn init",
    features: [
      "S3 bucket with CORS configured",
      "CloudFront CDN distribution",
      "Custom domain & SSL certificate",
      "Browser-based image optimization",
      "Origin Access Control",
      "Pay AWS directly (~$5-7/mo)",
    ],
    status: "available",
  },
  {
    id: "sms",
    name: "SMS",
    icon: MessageSquare,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    description: "Toll-free SMS via AWS End User Messaging",
    command: "wraps sms init",
    features: [
      "End User Messaging configuration",
      "Toll-free number provisioning",
      "10DLC registration support",
      "SMS event tracking",
      "Opt-out handling (STOP/START)",
      "Delivery receipts via CloudWatch",
    ],
    status: "beta",
  },
];

export function CliServicesSection() {
  return (
    <section className="py-16 sm:py-24" id="services">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Inline header - just text, no badge/box */}
        <p className="mb-12 text-center text-lg text-muted-foreground">
          One command deploys production-ready AWS infrastructure.{" "}
          <span className="text-foreground">You own everything.</span>
        </p>

        {/* Service cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;

            return (
              <div
                className={`relative overflow-hidden rounded-2xl border-2 bg-background ${service.borderColor}`}
                key={service.id}
              >
                {/* Status Badge */}
                {service.status === "beta" && (
                  <div className="absolute top-4 right-4">
                    <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-medium text-blue-600 text-xs dark:text-blue-400">
                      <Sparkles className="size-3" />
                      Beta
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className={`border-b ${service.bgColor} px-6 py-6`}>
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-lg ${service.bgColor}`}
                    >
                      <Icon className={`size-5 ${service.color}`} />
                    </div>
                    <h3 className={`font-bold text-xl ${service.color}`}>
                      {service.name}
                    </h3>
                  </div>
                  <p className="mb-4 text-muted-foreground text-sm">
                    {service.description}
                  </p>
                  <div className="flex items-center justify-between overflow-hidden rounded-lg border border-green-500/20 bg-[#0a0a0a] px-3 py-2">
                    <code className="flex items-center gap-2 font-mono text-green-400 text-sm">
                      <Terminal className="size-3.5 text-green-600" />
                      {service.command}
                    </code>
                    <CopyButton
                      className="text-green-600 hover:text-green-400"
                      content={service.command}
                      size="sm"
                      variant="ghost"
                    />
                  </div>
                </div>

                {/* Features */}
                <div className="p-6">
                  <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    What gets deployed
                  </p>
                  <ul className="space-y-2">
                    {service.features.map((feature) => (
                      <li
                        className="flex items-start gap-2 text-sm"
                        key={feature}
                      >
                        <span
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${service.color.replace("text-", "bg-")}`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
