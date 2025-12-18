"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionCardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: {
    title: string;
    description: string;
    ctaText: string;
    ctaLink: string;
  };
  className?: string;
}

export function SectionCard({
  children,
  header,
  footer,
  className = "",
}: SectionCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-muted/20 ${className}`}
    >
      {/* Optional header */}
      {header && (
        <div className="border-b bg-background/50 px-6 py-4">{header}</div>
      )}

      {/* Main content */}
      <div className="p-6 md:p-8">{children}</div>

      {/* Optional footer with CTA */}
      {footer && (
        <div className="flex flex-col gap-4 border-t bg-foreground px-6 py-5 text-background md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
          <div className="max-w-xl">
            <h3 className="mb-1 font-semibold text-base md:text-lg">
              {footer.title}
            </h3>
            <p className="text-background/70 text-sm">{footer.description}</p>
          </div>
          <Button
            asChild
            className="w-full shrink-0 bg-background text-foreground hover:bg-background/90 md:w-auto"
            size="lg"
          >
            <a href={footer.ctaLink}>
              {footer.ctaText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

interface SectionWrapperProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  badge?: string;
  premium?: boolean;
  id?: string;
  className?: string;
}

export function SectionWrapper({
  children,
  title,
  description,
  badge,
  premium = false,
  id,
  className = "",
}: SectionWrapperProps) {
  return (
    <section className={`py-24 ${className}`} id={id}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          {badge && (
            <span
              className={`mb-4 inline-block rounded-full border px-3 py-1 font-medium text-xs ${
                premium
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {badge}
            </span>
          )}
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {children}
      </div>
    </section>
  );
}

interface IconBoxProps {
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
  size?: "sm" | "md" | "lg";
}

export function IconBox({
  icon: Icon,
  highlighted = false,
  size = "md",
}: IconBoxProps) {
  const sizeClasses = {
    sm: "size-9",
    md: "size-11",
    lg: "size-14",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <div
      className={`flex aspect-square items-center justify-center rounded-full border-2 bg-background transition-all ${sizeClasses[size]} ${
        highlighted
          ? "border-orange-500 bg-orange-500/5 text-orange-500"
          : "border-border text-muted-foreground"
      }`}
    >
      <Icon className={iconSizes[size]} />
    </div>
  );
}

interface FeatureItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  highlighted?: boolean;
}

export function FeatureItem({
  icon: Icon,
  title,
  description,
  highlighted = false,
}: FeatureItemProps) {
  return (
    <div className="flex items-start gap-4">
      <IconBox highlighted={highlighted} icon={Icon} />
      <div>
        <h3
          className={`font-semibold ${highlighted ? "text-orange-500" : "text-foreground"}`}
        >
          {title}
        </h3>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

interface TabBarProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex rounded-full border bg-background p-1">
        {tabs.map((tab) => (
          <button
            className={`rounded-full px-5 py-2 font-medium text-sm transition-all ${
              activeTab === tab.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
