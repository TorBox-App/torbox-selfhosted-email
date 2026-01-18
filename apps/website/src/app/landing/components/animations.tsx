"use client";

import { motion } from "motion/react";
import { memo, useMemo } from "react";
import { useSharedInView } from "@/hooks/use-shared-in-view";

// Shared easing for consistent animations
const EASE = [0.21, 0.47, 0.32, 0.98] as const;

type FadeInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  once?: boolean;
};

export const FadeIn = memo(function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  direction = "up",
  distance = 24,
  once = true,
}: FadeInProps) {
  const { ref, hasBeenInView } = useSharedInView({ once, margin: "-100px" });

  const directionOffset = useMemo(
    () => ({
      up: { y: distance },
      down: { y: -distance },
      left: { x: distance },
      right: { x: -distance },
      none: {},
    }),
    [distance]
  );

  const initial = useMemo(
    () => ({ opacity: 0, ...directionOffset[direction] }),
    [directionOffset, direction]
  );

  const animate = useMemo(
    () =>
      hasBeenInView
        ? { opacity: 1, x: 0, y: 0 }
        : { opacity: 0, ...directionOffset[direction] },
    [hasBeenInView, directionOffset, direction]
  );

  const transition = useMemo(
    () => ({ duration, delay, ease: EASE }),
    [duration, delay]
  );

  return (
    <motion.div
      animate={animate}
      className={className}
      initial={initial}
      ref={ref}
      transition={transition}
    >
      {children}
    </motion.div>
  );
});

type StaggerContainerProps = {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
};

export const StaggerContainer = memo(function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  once = true,
}: StaggerContainerProps) {
  const { ref, hasBeenInView } = useSharedInView({ once, margin: "-100px" });

  const variants = useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }),
    [staggerDelay]
  );

  return (
    <motion.div
      animate={hasBeenInView ? "visible" : "hidden"}
      className={className}
      initial="hidden"
      ref={ref}
      variants={variants}
    >
      {children}
    </motion.div>
  );
});

type StaggerItemProps = {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
};

export const StaggerItem = memo(function StaggerItem({
  children,
  className,
  direction = "up",
  distance = 24,
}: StaggerItemProps) {
  const directionOffset = useMemo(
    () => ({
      up: { y: distance },
      down: { y: -distance },
      left: { x: distance },
      right: { x: -distance },
      none: {},
    }),
    [distance]
  );

  const variants = useMemo(
    () => ({
      hidden: { opacity: 0, ...directionOffset[direction] },
      visible: {
        opacity: 1,
        x: 0,
        y: 0,
        transition: {
          duration: 0.5,
          ease: EASE,
        },
      },
    }),
    [directionOffset, direction]
  );

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
});

type ScaleInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
};

export const ScaleIn = memo(function ScaleIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  once = true,
}: ScaleInProps) {
  const { ref, hasBeenInView } = useSharedInView({ once, margin: "-100px" });

  const initial = useMemo(() => ({ opacity: 0, scale: 0.95 }), []);

  const animate = useMemo(
    () =>
      hasBeenInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 },
    [hasBeenInView]
  );

  const transition = useMemo(
    () => ({ duration, delay, ease: EASE }),
    [duration, delay]
  );

  return (
    <motion.div
      animate={animate}
      className={className}
      initial={initial}
      ref={ref}
      transition={transition}
    >
      {children}
    </motion.div>
  );
});

// Animated counter for numbers
type CounterProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
};

export const Counter = memo(function Counter({
  value,
  prefix = "",
  suffix = "",
  className,
  duration = 2,
}: CounterProps) {
  const { ref, hasBeenInView } = useSharedInView({
    once: true,
    margin: "-100px",
  });

  const animate = useMemo(
    () => (hasBeenInView ? { opacity: 1 } : { opacity: 0 }),
    [hasBeenInView]
  );

  const transition = useMemo(() => ({ duration: 0.5 }), []);

  const innerTransition = useMemo(() => ({ duration }), [duration]);

  return (
    <motion.span
      animate={animate}
      className={className}
      initial={{ opacity: 0 }}
      ref={ref}
    >
      {prefix}
      <motion.span
        animate={animate}
        initial={{ opacity: 0 }}
        transition={transition}
      >
        {hasBeenInView ? (
          <motion.span
            animate={{ opacity: 1 }}
            initial={{ opacity: 1 }}
            transition={innerTransition}
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
});

// Animated gradient line/divider
export const GradientDivider = memo(function GradientDivider({
  className,
}: {
  className?: string;
}) {
  const { ref, hasBeenInView } = useSharedInView({
    once: true,
    margin: "-50px",
  });

  const animate = useMemo(
    () =>
      hasBeenInView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 },
    [hasBeenInView]
  );

  const transition = useMemo(
    () => ({ duration: 1, ease: "easeOut" as const }),
    []
  );

  return (
    <motion.div
      animate={animate}
      className={`h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent ${className}`}
      initial={{ scaleX: 0, opacity: 0 }}
      ref={ref}
      transition={transition}
    />
  );
});

// Pulse animation for emphasis
export const Pulse = memo(function Pulse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const animate = useMemo(() => ({ scale: [1, 1.02, 1] }), []);

  const transition = useMemo(
    () => ({
      duration: 2,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut" as const,
    }),
    []
  );

  return (
    <motion.div animate={animate} className={className} transition={transition}>
      {children}
    </motion.div>
  );
});
