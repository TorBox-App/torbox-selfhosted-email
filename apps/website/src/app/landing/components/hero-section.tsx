import { DotPattern } from "@wraps/ui/components/dot-pattern";
import { Github } from "lucide-react";
import Image from "next/image";
import { HeroAnimatedCTA } from "./hero-cta";
import { HeroTerminal } from "./hero-terminal";

// Static content - server rendered, visible immediately
export function HeroSection() {
  return (
    <section className="relative pt-20 pb-16 md:pt-24 lg:pt-32">
      {/* Background Pattern — extends past section to blend into principles */}
      <div className="absolute inset-0 -bottom-80">
        <DotPattern
          className="opacity-100 dark:opacity-65"
          fadeStyle="ellipse"
          size="md"
        />
      </div>

      {/* Noise grain texture — extends to match */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -bottom-80 h-[calc(100%+20rem)] w-full opacity-[0.06]"
      >
        <filter id="hero-noise">
          <feTurbulence
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
            type="fractalNoise"
          />
        </filter>
        <rect filter="url(#hero-noise)" height="100%" width="100%" />
      </svg>

      <div className="relative mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12">
          {/* Left column — copy */}
          <div className="flex flex-col items-start lg:flex-1">
            {/* Badge */}
            <div className="mb-6">
              <a
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-orange-500 transition-colors hover:border-orange-500/50"
                href="https://github.com/wraps-team/wraps"
              >
                <Github className="size-4" />
                <span>Open Source</span>
                <span className="text-muted-foreground">·</span>
                <span>AGPLv3 Licensed</span>
              </a>
            </div>

            {/* Main Headline */}
            <h1 className="max-w-[864px] text-left text-[32px] font-semibold leading-[36px] font-heading md:text-[42px] md:leading-[48px] lg:text-[52px] lg:leading-[60px]">
              The email platform that sends through{" "}
              <a
                className="text-orange-500 underline decoration-orange-500/30 underline-offset-4 hover:decoration-orange-500/60 transition-colors"
                href="/docs/quickstart/email"
              >
                your AWS.
              </a>
            </h1>

            {/* Subheadline */}
            <p className="mt-4 max-w-[520px] text-left text-[16px] leading-[24px] text-foreground/70 md:text-[18px] md:leading-[26px] lg:text-[20px] lg:leading-[28px]">
              One command deploys SES, event tracking, and analytics to your AWS
              account. Ship transactional email from your app — or your agent —
              at{" "}
              <strong className="text-foreground/90">
                $0.10 per 1,000 emails.
              </strong>
            </p>

            {/* Founder credibility */}
            <div className="mt-4 flex items-center gap-2.5">
              <Image
                alt="Jarod, founder of Wraps"
                className="shrink-0 rounded-full"
                height={36}
                src="/team/jarod-medium-smile.webp"
                width={36}
              />
              <a
                className="text-left text-[15px] leading-[22px] text-foreground/50 underline underline-offset-2 hover:text-foreground md:text-[16px]"
                href="https://x.com/stewartjarod"
                rel="noopener noreferrer"
                target="_blank"
              >
                Built by an ex-SendGrid engineer
              </a>
            </div>

            {/* CTA - client component for tracking */}
            <HeroAnimatedCTA />
          </div>

          {/* Right column — terminal */}
          <div className="hidden lg:block lg:flex-1">
            <HeroTerminal />
          </div>
        </div>
      </div>
    </section>
  );
}
