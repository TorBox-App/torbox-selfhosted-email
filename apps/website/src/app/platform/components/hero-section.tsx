"use client";

import { ArrowRight, LayoutDashboard } from "lucide-react";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DashboardHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 flex justify-center">
            <Badge
              className="border-orange-500/30 bg-orange-500/10 px-4 py-2 text-orange-600 dark:text-orange-400"
              variant="outline"
            >
              <LayoutDashboard className="mr-2 size-4" />
              Wraps Platform
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            Your email ops,
            <br />
            <span className="text-orange-500">beautifully managed.</span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Analytics, templates, automations, and contacts management for teams. All built on your self-hosted AWS infrastructure.
          </p>

          {/* Pricing */}
          <div className="mb-8">
            <span className="text-muted-foreground">Starting at </span>
            <span className="font-bold text-4xl">$10</span>
            <span className="ml-2 text-lg text-muted-foreground line-through">$19</span>
            <span className="text-muted-foreground">/month</span>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 font-medium text-white text-sm">
                Early Adopter Pricing
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <a href="https://app.wraps.dev">
                Get Started
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">See Features</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
