"use client";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/utils/analytics";

export function HeroAnimatedCTA() {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <Button
          asChild
          className="cursor-pointer rounded bg-orange-500 px-4 py-2 text-sm font-semibold hover:bg-orange-600"
        >
          <a
            href="/docs/quickstart/email"
            onClick={() =>
              trackEvent("cta_click", {
                location: "hero",
                cta_text: "Send your first email",
              })
            }
          >
            Send your first email
          </a>
        </Button>
        <Button
          asChild
          className="cursor-pointer rounded border-[0.5px] bg-white px-4 py-2 text-sm font-medium text-foreground hover:text-orange-500 dark:bg-transparent"
          variant="outline"
        >
          <a
            href="https://github.com/wraps-team/wraps"
            onClick={() =>
              trackEvent("cta_click", {
                location: "hero",
                cta_text: "View on GitHub",
              })
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            View on GitHub
          </a>
        </Button>
      </div>
      <p className="mt-3 text-[12px] text-foreground/50">
        No account required. Free and open source.
      </p>
    </div>
  );
}
