"use client";

import { Code, Eye, LayoutGrid, Palette, Sparkles } from "lucide-react";
import { SectionWrapper } from "@/app/landing/components/section-card";
import { Badge } from "@/components/ui/badge";
import { assetUrl } from "@/lib/utils";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered",
    description: "Generate emails from prompts or refine sections with AI",
    badge: "AI",
  },
  {
    icon: LayoutGrid,
    title: "Drag & Drop",
    description: "20+ components including buttons, images, and layouts",
  },
  {
    icon: Eye,
    title: "Live Preview",
    description: "See your email on desktop, tablet, and mobile instantly",
  },
  {
    icon: Code,
    title: "Export Options",
    description: "Export as React Email, HTML, or JSON",
  },
  {
    icon: Palette,
    title: "Brand Kits",
    description: "Apply your brand colors and styles automatically",
  },
];

export function DashboardTemplatesSection() {
  return (
    <SectionWrapper
      badge="Template Editor"
      description="A professional-grade email builder with drag-and-drop components, AI generation, and real-time preview."
      id="templates"
      premium
      title="Build Beautiful Emails"
    >
      {/* Main Screenshot */}
      <div className="mb-12">
        <div className="group relative">
          {/* Background glow */}
          <div className="absolute top-2 left-1/2 mx-auto h-16 w-[70%] -translate-x-1/2 transform rounded-full bg-orange-500/10 blur-2xl lg:-top-4 lg:h-32" />

          <div className="relative overflow-hidden rounded-2xl border-2 bg-card shadow-2xl">
            {/* Light mode image */}
            <img
              alt="Template Editor - Light Mode"
              className="block w-full rounded-xl object-cover dark:hidden"
              decoding="async"
              loading="lazy"
              src={assetUrl("template-editor-full-light.webp")}
            />
            {/* Dark mode image */}
            <img
              alt="Template Editor - Dark Mode"
              className="hidden w-full rounded-xl object-cover dark:block"
              decoding="async"
              loading="lazy"
              src={assetUrl("template-editor-full-dark.webp")}
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
        Included in Starter plan ($10/mo)
      </p>
    </SectionWrapper>
  );
}
