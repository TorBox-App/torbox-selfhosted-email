"use client";

import {
  BarChart3,
  Globe,
  History,
  Mail,
  MessageSquare,
  Shield,
} from "lucide-react";
import { SectionWrapper } from "@/app/landing/components/section-card";
import { Logo } from "@/components/logo";
import { assetUrl } from "@/lib/utils";

const consoleFeatures = [
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Track sends, deliveries, opens, clicks, bounces, and complaints as they happen.",
  },
  {
    icon: History,
    title: "Message History",
    description: "Search and filter through your email and SMS history with full event timelines.",
  },
  {
    icon: Globe,
    title: "Domain Management",
    description: "View domain verification status, DKIM records, and DNS configuration.",
  },
  {
    icon: Shield,
    title: "Reputation Metrics",
    description: "Monitor your sender reputation, bounce rates, and complaint ratios.",
  },
];

export function CliConsoleSection() {
  return (
    <SectionWrapper
      badge="Local Console"
      description="A full web dashboard that runs on your machine. No data leaves your AWS account."
      id="console"
      title="Your data, your machine"
    >
      {/* Browser Window Mockup with Screenshots */}
      <div className="mb-16">
        <div className="group relative mx-auto max-w-5xl">
          {/* Glow effect */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-green-500/20 via-green-500/10 to-green-500/20 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />

          {/* Browser window */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-green-500/30 bg-background shadow-2xl">
            {/* Browser chrome */}
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500" />
                  <div className="size-3 rounded-full bg-yellow-500" />
                  <div className="size-3 rounded-full bg-green-500" />
                </div>
                <div className="hidden items-center gap-2 rounded-md bg-background/80 px-3 py-1 sm:flex">
                  <div className="size-3 rounded-full bg-green-500/50" />
                  <span className="font-mono text-muted-foreground text-xs">
                    localhost:5555
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span className="hidden rounded bg-green-500/10 px-2 py-0.5 font-medium text-green-600 sm:inline dark:text-green-400">
                  Local Mode
                </span>
              </div>
            </div>

            {/* Screenshot */}
            <div className="relative aspect-video overflow-hidden bg-muted/20">
              {/* Light mode image */}
              <img
                alt="Wraps local console dashboard - Light Mode"
                className="block size-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02] dark:hidden"
                decoding="async"
                loading="lazy"
                src={assetUrl("wraps-console-light.avif")}
              />
              {/* Dark mode image */}
              <img
                alt="Wraps local console dashboard - Dark Mode"
                className="hidden size-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02] dark:block"
                decoding="async"
                loading="lazy"
                src={assetUrl("wraps-console-dark.avif")}
              />

              {/* Fade overlay at bottom */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />
            </div>
          </div>

          {/* Floating sidebar menu card */}
          <div className="absolute top-12 -left-16 hidden rounded-xl border bg-background p-3 shadow-xl sm:block lg:-left-20">
            {/* Logo */}
            <div className="mb-3 flex justify-center border-b pb-3">
              <Logo size={28} />
            </div>
            {/* Menu items */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 rounded-md bg-green-500/10 px-2.5 py-1.5">
                <Mail className="size-4 text-green-500" />
                <span className="font-medium text-green-600 text-sm dark:text-green-400">Email</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/50">
                <MessageSquare className="size-4" />
                <span className="text-sm">SMS</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/50">
                <Globe className="size-4" />
                <span className="text-sm">CDN</span>
              </div>
            </div>
          </div>

          {/* Floating terminal card */}
          <div className="absolute -bottom-6 -left-4 hidden rounded-xl border-2 border-green-500/30 bg-[#121314] p-4 shadow-2xl sm:block lg:-left-8">
            <div className="font-mono text-sm">
              <div className="mb-2 text-muted-foreground">
                <span className="text-green-400">$</span> wraps console
              </div>
              <div className="text-green-400">
                Dashboard: <span className="text-cyan-400">http://localhost:5555</span>
              </div>
            </div>
          </div>

          {/* Floating stats card */}
          <div className="absolute -top-4 -right-4 hidden rounded-xl border bg-background p-4 shadow-xl sm:block lg:-right-8">
            <div className="mb-2 font-medium text-muted-foreground text-xs">Today's Stats</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-green-500" />
                <span>1,234 sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-blue-500" />
                <span>98.2% delivered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-orange-500" />
                <span>42.1% opened</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-purple-500" />
                <span>12.3% clicked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="mx-auto max-w-4xl">
        <h3 className="mb-8 text-center font-semibold text-xl">
          Full dashboard, zero cloud dependency
        </h3>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {consoleFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                className="rounded-xl border bg-muted/30 p-5 text-center"
                key={feature.title}
              >
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                  <Icon className="size-5 text-green-500" />
                </div>
                <h4 className="mb-1 font-semibold text-sm">{feature.title}</h4>
                <p className="text-muted-foreground text-xs">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
