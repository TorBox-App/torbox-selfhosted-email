"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardCtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-foreground px-8 py-16 text-center text-background">
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            Ready to upgrade your email ops?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-background/70">
            Start with the free CLI and local console. Upgrade to the Wraps
            Platform when you need team features.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="bg-orange-500 text-white hover:bg-orange-600"
              size="lg"
            >
              <a href="https://app.wraps.dev">
                Get Started
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
            <Button
              asChild
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              size="lg"
              variant="outline"
            >
              <a href="/cli">Explore the Free CLI</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
