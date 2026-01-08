"use client";

import { Calendar, Filter, Send, Tag, Users } from "lucide-react";
import { SectionWrapper } from "@/app/landing/components/section-card";
import { Badge } from "@/components/ui/badge";
import { assetUrl } from "@/lib/utils";

const features = [
  {
    icon: Send,
    title: "Send to All",
    description: "Send broadcasts to all contacts instantly",
  },
  {
    icon: Filter,
    title: "Segments",
    description: "Target contacts by properties like plan or location",
    badge: "Pro",
  },
  {
    icon: Calendar,
    title: "Schedule",
    description: "Pick a date and time for automatic sending",
    badge: "Pro",
  },
  {
    icon: Tag,
    title: "Topics",
    description: "Let contacts subscribe to topics they care about",
    badge: "Pro",
  },
  {
    icon: Users,
    title: "Preference Center",
    description: "Hosted page for contacts to manage preferences",
    badge: "Pro",
  },
];

export function DashboardBroadcastsSection() {
  return (
    <SectionWrapper
      badge="Broadcasts"
      description="Send newsletters, announcements, and marketing campaigns. Schedule sends and target specific segments."
      id="broadcasts"
      premium
      title="Reach Your Audience"
    >
      {/* Main Screenshot */}
      <div className="mb-12">
        <div className="group relative">
          {/* Background glow */}
          <div className="absolute top-2 left-1/2 mx-auto h-16 w-[70%] -translate-x-1/2 transform rounded-full bg-orange-500/10 blur-2xl lg:-top-4 lg:h-32" />

          <div className="relative overflow-hidden rounded-2xl border-2 bg-card shadow-2xl">
            {/* Light mode image */}
            <img
              alt="Broadcasts Dashboard - Light Mode"
              className="block w-full rounded-xl object-cover dark:hidden"
              decoding="async"
              loading="lazy"
              src={assetUrl("broadcasts-list-light.webp")}
            />
            {/* Dark mode image */}
            <img
              alt="Broadcasts Dashboard - Dark Mode"
              className="hidden w-full rounded-xl object-cover dark:block"
              decoding="async"
              loading="lazy"
              src={assetUrl("broadcasts-list-dark.webp")}
            />

            {/* Bottom fade effect */}
            <div className="absolute bottom-0 left-0 h-24 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/70 to-background md:h-32" />
          </div>
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-3">
        {features.map((feature) => (
          <div
            className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 transition-colors hover:border-orange-500/50"
            key={feature.title}
          >
            <feature.icon className="size-4 text-orange-500" />
            <span className="font-medium text-sm">{feature.title}</span>
            {feature.badge && (
              <Badge
                className="bg-orange-500/10 text-orange-600 text-xs dark:text-orange-400"
                variant="secondary"
              >
                {feature.badge}
              </Badge>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-muted-foreground text-sm">
        Basic broadcasts in Starter ($10/mo). Scheduling & segments in Pro
        ($30/mo).
      </p>
    </SectionWrapper>
  );
}
