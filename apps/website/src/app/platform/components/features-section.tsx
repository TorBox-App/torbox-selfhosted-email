"use client";

import { BarChart3, Globe, History, Key, Shield, Users } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const features = [
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Track opens, clicks, bounces, and complaints as they happen",
  },
  {
    icon: History,
    title: "Message History",
    description: "Search and filter through your email history with timelines",
  },
  {
    icon: Users,
    title: "Contact Management",
    description: "Import contacts, track preferences, manage suppression lists",
  },
  {
    icon: Globe,
    title: "Domain Management",
    description: "Add domains, monitor DKIM/SPF/DMARC from one dashboard",
  },
  {
    icon: Shield,
    title: "Reputation Monitoring",
    description: "Track sender reputation, bounce rates, complaint ratios",
  },
  {
    icon: Key,
    title: "SMTP Credentials",
    description: "Generate credentials for legacy integrations",
  },
];

export function DashboardFeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="pt-60 pb-20" id="features" ref={ref}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Compact header */}
        <motion.div
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="mb-2 font-semibold text-xl">
            Plus everything else you need
          </h3>
          <p className="text-muted-foreground text-sm">Included in all plans</p>
        </motion.div>

        {/* Compact feature grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                className="flex items-start gap-3 rounded-lg border bg-background/50 p-4"
                key={feature.title}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                  <Icon className="size-4 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
