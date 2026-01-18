"use client";

import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./animations";

export function CTASection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <FadeIn>
          <p className="mb-6 text-2xl font-medium tracking-tight sm:text-3xl">
            Infrastructure You Own.{" "}
            <span className="text-orange-500">Forever.</span>
          </p>

          <p className="mb-8 text-muted-foreground">
            Deploy to your AWS in one command. No vendor lock-in. No markup.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="cursor-pointer bg-orange-500 hover:bg-orange-600"
              size="lg"
            >
              <a href="/docs/quickstart">Get Started Free</a>
            </Button>
            <Button
              asChild
              className="group cursor-pointer"
              size="lg"
              variant="outline"
            >
              <a
                href="https://github.com/wraps-team/wraps"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Github aria-hidden="true" className="me-2 size-4" />
                View on GitHub
                <ArrowRight aria-hidden="true" className="ms-2 size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
