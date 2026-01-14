"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Calendar,
  Clock,
  Code,
  Eye,
  Filter,
  GitBranch,
  LayoutGrid,
  Mail,
  MousePointerClick,
  Palette,
  Play,
  Send,
  Sparkles,
  Tag,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetUrl, cn } from "@/lib/utils";
import { SectionWrapper } from "./section-card";

type TabKey = "templates" | "broadcasts" | "automations";

const templateFeatures = [
  { icon: Sparkles, title: "AI-Powered", badge: "AI" },
  { icon: LayoutGrid, title: "Drag & Drop" },
  { icon: Eye, title: "Live Preview" },
  { icon: Code, title: "Export Options" },
  { icon: Palette, title: "Brand Kits" },
];

const broadcastFeatures = [
  { icon: Send, title: "Send to All" },
  { icon: Filter, title: "Segments", badge: "Pro" },
  { icon: Calendar, title: "Schedule", badge: "Pro" },
  { icon: Tag, title: "Topics", badge: "Pro" },
  { icon: Users, title: "Preference Center", badge: "Pro" },
];

const automationFeatures = [
  { icon: Zap, title: "Event Triggers" },
  { icon: Clock, title: "Wait Steps" },
  { icon: GitBranch, title: "Conditions" },
  { icon: Mail, title: "Send Email" },
  { icon: MousePointerClick, title: "Actions" },
];

