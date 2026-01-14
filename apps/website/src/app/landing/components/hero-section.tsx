"use client";

import { ArrowRight, Star } from "lucide-react";
import { AsciinemaPlayer } from "@/components/asciinema-player";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WordRotate } from "@/components/ui/word-rotate";
import { assetUrl } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        {/* Dot pattern overlay using reusable component */}
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <div className="mb-8 flex justify-center gap-2">
            <a href="/cli">
              <Badge
                className="border-green-500/50 bg-green-500/10 px-3 py-1.5 text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-400"
                variant="outline"
              >
                Free CLI + SDK
              </Badge>
            </a>
            <a href="/platform">
              <Badge
                className="border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-orange-700 transition-colors hover:bg-orange-500/20 dark:text-orange-400"
                variant="outline"
              >
                Platform from $10/mo
              </Badge>
            </a>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            <span className="flex flex-col items-center justify-center sm:flex-row sm:gap-3">
              <span className="flex flex-row items-center justify-center gap-2">
                <span>AWS</span>
                <WordRotate
                  className="text-orange-500"
                  duration={3000}
                  words={["Email", "CDN", "SMS"]}
                />
              </span>
              <span>simplified.</span>
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            One command deploys production-ready infrastructure to your AWS
            account. Use Wraps' TypeScript SDK or AWS's. You own everything.
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <code className="rounded-lg border bg-muted/50 px-6 py-3 font-mono text-base sm:text-lg">
              npx @wraps.dev/cli email init
            </code>
            <div className="flex gap-4">
              <Button
                asChild
                className="cursor-pointer bg-orange-500 text-base hover:bg-orange-600"
                size="lg"
              >
                <a href="/docs/quickstart">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                className="cursor-pointer text-base"
                size="lg"
                variant="outline"
              >
                <a
                  href="https://github.com/wraps-team/wraps"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Star className="mr-2 h-4 w-4" />
                  Star on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Terminal Demo */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="group relative">
            {/* Top background glow effect */}
            <div className="-translate-x-1/2 absolute top-0 left-1/2 mx-auto h-16 w-[70%] transform rounded-full bg-orange-500/10 blur-2xl lg:h-32" />

            {/* Terminal */}
            <div className="relative overflow-hidden rounded-xl border-2 shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500" />
                  <div className="size-3 rounded-full bg-yellow-500" />
                  <div className="size-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 font-medium text-muted-foreground text-xs">
                  terminal — wraps email init
                </span>
              </div>
              {/* Asciinema Player */}
              <div className="bg-[#121314]">
                <AsciinemaPlayer
                  cols={100}
                  fit="width"
                  idleTimeLimit={1}
                  loop={true}
                  rows={30}
                  speed={1.2}
                  src={assetUrl("demos/email-init.cast")}
                  terminalFontSize="13px"
                />
              </div>
            </div>

            {/* Bottom fade effect */}
            <div className="absolute bottom-0 left-0 h-12 w-full rounded-b-xl bg-linear-to-b from-background/0 via-background/20 to-background/60 lg:h-16" />
          </div>
        </div>
      </div>
    </section>
  );
}
