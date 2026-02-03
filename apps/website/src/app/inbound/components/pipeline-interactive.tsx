"use client";

import {
  ArrowRight,
  Cloud,
  Code2,
  Database,
  HardDrive,
  Mail,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { IconName, PipelineStep } from "../data";

const iconMap: Record<IconName, typeof Mail> = {
  Mail,
  Cloud,
  HardDrive,
  Code2,
  Zap,
  Database,
  Headphones: Mail, // fallback
  Package: Mail, // fallback
  FileText: Mail, // fallback
  Users: Mail, // fallback
  MessageSquare: Mail, // fallback
};

function AnimatedArrow({
  isActive,
  delay,
}: {
  isActive: boolean;
  delay: number;
}) {
  return (
    <div className="relative flex items-center justify-center px-1 sm:px-2">
      <ArrowRight
        className={cn(
          "size-4 text-muted-foreground/50 transition-all duration-300 sm:size-5",
          isActive && "text-cyan-500"
        )}
        style={{ transitionDelay: `${delay}ms` }}
      />
      {isActive && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ animationDelay: `${delay}ms` }}
        >
          <div className="size-1.5 animate-ping rounded-full bg-cyan-500" />
        </div>
      )}
    </div>
  );
}

export function PipelineInteractive({ steps }: { steps: PipelineStep[] }) {
  const [activeStep, setActiveStep] = useState(-1);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const animateSteps = () => {
      let step = 0;
      const interval = setInterval(() => {
        setActiveStep(step);
        step += 1;
        if (step > steps.length) {
          step = 0;
          setActiveStep(-1);
          setTimeout(() => {
            setActiveStep(0);
          }, 1000);
        }
      }, 600);

      return interval;
    };

    const interval = animateSteps();
    return () => clearInterval(interval);
  }, [isVisible, steps.length]);

  const selectedInfo = selectedStep
    ? steps.find((s) => s.id === selectedStep)
    : null;

  return (
    <div ref={sectionRef}>
      {/* Pipeline visualization */}
      <div className="mb-8 overflow-x-auto pb-4">
        <div className="flex min-w-max items-center justify-center gap-0 py-4 sm:gap-1">
          {steps.map((step, index) => {
            const Icon = iconMap[step.iconName];
            const isActive = activeStep >= index;
            const isCurrent = activeStep === index;

            return (
              <div className="flex items-center" key={step.id}>
                <button
                  className={cn(
                    "group relative flex flex-col items-center transition-all duration-300",
                    selectedStep === step.id && "scale-105"
                  )}
                  onClick={() =>
                    setSelectedStep(selectedStep === step.id ? null : step.id)
                  }
                  type="button"
                >
                  <div
                    className={cn(
                      "relative flex size-12 items-center justify-center rounded-xl border-2 transition-all duration-300 sm:size-14",
                      step.bgColor,
                      step.borderColor,
                      isActive && "shadow-lg",
                      isCurrent && "scale-110 ring-2 ring-cyan-500/50",
                      selectedStep === step.id &&
                        "ring-2 ring-cyan-500 ring-offset-2 ring-offset-background"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-5 transition-all duration-300 sm:size-6",
                        step.color,
                        !isActive && "opacity-40"
                      )}
                    />

                    {isCurrent && (
                      <div
                        className={cn(
                          "absolute inset-0 animate-ping rounded-xl opacity-30",
                          step.bgColor
                        )}
                      />
                    )}
                  </div>

                  <span
                    className={cn(
                      "mt-2 font-medium text-xs transition-all duration-300 sm:text-sm",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </button>

                {index < steps.length - 1 && (
                  <AnimatedArrow
                    delay={index * 100}
                    isActive={activeStep > index}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected step detail panel */}
      <div
        className={cn(
          "mx-auto max-w-md overflow-hidden rounded-xl border transition-all duration-300",
          selectedInfo
            ? `opacity-100 ${selectedInfo.borderColor} ${selectedInfo.bgColor}`
            : "border-border bg-muted/30 opacity-70"
        )}
      >
        <div className="p-6 text-center">
          {selectedInfo ? (
            <>
              {(() => {
                const SelectedIcon = iconMap[selectedInfo.iconName];
                return (
                  <SelectedIcon
                    className={cn("mx-auto mb-3 size-8", selectedInfo.color)}
                  />
                );
              })()}
              <h3 className="mb-2 font-semibold text-lg">
                {selectedInfo.label}
              </h3>
              <p className="text-muted-foreground">
                {selectedInfo.description}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Click a step to see details</p>
          )}
        </div>
      </div>
    </div>
  );
}
