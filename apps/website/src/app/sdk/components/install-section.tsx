"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

const packages = [
  {
    name: "@wraps.dev/email",
    description: "Send email through SES",
  },
  {
    name: "@wraps.dev/sms",
    description: "Send SMS through AWS",
  },
  {
    name: "@wraps.dev/client",
    description: "Platform API, workflows, events",
  },
];

export function SdkInstallSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <section className="py-16" ref={ref}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {packages.map((pkg, i) => (
            <motion.div
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              className="rounded-lg border bg-card p-4 text-center"
              initial={{ opacity: 0, y: 15 }}
              key={pkg.name}
              transition={{ duration: 0.3, delay: i * 0.1 }}
            >
              <code className="font-mono text-orange-500 text-sm">
                {pkg.name}
              </code>
              <p className="mt-1 text-muted-foreground text-xs">
                {pkg.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
