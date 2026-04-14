"use client";

import { DotPattern } from "@wraps/ui/components/dot-pattern";
import { Button } from "@wraps/ui/components/ui/button";
import { ArrowRight } from "lucide-react";

export function DashboardHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-24 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Main Headline */}
          <h1 className="mb-6 text-balance font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            <span>Stop overpaying to send</span>{" "}
            <span className="inline-block bg-linear-to-r from-orange-500 to-amber-500 bg-clip-text pb-2 text-transparent">
              newsletters and campaigns.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Wraps deploys email infrastructure to your AWS account. You pay AWS
            prices — not Mailchimp prices.
          </p>

          {/* CTA */}
          <div>
            <Button
              asChild
              className="h-14 w-full bg-orange-500 px-8 text-base hover:bg-orange-600 sm:h-16 sm:w-auto sm:px-12 sm:text-lg"
              size="lg"
            >
              <a href="https://app.wraps.dev/auth?mode=signup">
                Get Started
                <ArrowRight className="ml-2 size-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
