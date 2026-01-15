"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

type FadeInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  once?: boolean;
};

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  direction = "up",
  distance = 24,
  once = true,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-100px" });

  const directionOffset = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };

  return (
    <motion.div
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, ...directionOffset[direction] }
      }
      className={className}
      initial={{ opacity: 0, ...directionOffset[direction] }}
      ref={ref}
      transition={{
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </motion.div>
  );
}

type StaggerContainerProps = {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
};

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  once = true,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-100px" });

  return (
    <motion.div
      animate={isInView ? "visible" : "hidden"}
      className={className}
      initial="hidden"
      ref={ref}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
};

export function StaggerItem({
  children,
  className,
  direction = "up",
  distance = 24,
}: StaggerItemProps) {
  const directionOffset = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, ...directionOffset[direction] },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: {
            duration: 0.5,
            ease: [0.21, 0.47, 0.32, 0.98],
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

type ScaleInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
};

export function ScaleIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  once = true,
}: ScaleInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-100px" });

  return (
    <motion.div
      animate={
        isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }
      }
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      ref={ref}
      transition={{
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </motion.div>
  );
}

// Animated counter for numbers
type CounterProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
};

export function Counter({
  value,
  prefix = "",
  suffix = "",
  className,
  duration = 2,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.span
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      className={className}
      initial={{ opacity: 0 }}
      ref={ref}
    >
      {prefix}
      <motion.span
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {isInView ? (
          <motion.span
            animate={{ opacity: 1 }}
            initial={{ opacity: 1 }}
            transition={{ duration }}
          >
            {value}
          </motion.span>
        ) : (
          0
        )}
      </motion.span>
      {suffix}
    </motion.span>
  );
}

// Animated gradient line/divider
export function GradientDivider({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      animate={isInView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
      className={`h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent ${className}`}
      initial={{ scaleX: 0, opacity: 0 }}
      ref={ref}
      transition={{ duration: 1, ease: "easeOut" }}
    />
  );
}

// Pulse animation for emphasis
export function Pulse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.02, 1],
      }}
      className={className}
      transition={{
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}
