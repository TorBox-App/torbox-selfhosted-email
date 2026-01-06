"use client";

import { Check, Copy, Globe, Mail, MessageSquare, Sparkles, Terminal } from "lucide-react";
import { useState } from "react";
import { SectionWrapper } from "@/app/landing/components/section-card";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className="p-1 text-green-600 transition-colors hover:text-green-400"
      onClick={handleCopy}
      type="button"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

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
    status: "available",
  },
  {
    id: "cdn",
    name: "CDN",
    icon: Globe,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    description: "Global asset delivery via CloudFront",
    command: "wraps cdn init",
    features: [
      "CloudFront distribution setup",
      "S3 origin bucket configuration",
      "Custom domain & SSL certificate",
      "Cache invalidation tools",
      "Image optimization",
      "Edge function support",
    ],
    status: "coming-soon",
  },
];

export function CliServicesSection() {
  return (
    <SectionWrapper
      badge="Infrastructure"
      description="One command deploys production-ready AWS infrastructure. You own everything."
      id="services"
      title="Deploy & configure"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {services.map((service) => {
          const Icon = service.icon;
          const isComingSoon = service.status === "coming-soon";

          return (
            <div
              className={`relative overflow-hidden rounded-2xl border-2 bg-background ${service.borderColor} ${isComingSoon ? "opacity-75" : ""}`}
              key={service.id}
            >
              {/* Coming Soon Badge */}
              {isComingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 font-medium text-orange-600 text-xs dark:text-orange-400">
                    <Sparkles className="size-3" />
                    Coming Soon
                  </span>
                </div>
              )}

              {/* Header */}
              <div className={`border-b ${service.bgColor} px-6 py-6`}>
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex size-10 items-center justify-center rounded-lg ${service.bgColor}`}>
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
                  <CopyButton value={service.command} />
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
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${service.color.replace("text-", "bg-")}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
