"use client";

import { Mail } from "lucide-react";
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
import { useMessageUsage } from "@/hooks/use-message-usage";
import { cn } from "@/lib/utils";

type MessageUsageCardProps = {
  orgSlug: string;
  className?: string;
};

/**
 * Message usage display card with progress bar
 *
 * Shows current message usage against plan limit with visual progress indicator.
 * Used in billing page and dashboard.
 */
export function MessageUsageCard({
  orgSlug,
  className,
}: MessageUsageCardProps) {
  const { data: usage, isLoading } = useMessageUsage(orgSlug);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Message Usage</CardTitle>
          </div>
          <CardDescription>Loading…</CardDescription>
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
            <Mail className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Message Usage</CardTitle>
          </div>
          {!isUnlimited && (
            <span className="text-sm text-muted-foreground">
              {usage.current.toLocaleString()} / {usage.limit.toLocaleString()}
            </span>
          )}
        </div>
        <CardDescription>Emails + SMS this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isUnlimited ? (
          <p className="text-sm text-muted-foreground">Unlimited messages</p>
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
