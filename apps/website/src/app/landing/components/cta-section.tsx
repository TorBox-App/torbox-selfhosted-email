"use client";

import { ArrowRight, Github, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border bg-muted/20">
          <div className="p-8 py-16 text-center md:p-16">
            <span className="mb-6 inline-block rounded-full border bg-background px-3 py-1 font-medium text-muted-foreground text-xs">
              Ready to Deploy
            </span>

            <h2 className="mb-6 font-bold text-4xl tracking-tight sm:text-5xl">
              AWS pricing.
              <br />
              <span className="text-orange-500">Modern DX.</span>
            </h2>

            <p className="mx-auto mb-8 max-w-2xl text-muted-foreground lg:text-lg">
              Get AWS pricing with the developer experience you deserve. Deploy
              in one command, own your infrastructure forever.
            </p>

            <div className="mb-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                className="cursor-pointer bg-orange-500 px-8 py-6 font-medium text-lg hover:bg-orange-600"
                size="lg"
              >
                <a href="/docs/quickstart">
                  <Rocket className="me-2 size-5" />
                  Get Started Free
                </a>
              </Button>
              <Button
                asChild
                className="group cursor-pointer px-8 py-6 font-medium text-lg"
                size="lg"
                variant="outline"
              >
                <a
                  href="https://github.com/wraps-team/wraps"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Github className="me-2 size-5" />
                  View on GitHub
                  <ArrowRight className="ms-2 size-4 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-green-500" />
                <span>Forever free local console</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-blue-500" />
                <span>Open source (AGPLv3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-orange-500" />
                <span>Zero vendor lock-in</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
