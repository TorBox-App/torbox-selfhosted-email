"use client";

import { DotPattern } from "@wraps/ui/components/dot-pattern";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DashboardHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-24 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 flex justify-center">
            <Badge
              className="border-orange-500/30 bg-orange-500/10 px-4 py-2 text-orange-600 dark:text-orange-400"
              variant="outline"
            >
              <LayoutDashboard className="mr-2 size-4" />
              Wraps Platform
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            <span>From first message to</span>{" "}
            <span className="inline-block bg-linear-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              full automation.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Start with email today. Add SMS, push, and automation as you grow.
          </p>

          {/* CTA */}
          <div>
            <Button
              asChild
              className="h-14 w-full bg-orange-500 px-8 text-base hover:bg-orange-600 sm:h-16 sm:w-auto sm:px-12 sm:text-lg"
              size="lg"
            >
              <a href="https://app.wraps.dev/auth?mode=signup">
                Get Started
                <ArrowRight className="ml-2 size-5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Journey Preview - Visual roadmap */}
        <div className="mx-auto mt-16 max-w-xl">
          <div className="flex items-center justify-center gap-3 text-muted-foreground text-sm">
            <motion.a
              animate={{ opacity: 1, y: 0 }}
              className="transition-colors hover:text-orange-500"
              href="#templates"
              initial={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <span className="font-medium text-orange-500">1.</span> Build
            </motion.a>
            <motion.span
              animate={{ opacity: 1 }}
              className="text-border"
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.45 }}
            >
              —
            </motion.span>
            <motion.a
              animate={{ opacity: 1, y: 0 }}
              className="transition-colors hover:text-orange-500"
              href="#broadcasts"
              initial={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <span className="font-medium">2.</span> Send
            </motion.a>
            <motion.span
              animate={{ opacity: 1 }}
              className="text-border"
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.65 }}
            >
              —
            </motion.span>
            <motion.a
              animate={{ opacity: 1, y: 0 }}
              className="transition-colors hover:text-orange-500"
              href="#automations"
              initial={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.7 }}
            >
              <span className="font-medium">3.</span> Automate
            </motion.a>
          </div>
        </div>
      </div>
    </section>
  );
}
