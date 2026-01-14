"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const comparisonFeatures = [
  { feature: "CLI deployment", free: true, starter: true, pro: true },
  { feature: "TypeScript SDK", free: true, starter: true, pro: true },
  { feature: "Event tracking", free: true, starter: true, pro: true },
  { feature: "Local console", free: true, starter: true, pro: true },
  {
    feature: "Email analytics",
    free: "Local",
    starter: true,
    pro: true,
  },
  { feature: "Wraps Platform", free: false, starter: true, pro: true },
  { feature: "Contacts", free: false, starter: "5,000", pro: "25,000" },
  { feature: "Templates", free: false, starter: "Unlimited", pro: "Unlimited" },
  { feature: "AI generations", free: false, starter: "50/mo", pro: "250/mo" },
  { feature: "Broadcasts", free: false, starter: true, pro: true },
  {
    feature: "Scheduled broadcasts",
    free: false,
    starter: false,
    pro: true,
  },
  { feature: "Topics", free: false, starter: false, pro: true },
  { feature: "Segments", free: false, starter: false, pro: true },
  { feature: "Preference center", free: false, starter: false, pro: true },
  { feature: "AWS accounts", free: false, starter: "1", pro: "3" },
  { feature: "Support", free: "GitHub", starter: "48hr", pro: "24hr" },
];

// Premium background class - use this on all premium sections
// Light mode: warm neutral stone tint
// Dark mode: slightly lighter than base (white overlay)
export const premiumBgClass = "bg-stone-100/50 dark:bg-white/[0.06]";

export function UpgradeSection() {
  return (
    <section className="relative">
      {/* Header - Normal background */}
      <div className="pt-24 pb-8">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <span className="mb-4 inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 font-medium text-orange-600 text-xs dark:text-orange-400">
            Ready for More?
          </span>
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            Unlock the Full Platform
          </h2>
          <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
            Everything in the free tier, plus the Wraps Platform with template
            editor, AI generation, and more coming soon.
          </p>
        </div>
      </div>

      {/* Table section with slant cutting through the middle */}
      <div className="relative">
        {/* Slanted background using clip-path */}
        <div
          className={`pointer-events-none absolute inset-0 ${premiumBgClass} [clip-path:polygon(0_70%,100%_30%,100%_100%,0_100%)]`}
        />

        {/* Table content - on top of the slant */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
              {/* Table Header */}
              <div className="grid grid-cols-4 border-b bg-muted/50 px-4 py-4 sm:px-6">
                <div className="font-medium text-muted-foreground text-sm">
                  Feature
                </div>
                <div className="text-center font-medium text-green-600 text-sm dark:text-green-400">
                  Free
                </div>
                <div className="text-center font-medium text-sm">
                  Starter
                </div>
                <div className="text-center font-medium text-orange-500 text-sm">
                  Pro
                </div>
              </div>

              {/* Table Rows */}
              {comparisonFeatures.map((row, index) => (
                <div
                  className={`grid grid-cols-4 px-4 py-3 sm:px-6 ${
                    index !== comparisonFeatures.length - 1 ? "border-b" : ""
                  }`}
                  key={row.feature}
                >
                  <div className="text-sm">{row.feature}</div>
                  <div className="flex justify-center">
                    {typeof row.free === "string" ? (
                      <span className="text-muted-foreground text-xs sm:text-sm">
                        {row.free}
                      </span>
                    ) : row.free ? (
                      <Check className="size-5 text-green-600" />
                    ) : (
                      <X className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex justify-center">
                    {typeof row.starter === "string" ? (
                      <span className="text-foreground text-xs sm:text-sm">
                        {row.starter}
                      </span>
                    ) : row.starter ? (
                      <Check className="size-5 text-green-600" />
                    ) : (
                      <X className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex justify-center">
                    {typeof row.pro === "string" ? (
                      <span className="font-medium text-orange-500 text-xs sm:text-sm">
                        {row.pro}
                      </span>
                    ) : row.pro ? (
                      <Check className="size-5 text-green-600" />
                    ) : (
                      <X className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA - Premium background */}
      <div className={premiumBgClass}>
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="cursor-pointer border-green-500/50 text-green-700 hover:bg-green-500/10 dark:text-green-400"
              size="lg"
              variant="outline"
            >
              <a href="/cli">Learn About Free Tier</a>
            </Button>
            <Button
              asChild
              className="cursor-pointer bg-orange-500 hover:bg-orange-600"
              size="lg"
            >
              <a href="/platform">
                See Platform Pricing
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
