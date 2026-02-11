"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type StatCardProps = {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  trend?: "up" | "down";
  isLoading?: boolean;
};

export function StatCard({
  title,
  value,
  change,
  icon,
  trend = "up",
  isLoading,
}: StatCardProps) {
  const isPositive = (change ?? 0) >= 0;
  const trendColor =
    trend === "up"
      ? isPositive
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400"
      : isPositive
        ? "text-red-600 dark:text-red-400"
        : "text-green-600 dark:text-green-400";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="font-medium text-muted-foreground text-sm">{title}</p>
            {isLoading ? (
              <>
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <p className="font-bold text-3xl tracking-tight">{value}</p>
                {change !== undefined && (
                  <div className="flex items-center gap-1 text-sm">
                    {isPositive ? (
                      <ArrowUpIcon className={`h-4 w-4 ${trendColor}`} />
                    ) : (
                      <ArrowDownIcon className={`h-4 w-4 ${trendColor}`} />
                    )}
                    <span className={trendColor}>
                      {Math.abs(change).toFixed(1)}% vs last period
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