function TemplatesContent() {
  return (
    <div className="space-y-8">
      {/* Screenshot */}
      <div className="group relative">
        <div className="-translate-x-1/2 lg:-top-4 absolute top-2 left-1/2 mx-auto h-16 w-[70%] transform rounded-full bg-orange-500/10 blur-2xl lg:h-32" />
        <div className="relative overflow-hidden rounded-2xl border-2 bg-card shadow-2xl">
          <img
            alt="Template Editor - Light Mode"
            className="block w-full rounded-xl object-cover dark:hidden"
            decoding="async"
            loading="lazy"
            src={assetUrl("template-editor-full-light.webp")}
          />
          <img
            alt="Template Editor - Dark Mode"
            className="hidden w-full rounded-xl object-cover dark:block"
            decoding="async"
            loading="lazy"
            src={assetUrl("template-editor-full-dark.webp")}
          />
          <div className="absolute bottom-0 left-0 h-24 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/70 to-background md:h-32" />
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-3">
        {templateFeatures.map((feature) => (
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

      <p className="text-center text-muted-foreground text-sm">
        Included in Starter plan ($10/mo)
      </p>
    </div>
  );
}

function BroadcastsContent() {
  return (
    <div className="space-y-8">
      {/* Screenshot */}
      <div className="group relative">
        <div className="-translate-x-1/2 lg:-top-4 absolute top-2 left-1/2 mx-auto h-16 w-[70%] transform rounded-full bg-orange-500/10 blur-2xl lg:h-32" />
        <div className="relative overflow-hidden rounded-2xl border-2 bg-card shadow-2xl">
          <img
            alt="Broadcasts Dashboard - Light Mode"
            className="block w-full rounded-xl object-cover dark:hidden"
            decoding="async"
            loading="lazy"
            src={assetUrl("broadcasts-list-light.webp")}
          />
          <img
            alt="Broadcasts Dashboard - Dark Mode"
            className="hidden w-full rounded-xl object-cover dark:block"
            decoding="async"
            loading="lazy"
            src={assetUrl("broadcasts-list-dark.webp")}
          />
          <div className="absolute bottom-0 left-0 h-24 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/70 to-background md:h-32" />
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-3">
        {broadcastFeatures.map((feature) => (
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

      <p className="text-center text-muted-foreground text-sm">
        Basic broadcasts in Starter ($10/mo). Scheduling & segments in Pro
        ($30/mo).
      </p>
    </div>
  );
}

function AutomationsContent() {
  return (
    <div className="space-y-8">
      {/* Coming Soon Badge */}
      <div className="flex justify-center">
        <Badge
          className="bg-blue-500/10 px-4 py-1 text-blue-600 dark:text-blue-400"
          variant="secondary"
        >
          <Play className="mr-2 size-3" />
          Coming Soon in Growth
        </Badge>
      </div>

      {/* Screenshot */}
      <div className="group relative">
        <div className="-translate-x-1/2 lg:-top-4 absolute top-2 left-1/2 mx-auto h-16 w-[70%] transform rounded-full bg-orange-500/10 blur-2xl lg:h-32" />
        <div className="relative overflow-hidden rounded-2xl border-2 bg-card shadow-2xl">
          <img
            alt="Workflow Builder - Light Mode"
            className="block w-full rounded-xl object-cover dark:hidden"
            decoding="async"
            loading="lazy"
            src={assetUrl("automations-builder-light.avif")}
          />
          <img
            alt="Workflow Builder - Dark Mode"
            className="hidden w-full rounded-xl object-cover dark:block"
            decoding="async"
            loading="lazy"
            src={assetUrl("automations-builder-dark.avif")}
          />
          <div className="absolute bottom-0 left-0 h-24 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/70 to-background md:h-32" />
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-3">
        {automationFeatures.map((feature) => (
          <div
            className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 transition-colors hover:border-orange-500/50"
            key={feature.title}
          >
            <feature.icon className="size-4 text-orange-500" />
            <span className="font-medium text-sm">{feature.title}</span>
          </div>
        ))}
      </div>

      <p className="text-center text-muted-foreground text-sm">
        Workflow automations will be available in Growth plan
      </p>
    </div>
  );
}

type GlowingTabProps = {
  tabs: { key: TabKey; label: string; icon: LucideIcon }[];
  activeTab: TabKey;
  onTabChange: (key: TabKey) => void;
};

function GlowingTabBar({ tabs, activeTab, onTabChange }: GlowingTabProps) {
  return (
    <div className="mb-8 flex justify-center">
      {/* Outer glow container */}
      <div className="relative">
        {/* Background glow effect */}
        <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl dark:bg-orange-500/10" />

        {/* Tab container with glass effect */}
        <div className="relative inline-flex gap-1 rounded-full border border-orange-500/20 bg-background/80 p-1.5 shadow-lg backdrop-blur-sm dark:border-orange-500/30 dark:bg-background/50">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                className={cn(
                  "group relative flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5 font-medium text-sm transition-all duration-300",
                  isActive
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : "text-muted-foreground hover:bg-orange-500/10 hover:text-foreground dark:hover:bg-orange-500/20"
                )}
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                type="button"
              >
                {/* Active tab glow */}
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-orange-500 blur-md opacity-50" />
                )}

                <Icon
                  className={cn(
                    "relative size-4 transition-transform duration-300",
                    isActive
                      ? "scale-110"
                      : "group-hover:scale-110 group-hover:text-orange-500"
                  )}
                />

                <span className="relative hidden sm:inline">{tab.label}</span>

                {/* Shimmer effect for inactive tabs - staggered for ripple effect */}
                {!isActive && (
                  <div
                    className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-orange-500/10 to-transparent"
                    style={{ animationDelay: `${index * 0.3}s` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ProductTabbedSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("templates");

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: "templates", label: "Templates", icon: LayoutGrid },
    { key: "broadcasts", label: "Broadcasts", icon: Send },
    { key: "automations", label: "Automations", icon: Workflow },
  ];

  return (
    <SectionWrapper
      badge="From $10/mo"
      badgeColor="orange"
      badgeLink="/platform"
      description="Build emails, send campaigns, and automate workflows - all from your browser."
      id="platform"
      title="Wraps Platform"
    >
      <GlowingTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

      {/* Tab content */}
      <div className="min-h-[450px]">
        {activeTab === "templates" && <TemplatesContent />}
        {activeTab === "broadcasts" && <BroadcastsContent />}
        {activeTab === "automations" && <AutomationsContent />}
      </div>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button asChild className="bg-orange-500 hover:bg-orange-600" size="lg">
          <a href="https://app.wraps.dev/auth?mode=signup">
            Start Free Trial
            <ArrowRight className="ml-2 size-4" />
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="/platform">Learn More</a>
        </Button>
      </div>
    </SectionWrapper>
  );
}
