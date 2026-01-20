"use client";

import { ArrowRight, Github } from "lucide-react";
import { trackEvent } from "@/utils/analytics";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./animations";

export const CTASection = memo(function CTASection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <FadeIn>
          <p className="mb-6 text-2xl font-medium tracking-tight sm:text-3xl">
            Infrastructure You Own.{" "}
            <span className="text-orange-500">Forever.</span>
          </p>

          <p className="mb-8 text-muted-foreground">
            Deploy to your AWS in one command. Cancel anytime—your
            infrastructure keeps running.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
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

          {/* Trust signals */}
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
            <span>✓ No credit card</span>
            <span>✓ Infrastructure stays if you cancel</span>
            <span>✓ Open source</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
});
