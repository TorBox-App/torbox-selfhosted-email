"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type AnimatedElementProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "h1" | "p" | "span";
};

export function FadeInUp({
  children,
  className,
  delay = 0,
  as = "div",
}: AnimatedElementProps) {
  const Component = motion[as];

  return (
    <Component
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </Component>
  );
}

export function FadeInDown({
  children,
  className,
  delay = 0,
}: AnimatedElementProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}
