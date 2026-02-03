"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  type EventAnalytics as EventAnalyticsData,
  getEventAnalytics,
} from "@/actions/events";
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

const areaChartConfig = {
  count: {
    label: "Events",
    theme: {
      light: "oklch(0.45 0.15 250)", // Blue
      dark: "oklch(0.65 0.15 250)",
    },
  },
} satisfies ChartConfig;

const barChartConfig = {
  count: {
    label: "Count",
    theme: {
      light: "oklch(0.50 0.12 280)", // Purple
      dark: "oklch(0.70 0.12 280)",
    },
  },
} satisfies ChartConfig;

function createYAxisFormatter(data: Array<{ count: number }>) {
  const maxValue = Math.max(...data.map((d) => d.count || 0));

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

type EventAnalyticsProps = {
  organizationId: string;
};

export function EventAnalytics({ organizationId }: EventAnalyticsProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");
  const [analytics, setAnalytics] = React.useState<EventAnalyticsData | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  React.useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);
      const days = timeRange === "30d" ? 30 : 7;
      const result = await getEventAnalytics(organizationId, days);
      if (result.success) {
        setAnalytics(result.analytics);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    }
    fetchAnalytics();
  }, [organizationId, timeRange]);

  const dailyData = analytics?.dailyEvents || [];
  const topEventsData = analytics?.topEventNames || [];

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Event Activity</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Custom events tracked from your application
          </span>
          <span className="@[540px]/card:hidden">Event tracking</span>
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
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-6 @[640px]/card:grid-cols-2">
              <Skeleton className="h-[180px] w-full" />
              <Skeleton className="h-[180px] w-full" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
            Failed to load analytics
          </div>
        ) : (
          <div className="space-y-4">
            {/* Charts Row */}
            <div className="grid grid-cols-1 gap-6 @[640px]/card:grid-cols-2">
              {/* Events Over Time Chart */}
              <div className="min-w-0">
                <div className="mb-2 font-medium text-muted-foreground text-sm">
                  Events Over Time
                </div>
                {dailyData.length === 0 ||
                dailyData.every((d) => d.count === 0) ? (
                  <div className="flex h-[160px] items-center justify-center text-muted-foreground text-sm">
                    No events in this period
                  </div>
                ) : (
                  <ChartContainer
                    className="aspect-auto h-[160px] w-full"
                    config={areaChartConfig}
                  >
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient
                          id="fillEvents"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--color-count)"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--color-count)"
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
                        tickFormatter={createYAxisFormatter(dailyData)}
                        tickLine={false}
                        tickMargin={8}
                        width={40}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            indicator="line"
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
                      <Area
                        dataKey="count"
                        fill="url(#fillEvents)"
                        stroke="var(--color-count)"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </div>

              {/* Top Events Bar Chart */}
              <div className="min-w-0">
                <div className="mb-2 font-medium text-muted-foreground text-sm">
                  Top Events
                </div>
                {topEventsData.length === 0 ? (
                  <div className="flex h-[180px] items-center justify-center text-muted-foreground text-sm">
                    No events in this period
                  </div>
                ) : (
                  <ChartContainer
                    className="aspect-auto h-[180px] w-full"
                    config={barChartConfig}
                  >
                    <BarChart data={topEventsData} layout="vertical">
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis
                        axisLine={false}
                        tickFormatter={createYAxisFormatter(topEventsData)}
                        tickLine={false}
                        tickMargin={8}
                        type="number"
                      />
                      <YAxis
                        axisLine={false}
                        dataKey="name"
                        interval={0}
                        tickLine={false}
                        tickMargin={8}
                        type="category"
                        width={140}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent indicator="dot" />}
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--color-count)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted/30 p-3">
              <div className="text-center">
                <div className="font-semibold text-lg tabular-nums">
                  {analytics?.eventsThisPeriod.toLocaleString()}
                </div>
                <div className="text-muted-foreground text-xs">
                  Events ({timeRange === "30d" ? "30d" : "7d"})
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg tabular-nums">
                  {analytics?.activeContacts.toLocaleString()}
                </div>
                <div className="text-muted-foreground text-xs">
                  Active Contacts
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg tabular-nums">
                  {analytics?.avgEventsPerContact}
                </div>
                <div className="text-muted-foreground text-xs">
                  Avg per Contact
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
