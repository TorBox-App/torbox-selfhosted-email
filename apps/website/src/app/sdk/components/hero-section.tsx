"use client";

import { DotPattern } from "@wraps/ui/components/dot-pattern";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SdkHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-24 sm:pt-32">
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-4 font-mono text-orange-500 text-sm">
            @wraps.dev/email &middot; @wraps.dev/sms &middot; @wraps.dev/client
          </p>

          <h1 className="mb-6 text-balance font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            <span>Communication</span>{" "}
            <span className="inline-block bg-linear-to-r from-orange-500 to-amber-500 bg-clip-text pb-2 text-transparent">
              as code.
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            TypeScript SDKs that send through your AWS account. Define templates
            in React, automate with workflows, trigger from custom events.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="h-14 bg-orange-500 px-8 text-base hover:bg-orange-600 sm:h-16 sm:px-12 sm:text-lg"
              size="lg"
            >
              <a href="/docs/quickstart/email">
                Get Started
                <ArrowRight className="ml-2 size-5" />
              </a>
            </Button>
            <Button
              asChild
              className="h-14 px-8 text-base sm:h-16 sm:px-12 sm:text-lg"
              size="lg"
              variant="outline"
            >
              <a href="/docs/sdk-reference">
                <BookOpen className="mr-2 size-5" />
                SDK Reference
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
