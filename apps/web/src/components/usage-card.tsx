"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { Progress } from "@wraps/ui/components/ui/progress";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type UsageData = {
  current: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  threshold: "normal" | "warning" | "critical" | "exceeded";
};

type UsageCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  usage: UsageData | undefined;
  isLoading: boolean;
  upgradeHref: string;
  className?: string;
  /**
   * Optional right-hand slot in the header. The overview passes the org's plan
   * badge here; the billing page deliberately does not, because the plan is
   * already the subject of that whole page.
   */
  action?: React.ReactNode;
};

export function UsageCard({
  icon: Icon,
  title,
  description,
  usage,
  isLoading,
  upgradeHref,
  className,
  action,
}: UsageCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription>Loading...</CardDescription>
          {action && <CardAction className="self-center">{action}</CardAction>}
        </CardHeader>
      </Card>
    );
  }

  if (!usage) {
    return null;
  }

  const isUnlimited = usage.limit === -1;
  const displayPercent = isUnlimited ? 0 : Math.min(usage.percentUsed, 100);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction className="self-center">{action}</CardAction>}
      </CardHeader>
      <CardContent className="space-y-3">
        {isUnlimited ? (
          <p className="text-sm text-muted-foreground">Unlimited</p>
        ) : (
          <>
            <p className="font-semibold text-lg tabular-nums">
              {usage.current.toLocaleString()}
              <span className="font-normal text-muted-foreground text-sm">
                {" / "}
                {usage.limit.toLocaleString()}
              </span>
            </p>
            <Progress
              className="h-2"
              indicatorClassName={
                usage.threshold === "warning"
                  ? "bg-warning"
                  : usage.threshold === "critical" ||
                      usage.threshold === "exceeded"
                    ? "bg-destructive"
                    : "bg-primary"
              }
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
                <Link href={upgradeHref}>Upgrade Plan</Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
