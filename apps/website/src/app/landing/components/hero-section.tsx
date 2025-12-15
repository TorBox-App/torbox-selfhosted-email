"use client";

import { ArrowRight, Star } from "lucide-react";
import { AsciinemaPlayer } from "@/components/asciinema-player";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <div className="mb-8 flex justify-center">
            <Badge className="border-foreground px-4 py-2" variant="outline">
              <Star className="mr-2 h-3 w-3 fill-current" />
              Open Source • Zero Stored Credentials
              <ArrowRight className="ml-2 h-3 w-3" />
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            Production-ready Email.
            <br />
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              One command.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            AWS SES configuration, domain verification, bounce and complaint
            tracking — deployed to your account in 30 seconds. Your
            infrastructure, your data, our tooling.
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <code className="rounded-lg border bg-muted/50 px-6 py-3 font-mono text-base sm:text-lg">
              npx @wraps.dev/cli email init
            </code>
            <div className="flex gap-4">
              <Button asChild className="cursor-pointer text-base" size="lg">
                <a href="/docs/quickstart">
                  Get Started
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
            <div className="-translate-x-1/2 absolute top-0 left-1/2 mx-auto h-32 w-[80%] transform rounded-full bg-primary/30 blur-3xl lg:h-48" />

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
