"use client";

import {
  CheckCircle,
  Globe,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import {
  FeatureItem,
  SectionWrapper,
} from "@/app/landing/components/section-card";

const features = [
  {
    icon: Zap,
    title: "One-Command Deploy",
    description:
      "Deploy SES, DynamoDB, Lambda, and EventBridge with a single command. Production-ready in under 2 minutes.",
    highlighted: true,
  },
  {
    icon: LayoutDashboard,
    title: "Local Console",
    description:
      "Built-in web dashboard for development. View email events, domain status, and analytics locally.",
    highlighted: true,
  },
  {
    icon: Globe,
    title: "Domain Management",
    description:
      "Add, verify, and manage sending domains. Automatic DKIM, SPF, and DMARC configuration guidance.",
    highlighted: true,
  },
  {
    icon: Shield,
    title: "Zero Stored Credentials",
    description:
      "OIDC authentication with Vercel, AWS, and more. We never store your AWS credentials.",
    highlighted: true,
  },
  {
    icon: CheckCircle,
    title: "Deliverability Checker",
    description:
      "Built-in email deliverability analysis. Check DNS records, blacklists, and TLS configuration.",
    highlighted: false,
  },
  {
    icon: Terminal,
    title: "Shell Completion",
    description:
      "Tab completion for bash, zsh, and fish. Fast navigation through commands and options.",
    highlighted: false,
  },
  {
    icon: Mail,
    title: "Email Infrastructure",
    description:
      "Full AWS SES setup with event tracking, bounce handling, and email archiving.",
    highlighted: false,
  },
  {
    icon: MessageSquare,
    title: "SMS Infrastructure",
    description:
      "AWS End User Messaging for toll-free SMS. Same one-command deploy experience.",
    highlighted: false,
  },
];

export function CliFeaturesSection() {
  return (
    <SectionWrapper
      badge="Features"
      description="Everything you need to manage email infrastructure from the command line."
      id="features"
      title="Powerful CLI tools"
    >
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <FeatureItem
            description={feature.description}
            highlighted={feature.highlighted}
            icon={feature.icon}
            key={feature.title}
            title={feature.title}
          />
        ))}
      </div>
    </SectionWrapper>
  );
}
