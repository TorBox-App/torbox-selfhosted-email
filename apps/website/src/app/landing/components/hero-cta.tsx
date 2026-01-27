"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/utils/analytics";

export function HeroAnimatedCTA() {
  return (
    <div className="mt-8 flex items-center gap-3 animate-fade-in-up animation-delay-200">
      <Button
        asChild
        className="cursor-pointer rounded bg-orange-500 px-4 py-2 text-sm font-semibold hover:bg-orange-600"
      >
        <a
          href="https://app.wraps.dev/auth?mode=signup"
          onClick={() =>
            trackEvent("cta_click", {
              location: "hero",
              cta_text: "Get started",
            })
          }
        >
          Start for free
          <ArrowRight className="ml-2 size-5" />
        </a>
      </Button>
      <Button
        asChild
        className="cursor-pointer rounded border-[0.5px] bg-white px-4 py-2 text-sm font-medium text-foreground hover:text-orange-500 dark:bg-transparent"
        variant="outline"
      >
        <a
          href="/docs"
          onClick={() =>
            trackEvent("cta_click", {
              location: "hero",
              cta_text: "Read the docs",
            })
          }
        >
          Read the docs
        </a>
      </Button>
    </div>
  );
}
