"use client";

import {
  BarChart3,
  Code2,
  FileText,
  Key,
  MessageSquareMore,
  ShieldCheck,
} from "lucide-react";
import {
  FeatureItem,
  SectionWrapper,
} from "@/app/landing/components/section-card";

const features = [
  {
    icon: Code2,
    title: "TypeScript SDK",
    description:
      "Simple, type-safe @wraps.dev/sms package. Send SMS with a single function call.",
    highlighted: true,
  },
  {
    icon: ShieldCheck,
    title: "Guided Registration",
    description:
      "Step-by-step wizard for toll-free and 10DLC registration. No more guessing.",
    highlighted: false,
  },
  {
    icon: Key,
    title: "Zero Stored Credentials",
    description:
      "OIDC authentication with your hosting provider. We never store your AWS credentials.",
    highlighted: false,
  },
  {
    icon: MessageSquareMore,
    title: "Two-Way Messaging",
    description:
      "Receive and reply to incoming messages. Build conversational SMS experiences.",
    highlighted: false,
  },
  {
    icon: FileText,
    title: "Message Templates",
    description:
      "Create reusable templates with variables. Perfect for OTP, notifications, and alerts.",
    highlighted: false,
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track delivery rates, failures, and costs. Real-time visibility into your SMS operations.",
    highlighted: false,
  },
];

export function SmsFeaturesSection() {
  return (
    <SectionWrapper
      badge="Features"
      description="Everything you need to send SMS at scale, without the complexity."
      id="features"
      title="Built for developers"
    >
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
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
