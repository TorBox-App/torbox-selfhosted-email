"use client";

import {
  Box,
  KeyRound,
  Layers,
  Lock,
  Package,
  Zap,
} from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const features = [
  {
    icon: Lock,
    title: "Your AWS, Your Data",
    description:
      "SDKs call AWS APIs directly in your account. No data passes through our servers.",
  },
  {
    icon: Package,
    title: "TypeScript-First",
    description:
      "Strict types, autocomplete, and compile-time validation. Ship with confidence.",
  },
  {
    icon: KeyRound,
    title: "Flexible Auth",
    description:
      "AWS credential chain, OIDC federation (Vercel, GitHub Actions), or explicit credentials.",
  },
  {
    icon: Layers,
    title: "React Email",
    description:
      "Build templates with React components. Renders correctly across every email client.",
  },
  {
    icon: Zap,
    title: "Batch Operations",
    description:
      "Send to 100 recipients, track multiple events, or manage contacts in bulk with single calls.",
  },
  {
    icon: Box,
    title: "Zero Lock-In",
    description:
      "Thin wrappers around AWS services. Eject anytime — your SES templates and infrastructure stay.",
  },
];

export function SdkFeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      className="relative bg-stone-100/50 py-16 dark:bg-white/[0.06]"
      ref={ref}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="mb-2 font-semibold text-xl">Built for production</h3>
          <p className="text-muted-foreground text-sm">
            Ship emails and SMS with the same rigor as your application code
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                className="flex items-start gap-3 rounded-lg border bg-background/50 p-4"
                key={feature.title}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                  <Icon className="size-4 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
