"use client";

import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UsageBannerData = {
  threshold: "normal" | "warning" | "critical" | "exceeded";
  warning: string | null;
  action: "upgrade" | "view_usage" | null;
};

type UsageBannerProps = {
  usage: UsageBannerData | undefined;
  upgradeHref: string;
};

const bgColors = {
  warning:
    "bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800",
  critical: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800",
  exceeded: "bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-700",
};

const textColors = {
  warning: "text-amber-800 dark:text-amber-200",
  critical: "text-red-800 dark:text-red-200",
  exceeded: "text-red-900 dark:text-red-100",
};

const iconColors = {
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
  exceeded: "text-red-700 dark:text-red-300",
};

export function UsageBanner({ usage, upgradeHref }: UsageBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!usage || usage.threshold === "normal") {
    return null;
  }

  if (usage.threshold === "warning" && dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b px-4 py-2",
        bgColors[usage.threshold as keyof typeof bgColors]
      )}
      role="alert"
    >
      <div
        className={cn(
          "flex items-center gap-2",
          textColors[usage.threshold as keyof typeof textColors]
        )}
      >
        <AlertTriangle
          className={cn(
            "h-4 w-4 shrink-0",
            iconColors[usage.threshold as keyof typeof iconColors]
          )}
        />
        <p className="text-sm">{usage.warning}</p>
      </div>
      <div className="flex items-center gap-2">
        {usage.action === "upgrade" && (
          <Button asChild size="sm" variant="outline">
            <Link href={upgradeHref}>Upgrade Plan</Link>
          </Button>
        )}
        {usage.threshold === "warning" && (
          <Button
            aria-label="Dismiss warning"
            className="h-8 w-8 p-0"
            onClick={() => setDismissed(true)}
            size="sm"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
