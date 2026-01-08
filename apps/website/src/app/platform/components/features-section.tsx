"use client";

import { BarChart3, Globe, History, Shield, Users, Zap } from "lucide-react";
import {
  FeatureItem,
  SectionWrapper,
} from "@/app/landing/components/section-card";

const features = [
  {
    icon: BarChart3,
    title: "Email Analytics",
    description:
      "Track sends, deliveries, opens, clicks, bounces, and complaints. Real-time visibility into your email performance.",
    highlighted: true,
  },
  {
    icon: Users,
    title: "Contact Management",
    description:
      "Import contacts, create segments, and manage topics. Track subscriptions and preferences across your audience.",
    highlighted: true,
  },
  {
    icon: Zap,
    title: "Real-time Events",
    description:
      "See email events as they happen. Webhooks for bounces, complaints, and delivery notifications.",
    highlighted: true,
  },
  {
    icon: History,
    title: "Message History",
    description:
      "Search and filter through your email history. View full event timelines for every message sent.",
    highlighted: false,
  },
  {
    icon: Globe,
    title: "Domain Management",
    description:
      "Add and verify sending domains. Monitor DKIM, SPF, and DMARC status from one dashboard.",
    highlighted: false,
  },
  {
    icon: Shield,
    title: "Reputation Monitoring",
    description:
      "Track your sender reputation, bounce rates, and complaint ratios to maintain deliverability.",
    highlighted: false,
  },
];

export function DashboardFeaturesSection() {
  return (
    <SectionWrapper
      badge="Plus More"
      description="Everything else you need to run professional email operations."
      id="features"
      premium
      title="Built for Growing Teams"
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
