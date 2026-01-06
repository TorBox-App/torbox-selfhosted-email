"use client";

import {
  Clock,
  GitBranch,
  Mail,
  MousePointerClick,
  Play,
  Workflow,
  Zap,
} from "lucide-react";
import { SectionWrapper } from "@/app/landing/components/section-card";
import { Badge } from "@/components/ui/badge";
import { assetUrl } from "@/lib/utils";

const features = [
  {
    icon: Zap,
    title: "Event Triggers",
    description: "Start workflows from signups, purchases, or custom events",
  },
  {
    icon: Clock,
    title: "Wait Steps",
    description: "Add delays between actions - hours, days, or weeks",
  },
  {
    icon: GitBranch,
    title: "Conditions",
    description: "Branch workflows based on contact properties or behavior",
  },
  {
    icon: Mail,
    title: "Send Email",
    description: "Send templated emails at the perfect moment",
  },
  {
    icon: MousePointerClick,
    title: "Actions",
    description: "Update contacts, add tags, or trigger webhooks",
  },
];

function PlaceholderImage() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-muted-foreground/25 border-dashed bg-muted/50">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex aspect-square size-16 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500/5">
          <Workflow className="size-8 text-orange-500" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Workflow Builder</p>
          <p className="text-muted-foreground text-sm">
            Screenshot coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardAutomationsSection() {
  // Check if automation images exist - use placeholder if not
  const hasImages = true;

  return (
    <SectionWrapper
      badge="Automations"
      description="Build automated email sequences triggered by events, time delays, or conditions. Visual workflow builder included."
      id="automations"
      premium
      title="Automate Your Email Flows"
    >
      {/* Coming Soon Badge */}
      <div className="mb-8 flex justify-center">
        <Badge
          className="bg-blue-500/10 px-4 py-1 text-blue-600 dark:text-blue-400"
          variant="secondary"
        >
          <Play className="mr-2 size-3" />
          Coming Soon in Growth
        </Badge>
      </div>

      {/* Main Screenshot or Placeholder */}
      <div className="mb-12">
        <div className="group relative">
          {/* Background glow */}
          <div className="-translate-x-1/2 lg:-top-4 absolute top-2 left-1/2 mx-auto h-16 w-[70%] transform rounded-full bg-orange-500/10 blur-2xl lg:h-32" />

          <div className="relative overflow-hidden rounded-2xl border-2 bg-card shadow-2xl">
            {hasImages ? (
              <>
                {/* Light mode image */}
                <img
                  alt="Workflow Builder - Light Mode"
                  className="block w-full rounded-xl object-cover dark:hidden"
                  decoding="async"
                  loading="lazy"
                  src={assetUrl("automations-builder-light.avif")}
                />
                {/* Dark mode image */}
                <img
                  alt="Workflow Builder - Dark Mode"
                  className="hidden w-full rounded-xl object-cover dark:block"
                  decoding="async"
                  loading="lazy"
                  src={assetUrl("automations-builder-dark.avif")}
                />
              </>
            ) : (
              <PlaceholderImage />
            )}

            {/* Bottom fade effect - only show if has images */}
            {hasImages && (
              <div className="absolute bottom-0 left-0 h-24 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/70 to-background md:h-32" />
            )}
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
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-muted-foreground text-sm">
        Workflow automations will be available in Pro plan ($30/mo)
      </p>
    </SectionWrapper>
  );
}
