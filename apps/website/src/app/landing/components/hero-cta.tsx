"use client";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/utils/analytics";

export function HeroAnimatedCTA() {
  return (
    <div className="mt-8">
      <Button
        asChild
        className="cursor-pointer rounded bg-orange-500 px-5 py-2.5 text-sm font-semibold hover:bg-orange-600"
        size="lg"
      >
        <a
          href="https://app.wraps.dev/auth?mode=signup"
          onClick={() =>
            trackEvent("cta_click", {
              location: "hero",
              cta_text: "Start free",
            })
          }
        >
          Start free
        </a>
      </Button>
      <p className="mt-3 text-[12px] text-foreground/50">
        No credit card. No vendor lock-in. Deploy with{" "}
        <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono text-foreground/70">
          npx @wraps.dev/cli
        </code>
      </p>
    </div>
  );
}
