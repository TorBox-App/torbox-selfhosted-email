"use client";

import { ArrowRight, Github } from "lucide-react";
import { motion } from "motion/react";
import { DotPattern } from "@/components/dot-pattern";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/utils/analytics";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-24 lg:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start">
          {/* Badge */}
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
            initial={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <a
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-orange-500 transition-colors hover:border-orange-500/50"
              href="https://github.com/wraps-team/wraps"
            >
              <Github className="size-4" />
              <span>Open Source</span>
              <span className="text-muted-foreground">·</span>
              <span>AGPLv3 Licensed</span>
            </a>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[864px] text-left text-[28px] font-medium leading-[32px] md:text-[34px] md:leading-[40px] lg:text-[48px] lg:leading-[56px]"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            The email platform that sends through your AWS.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 max-w-[750px] text-left text-[16px] leading-[24px] text-muted-foreground md:text-[18px] md:leading-[26px] lg:text-[20px] lg:leading-[28px]"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Automate on user behavior. Design templates. Schedule broadcasts.
            <br />
            Transparent pricing. Sending infrastructure you own.
          </motion.p>

          {/* CTA */}
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
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
          </motion.div>
        </div>
      </div>
    </section>
  );
}
