"use client";

import {
  ArrowRight,
  Code,
  Eye,
  Infinity,
  LayoutGrid,
  Palette,
  Sparkles,
} from "lucide-react";
import { Image3D } from "@/components/image-3d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { assetUrl } from "@/lib/utils";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Content",
    description: "Generate entire emails or refine sections with AI assistance",
  },
  {
    icon: LayoutGrid,
    title: "20+ Drag & Drop Blocks",
    description: "Buttons, images, sections, layouts, and pre-built templates",
  },
  {
    icon: Infinity,
    title: "Unlimited Templates",
    description:
      "Create as many templates as you need. No limits or per-template fees",
  },
  {
    icon: Eye,
    title: "Real-time Preview",
    description: "See your email on desktop, tablet, and mobile instantly",
  },
  {
    icon: Code,
    title: "Export to Code",
    description: "Export as React Email, HTML, or JSON for full flexibility",
  },
  {
    icon: Palette,
    title: "Brand Kits",
    description: "Apply your brand colors and styles automatically",
  },
];

function PlaceholderImage({
  alt,
  className,
}: {
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/50 ${className}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <LayoutGrid className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{alt}</p>
          <p className="text-muted-foreground text-sm">Screenshot coming soon</p>
        </div>
      </div>
    </div>
  );
}

function ImageWithFallback({
  lightSrc,
  darkSrc,
  alt,
  className,
  direction,
}: {
  lightSrc: string;
  darkSrc: string;
  alt: string;
  className?: string;
  direction?: "left" | "right";
}) {
  // Check if images exist by attempting to use them
  // For now, use Image3D which gracefully handles missing images
  return (
    <Image3D
      alt={alt}
      className={className}
      darkSrc={darkSrc}
      direction={direction}
      lightSrc={lightSrc}
    />
  );
}

export function TemplateEditorSection() {
  return (
    <section className="py-24 sm:py-32" id="template-editor">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <Badge className="mb-4" variant="outline">
            <Sparkles className="mr-1.5 h-3 w-3" />
            Template Editor
          </Badge>
          <h2 className="mb-4 font-bold text-3xl tracking-tight sm:text-4xl lg:text-5xl">
            Build Beautiful Emails with
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {" "}
              AI-Powered Editing
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A professional-grade email builder with drag-and-drop components, AI
            content generation, real-time preview, and one-click publishing to
            your AWS account. Create unlimited templates with the hosted
            dashboard.
          </p>
        </div>

        {/* Hero Image - Full Editor */}
        <div className="mx-auto mb-20 max-w-6xl">
          <div className="group relative">
            {/* Background glow */}
            <div className="lg:-top-8 -translate-x-1/2 absolute top-2 left-1/2 mx-auto h-24 w-[90%] transform rounded-full bg-primary/30 blur-3xl lg:h-60" />

            <div className="relative overflow-hidden rounded-xl border-2 bg-card shadow-2xl">
              {/* Light mode image */}
              <img
                alt="Template Editor - Light Mode"
                className="block w-full rounded-xl object-cover dark:hidden"
                src={assetUrl("template-editor-full-light.webp")}
                onError={(e) => {
                  // Fallback to placeholder
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove(
                    "hidden"
                  );
                }}
              />
              <div className="hidden dark:hidden">
                <PlaceholderImage alt="Template Editor Preview" />
              </div>

              {/* Dark mode image */}
              <img
                alt="Template Editor - Dark Mode"
                className="hidden w-full rounded-xl object-cover dark:block"
                src={assetUrl("template-editor-full-dark.webp")}
                onError={(e) => {
                  // Fallback to placeholder
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove(
                    "!hidden"
                  );
                }}
              />
              <div className="!hidden dark:!hidden">
                <PlaceholderImage alt="Template Editor Preview" />
              </div>

              {/* Bottom fade effect */}
              <div className="absolute bottom-0 left-0 h-32 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/70 to-background md:h-40" />
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mx-auto mb-20 max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                className="border-border/50 bg-background/60 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg"
                key={feature.title}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Two-column: AI Panel + Blocks Palette */}
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* AI Panel */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-xl">AI Content Assistant</h3>
                </div>
                <p className="text-muted-foreground">
                  Generate entire email templates from a simple prompt, or
                  refine individual sections. The AI understands your brand kit
                  and maintains consistent styling across all generated content.
                </p>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Quick prompts for welcome, newsletter, and more
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Conversational chat interface
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    50 to 1,000 AI messages/month by plan
                  </li>
                </ul>
              </div>
              <ImageWithFallback
                alt="AI Assistant Panel"
                darkSrc="template-editor-ai-dark.webp"
                direction="left"
                lightSrc="template-editor-ai-light.webp"
              />
            </div>

            {/* Blocks Palette */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-xl">
                    Drag & Drop Components
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  Choose from 20+ email-optimized components including buttons,
                  images, sections, layouts, and pre-built template sections
                  like headers, footers, and CTAs.
                </p>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Email-optimized responsive components
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Pre-built sections (Hero, Features, CTA)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Save and reuse custom blocks across templates
                  </li>
                </ul>
              </div>
              <ImageWithFallback
                alt="Block Palette"
                darkSrc="template-editor-blocks-dark.webp"
                direction="right"
                lightSrc="template-editor-blocks-light.webp"
              />
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild className="cursor-pointer" size="lg">
            <a href="https://app.wraps.dev/auth?mode=signup&plan=starter">
              Start Building Templates
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            className="cursor-pointer"
            size="lg"
            variant="outline"
          >
            <a href="#pricing">View Pricing</a>
          </Button>
        </div>
        <p className="mt-4 text-center text-muted-foreground text-sm">
          Template editor included in Starter plan ($10/mo)
        </p>
      </div>
    </section>
  );
}
