"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id: string;
  title: string;
  markdown: string;
  level?: 2 | 3;
  className?: string;
};

export function SectionHeading({
  id,
  title,
  markdown,
  level = 2,
  className,
}: SectionHeadingProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const HeadingTag = level === 2 ? "h2" : "h3";
  const headingStyles =
    level === 2 ? "font-bold text-2xl" : "font-medium text-lg";

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <HeadingTag className={headingStyles} id={id}>
        {title}
      </HeadingTag>
      <button
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
          copied
            ? "border-green-500/30 bg-green-500/10 text-green-600"
            : "border-border bg-background text-foreground hover:cursor-auto hover:bg-muted/50 hover:text-foreground/90"
        )}
        onClick={handleCopy}
        title="Copy section for AI"
        type="button"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            <span>Copy for AI</span>
          </>
        )}
      </button>
    </div>
  );
}
