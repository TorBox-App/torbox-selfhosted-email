"use client";

import {
  FileText,
  Headphones,
  Mail,
  MessageSquare,
  Package,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { IconName, UseCase } from "../data";

const iconMap: Record<IconName, typeof Mail> = {
  Mail,
  Headphones,
  Package,
  FileText,
  Users,
  MessageSquare,
  Cloud: Mail, // fallback
  HardDrive: Mail, // fallback
  Code2: Mail, // fallback
  Zap: Mail, // fallback
  Database: Mail, // fallback
};

export function UseCasesCarousel({ useCases }: { useCases: UseCase[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const handleScroll = () => {
      const scrollLeft = scrollContainer.scrollLeft;
      const cardWidth = scrollContainer.offsetWidth * 0.7;
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.min(index, useCases.length - 1));
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [useCases.length]);

  const scrollToIndex = (index: number) => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const cards = scrollContainer.querySelectorAll("[data-card]");
    const card = cards[index] as HTMLElement;
    if (card) {
      card.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  };

  return (
    <>
      {/* Horizontal scroll container */}
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:-mx-6 sm:gap-6 sm:px-6 lg:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
        ref={scrollRef}
      >
        {useCases.map((useCase, index) => {
          const Icon = iconMap[useCase.iconName];
          return (
            <div
              className={cn(
                "w-[85vw] max-w-md shrink-0 snap-center rounded-2xl border-2 bg-background transition-all duration-300 sm:w-[70vw] lg:w-[400px]",
                useCase.borderColor,
                activeIndex === index && "shadow-lg"
              )}
              data-card
              key={useCase.id}
            >
              {/* Card header */}
              <div className={cn("border-b p-6", useCase.bgColor)}>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      useCase.bgColor
                    )}
                  >
                    <Icon className={cn("size-5", useCase.color)} />
                  </div>
                  <h3 className={cn("font-bold text-lg", useCase.color)}>
                    {useCase.title}
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  {useCase.description}
                </p>
              </div>

              {/* Code snippet */}
              <div className="overflow-hidden bg-[#0a0a0a] p-4">
                <pre className="overflow-x-auto text-xs">
                  <code className="text-green-400">{useCase.code}</code>
                </pre>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="mt-6 flex justify-center gap-2">
        {useCases.map((useCase, index) => (
          <button
            aria-label={`Go to ${useCase.title}`}
            className={cn(
              "size-2 rounded-full transition-all",
              activeIndex === index
                ? "w-6 bg-cyan-500"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            key={useCase.id}
            onClick={() => scrollToIndex(index)}
            type="button"
          />
        ))}
      </div>
    </>
  );
}
