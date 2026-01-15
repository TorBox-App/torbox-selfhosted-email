"use client";

import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useEventUsage } from "@/hooks/use-event-usage";
import { cn } from "@/lib/utils";

type EventUsageBannerProps = {
  orgSlug: string;
};

/**
 * Event usage warning banner
 *
 * Shows at different thresholds:
 * - 80% (warning): Yellow banner, dismissible
 * - 100% (critical): Red banner, not dismissible, upgrade button
 * - 125% (exceeded): Dark red banner, hard block message
 */
export function EventUsageBanner({ orgSlug }: EventUsageBannerProps) {
  const { data: usage } = useEventUsage(orgSlug);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if no data, normal usage, or dismissed (only for warning level)
  if (!usage || usage.threshold === "normal") {
    return null;
  }

  // Warning level can be dismissed
  if (usage.threshold === "warning" && dismissed) {
    return null;
  }

  const bgColors = {
    warning:
      "bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800",
    critical:
      "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800",
    exceeded:
      "bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-700",
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
            <Link href={`/${orgSlug}/settings/billing`}>Upgrade Plan</Link>
          </Button>
        )}
        {usage.threshold === "warning" && (
          <Button
            className="h-8 w-8 p-0"
            onClick={() => setDismissed(true)}
            size="sm"
            variant="ghost"
            aria-label="Dismiss warning"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
