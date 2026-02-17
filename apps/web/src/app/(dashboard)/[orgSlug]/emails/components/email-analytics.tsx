"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useAnalyticsOverview,
  useEngagementData,
  useVolumeData,
} from "../analytics/hooks/use-analytics";

const chartConfig = {
  sent: {
    label: "Sent",
    theme: {
      light: "oklch(0.55 0.12 250)",
      dark: "oklch(0.70 0.12 250)",
    },
  },
  delivered: {
    label: "Delivered",
    theme: {
      light: "oklch(0.50 0.15 160)",
      dark: "oklch(0.65 0.15 160)",
    },
  },
  opened: {
    label: "Opened",
    theme: {
      light: "oklch(0.55 0.15 80)",
      dark: "oklch(0.70 0.15 80)",
    },
  },
  clicked: {
    label: "Clicked",
    theme: {
      light: "oklch(0.50 0.18 30)",
      dark: "oklch(0.65 0.18 30)",
    },
  },
} satisfies ChartConfig;

function createYAxisFormatter(maxValue: number) {
  if (maxValue >= 100_000) {
    return (value: number) => `${Math.round(value / 1000)}k`;
  }
  if (maxValue >= 10_000) {
    return (value: number) => `${(value / 1000).toFixed(1)}k`;
  }
  if (maxValue >= 1000) {
    return (value: number) => `${(value / 1000).toFixed(1)}k`;
  }
  if (maxValue >= 100) {
    return (value: number) => `${Math.round(value / 100) * 100}`;
  }
  if (maxValue >= 10) {
    return (value: number) => `${Math.round(value / 10) * 10}`;
  }
  return (value: number) => `${Math.round(value)}`;
}

type EmailAnalyticsProps = {
  orgSlug: string;
};

export function EmailAnalytics({ orgSlug }: EmailAnalyticsProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const days = timeRange === "30d" ? 30 : 7;
  const { data: volumeData, isLoading: volumeLoading } = useVolumeData(
    orgSlug,
    days
  );
  const { data: engagementData, isLoading: engagementLoading } =
    useEngagementData(orgSlug, days);
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(
    orgSlug,
    days
  );

  const isLoading = volumeLoading || overviewLoading || engagementLoading;

  // Merge volume and engagement data by date, estimate opens/clicks from rates
  const chartData = React.useMemo(() => {
    if (!volumeData) {
      return [];
    }

    // Build a lookup map for engagement data by date
    const engagementByDate = new Map(
      engagementData?.map((e) => [e.date, e]) ?? []
    );

    return volumeData.map((v) => {
      const engagement = engagementByDate.get(v.date);
      // Estimate opens and clicks from delivered count and rates
      const opened = engagement
        ? Math.round(v.delivered * (engagement.openRate / 100))
        : 0;
      const clicked = engagement
        ? Math.round(v.delivered * (engagement.clickRate / 100))
        : 0;

      return {
        ...v,
        opened,
        clicked,
      };
    });
  }, [volumeData, engagementData]);

  const maxValue = Math.max(
    ...chartData.map((d) => Math.max(d.sent || 0, d.delivered || 0))
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Email Activity</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Sending volume and engagement over time
          </span>
          <span className="@[540px]/card:hidden">Email volume</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            className="*:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex hidden"
            onValueChange={setTimeRange}
            type="single"
            value={timeRange}
            variant="outline"
          >
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select onValueChange={setTimeRange} value={timeRange}>
            <SelectTrigger
              aria-label="Select time range"
              className="flex @[767px]/card:hidden w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
            >
              <SelectValue placeholder="30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem className="rounded-lg" value="30d">
                30 days
              </SelectItem>
              <SelectItem className="rounded-lg" value="7d">
                7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-6 sm:pt-3">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 @[540px]/card:grid-cols-[1fr_200px]">
            <Skeleton className="h-[280px] w-full" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 @[540px]/card:grid-cols-[1fr_200px]">
            {/* Chart */}
            <div className="min-w-0">
              {chartData.length === 0 ||
              chartData.every((d) => d.sent === 0) ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  No emails sent in this period
                </div>
              ) : (
                <ChartContainer
                  className="aspect-auto h-[280px] w-full"
                  config={chartConfig}
                >
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="fillSent" x1="0" x2="0" y1="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="var(--color-sent)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--color-sent)"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                      <linearGradient
                        id="fillDelivered"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--color-delivered)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--color-delivered)"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="date"
                      minTickGap={32}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickFormatter={createYAxisFormatter(maxValue)}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) =>
                            new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          }
                        />
                      }
                    />
                    <Legend content={<ChartLegendContent />} />
                    <Area
                      dataKey="sent"
                      fill="url(#fillSent)"
                      stroke="var(--color-sent)"
                      strokeWidth={2}
                      type="monotone"
                    />
                    <Area
                      dataKey="delivered"
                      fill="url(#fillDelivered)"
                      stroke="var(--color-delivered)"
                      strokeWidth={2}
                      type="monotone"
                    />
                    <Area
                      dataKey="opened"
                      fill="transparent"
                      stroke="var(--color-opened)"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      type="monotone"
                    />
                    <Area
                      dataKey="clicked"
                      fill="transparent"
                      stroke="var(--color-clicked)"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      type="monotone"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>

            {/* Metrics */}
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">Sent</div>
                <div className="font-semibold text-2xl tabular-nums">
                  {overview?.totalSent.toLocaleString() ?? 0}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">Delivered</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-2xl tabular-nums">
                    {overview?.totalDelivered.toLocaleString() ?? 0}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    ({overview?.deliveryRate.toFixed(1) ?? 0}%)
                  </span>
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">Health</div>
                <div className="flex items-baseline gap-3 text-sm">
                  <span>
                    <span className="font-medium">
                      {overview?.bounceRate.toFixed(2) ?? 0}%
                    </span>{" "}
                    <span className="text-muted-foreground">bounces</span>
                  </span>
                  <span>
                    <span className="font-medium">
                      {overview?.complaintRate.toFixed(3) ?? 0}%
                    </span>{" "}
                    <span className="text-muted-foreground">complaints</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
