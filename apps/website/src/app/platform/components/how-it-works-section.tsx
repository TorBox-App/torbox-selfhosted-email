"use client";

import { CloudUpload, Sparkles, UserPlus } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const items = [
  {
    icon: UserPlus,
    title: "Sign up free",
    description: "No credit card required.",
  },
  {
    icon: CloudUpload,
    title: "Connect your AWS",
    description: "One-click CloudFormation. You own the infrastructure.",
  },
  {
    icon: Sparkles,
    title: "Build with AI",
    description: "Templates and workflows, no code required.",
  },
];

export function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <section className="py-16" ref={ref}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 15 }}
              key={item.title}
              transition={{ duration: 0.3, delay: i * 0.1 }}
            >
              <item.icon className="mb-3 size-5 text-orange-500" />
              <h3 className="mb-1 font-semibold text-sm">{item.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
