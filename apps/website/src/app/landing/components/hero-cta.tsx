"use client";

import { Button } from "@wraps/ui/components/ui/button";
import { trackEvent } from "@/utils/analytics";

export function HeroAnimatedCTA() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        asChild
        className="cursor-pointer bg-orange-500 text-white hover:bg-orange-600"
        size="lg"
      >
        <a
          href="https://app.wraps.dev/auth?mode=signup"
          onClick={() =>
            trackEvent("cta_click", {
              location: "hero",
              cta_text: "Start building",
            })
          }
        >
          Start building
        </a>
      </Button>
      <Button asChild className="cursor-pointer" size="lg" variant="outline">
        <a
          href="/docs/quickstart"
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
