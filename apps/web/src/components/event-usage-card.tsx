"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEventUsage } from "@/hooks/use-event-usage";
import { cn } from "@/lib/utils";

type EventUsageCardProps = {
  orgSlug: string;
  className?: string;
};

/**
 * Event usage display card with progress bar
 *
 * Shows current event usage against plan limit with visual progress indicator.
 * Used in billing page and dashboard.
 */
export function EventUsageCard({ orgSlug, className }: EventUsageCardProps) {
  const { data: usage, isLoading } = useEventUsage(orgSlug);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Event Usage</CardTitle>
          </div>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!usage) {
    return null;
  }

  // Progress bar color based on threshold
  const progressColors = {
    normal: "[&>[data-slot=progress-indicator]]:bg-primary",
    warning: "[&>[data-slot=progress-indicator]]:bg-amber-500",
    critical: "[&>[data-slot=progress-indicator]]:bg-red-500",
    exceeded: "[&>[data-slot=progress-indicator]]:bg-red-600",
  };

  const isUnlimited = usage.limit === -1;
  const displayPercent = isUnlimited ? 0 : Math.min(usage.percentUsed, 100);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Event Usage</CardTitle>
          </div>
          {!isUnlimited && (
            <span className="text-sm text-muted-foreground">
              {usage.current.toLocaleString()} / {usage.limit.toLocaleString()}
            </span>
          )}
        </div>
        <CardDescription>Tracked events this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isUnlimited ? (
          <p className="text-sm text-muted-foreground">Unlimited events</p>
        ) : (
          <>
            <Progress
              className={cn(
                "h-2",
                progressColors[usage.threshold as keyof typeof progressColors]
              )}
              value={displayPercent}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {usage.remaining.toLocaleString()} remaining
              </span>
              <span className="text-muted-foreground">
                {usage.percentUsed}% used
              </span>
            </div>
            {usage.threshold !== "normal" && (
              <Button asChild className="w-full" size="sm" variant="outline">
                <Link href={`/${orgSlug}/settings/billing`}>Upgrade Plan</Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
