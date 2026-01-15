"use client";

import {
  Clock,
  GitBranch,
  MousePointerClick,
  Play,
  Sparkles,
  Zap,
} from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { assetUrl } from "@/lib/utils";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered",
    description: "Generate workflows from natural language prompts",
    badge: "AI",
  },
  {
    icon: Zap,
    title: "Event Triggers",
    description: "Start workflows from signups, purchases, or custom events",
  },
  {
    icon: Clock,
    title: "Wait Steps",
    description: "Add delays between actions — hours, days, or weeks",
  },
  {
    icon: GitBranch,
    title: "Conditions",
    description: "Branch based on contact properties or behavior",
  },
  {
    icon: MousePointerClick,
    title: "Actions",
    description: "Send emails, update contacts, trigger webhooks",
  },
];

export function DashboardAutomationsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      className="relative overflow-x-clip bg-stone-100/50 py-24 dark:bg-white/[0.06]"
      id="automations"
      ref={ref}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Chapter indicator */}
        <motion.div
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          className="mb-16 flex items-center gap-4"
          initial={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-orange-500 font-bold text-white">
            3
          </div>
          <div>
            <p className="font-medium text-orange-500 text-sm">Chapter Three</p>
            <h2 className="font-bold text-2xl tracking-tight sm:text-3xl">
              Automate Your Growth
            </h2>
          </div>
          <Badge
            className="ml-2 bg-blue-500/10 text-blue-600 dark:text-blue-400"
            variant="secondary"
          >
            <Play className="mr-1 size-3" />
            Coming Soon
          </Badge>
        </motion.div>

        {/* Split layout: Content left, screenshot right (flipped from Ch. 2) */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Content */}
          <motion.div
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            className="order-2 space-y-8 lg:order-1"
            initial={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-lg text-muted-foreground">
              Build automated email sequences triggered by events, time delays,
              or conditions. Visual workflow builder with AI assistance.
            </p>

            {/* Features as list */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  animate={
                    isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
                  }
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  key={feature.title}
                  transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                    <feature.icon className="size-4 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{feature.title}</span>
                      {feature.badge && (
                        <Badge
                          className="bg-orange-500/10 text-orange-600 text-xs dark:text-orange-400"
                          variant="secondary"
                        >
                          {feature.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Growth tier hint */}
            <motion.div
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4"
              initial={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <p className="text-sm">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  Growth ($149/mo):
                </span>{" "}
                <span className="text-muted-foreground">
                  Workflows, event tracking, and advanced segments
                </span>
              </p>
              <p className="mt-2 text-muted-foreground text-xs">
                Currently in development. Join the waitlist to get early access.
              </p>
            </motion.div>
          </motion.div>

          {/* Screenshot - overflows right */}
          <motion.div
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            className="group relative order-1 lg:order-2 lg:-mr-32 xl:-mr-48 2xl:-mr-64"
            initial={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Background glow */}
            <div className="absolute -inset-4 rounded-3xl bg-blue-500/10 blur-2xl opacity-50" />

            <div className="relative overflow-hidden rounded-2xl border-2 border-blue-500/20 bg-card shadow-2xl">
              {/* Light mode image */}
              <img
                alt="Workflow Builder - Light Mode"
                className="block w-full object-cover dark:hidden"
                decoding="async"
                loading="lazy"
                src={assetUrl("automations-builder-light.avif")}
              />
              {/* Dark mode image */}
              <img
                alt="Workflow Builder - Dark Mode"
                className="hidden w-full object-cover dark:block"
                decoding="async"
                loading="lazy"
                src={assetUrl("automations-builder-dark.avif")}
              />

              {/* Coming soon overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[1px]">
                <div className="rounded-full border border-blue-500/30 bg-background/90 px-4 py-2 shadow-lg">
                  <span className="flex items-center gap-2 font-medium text-blue-600 text-sm dark:text-blue-400">
                    <Play className="size-4" />
                    Preview — Coming Soon
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
