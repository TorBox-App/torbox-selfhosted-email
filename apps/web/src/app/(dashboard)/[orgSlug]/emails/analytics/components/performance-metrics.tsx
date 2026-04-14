"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { Progress } from "@wraps/ui/components/ui/progress";
import { Skeleton } from "@wraps/ui/components/ui/skeleton";
import { useAnalyticsOverview } from "../hooks/use-analytics";

type MetricRowProps = {
  label: string;
  value: number;
  total: number;
  percentage: number;
  color?: string;
};

function MetricRow({
  label,
  value,
  total,
  percentage,
  color = "bg-primary",
}: MetricRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="font-medium">
            {value.toLocaleString()} / {total.toLocaleString()}
          </span>
          <span className="text-muted-foreground text-xs">
            ({percentage.toFixed(1)}%)
          </span>
        </div>
      </div>
      <Progress className="h-2" indicatorClassName={color} value={percentage} />
    </div>
  );
}

export function PerformanceMetrics({ orgSlug }: { orgSlug: string }) {
  const { data, isLoading, error } = useAnalyticsOverview(orgSlug, 30);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div className="space-y-2" key={i}>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Failed to load performance metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  const effectiveSent = Math.max(
    0,
    data.totalSent - (data.totalRenderingFailures ?? 0)
  );

  const metrics = [
    {
      label: "Delivered",
      value: data.totalDelivered,
      total: effectiveSent,
      percentage: data.deliveryRate,
      color: "bg-green-500",
    },
    {
      label: "Bounced",
      value: data.totalBounced,
      total: effectiveSent,
      percentage: data.bounceRate,
      color: "bg-yellow-500",
    },
    {
      label: "Complaints",
      value: data.totalComplaints,
      total: effectiveSent,
      percentage: data.complaintRate,
      color: "bg-red-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {metrics.map((metric) => (
          <MetricRow key={metric.label} {...metric} />
        ))}
      </CardContent>
    </Card>
  );
}
