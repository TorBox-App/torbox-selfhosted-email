"use client";

import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WrapsMotif } from "@/components/wraps-motif";
import { trackEvent } from "@/utils/analytics";

export function CTAButtons() {
  return (
    <div className="flex flex-col justify-center gap-4 sm:flex-row">
      <Button
        asChild
        className="cursor-pointer bg-orange-500 hover:bg-orange-600"
        size="lg"
      >
        <a
          href="/docs/quickstart"
          onClick={() =>
            trackEvent("cta_click", {
              location: "footer_cta",
              cta_text: "Free CLI Quickstart",
            })
          }
        >
          Free CLI Quickstart
          <WrapsMotif className="ml-2 size-3.5 text-white/70" />
        </a>
      </Button>
      <Button
        asChild
        className="group cursor-pointer"
        size="lg"
        variant="outline"
      >
        <a
          href="https://github.com/wraps-team/wraps"
          onClick={() =>
            trackEvent("cta_click", {
              location: "footer_cta",
              cta_text: "View on GitHub",
            })
          }
          rel="noopener noreferrer"
          target="_blank"
        >
          <Github aria-hidden="true" className="me-2 size-4" />
          View on GitHub
          <ArrowRight
            aria-hidden="true"
            className="ms-2 size-4 transition-transform group-hover:translate-x-1"
          />
        </a>
      </Button>
    </div>
  );
}
