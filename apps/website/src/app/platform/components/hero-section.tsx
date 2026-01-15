"use client";

import { ArrowRight, LayoutDashboard } from "lucide-react";
import { motion } from "motion/react";
import { DotPattern } from "@/components/dot-pattern";
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
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex justify-center"
            initial={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Badge
              className="border-orange-500/30 bg-orange-500/10 px-4 py-2 text-orange-600 dark:text-orange-400"
              variant="outline"
            >
              <LayoutDashboard className="mr-2 size-4" />
              Wraps Platform
            </Badge>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span>From first message to</span>{" "}
            <span className="inline-block bg-linear-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              full automation.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Start with email today. Add SMS, push, and automation as you grow.
          </motion.p>

          {/* CTA */}
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
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
          </motion.div>
        </div>

        {/* Journey Preview - Visual roadmap */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-16 max-w-xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3 text-muted-foreground text-sm">
            <a
              className="transition-colors hover:text-orange-500"
              href="#templates"
            >
              <span className="font-medium text-orange-500">1.</span> Build
            </a>
            <span className="text-border">—</span>
            <a
              className="transition-colors hover:text-orange-500"
              href="#broadcasts"
            >
              <span className="font-medium">2.</span> Send
            </a>
            <span className="text-border">—</span>
            <a
              className="transition-colors hover:text-orange-500"
              href="#automations"
            >
              <span className="font-medium">3.</span> Automate
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
