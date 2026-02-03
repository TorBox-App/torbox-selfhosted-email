"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ContactAnalytics as ContactAnalyticsData,
  getContactAnalytics,
} from "@/actions/contacts";
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

const chartConfig = {
  count: {
    label: "New Contacts",
    theme: {
      light: "oklch(0.45 0.15 160)", // Green
      dark: "oklch(0.65 0.15 160)",
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

type ContactAnalyticsProps = {
  organizationId: string;
};

export function ContactAnalytics({ organizationId }: ContactAnalyticsProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");
  const [analytics, setAnalytics] = React.useState<ContactAnalyticsData | null>(
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
      const result = await getContactAnalytics(organizationId, days);
      if (result.success) {
        setAnalytics(result.analytics);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    }
    fetchAnalytics();
  }, [organizationId, timeRange]);

  const chartData = analytics?.dailyGrowth || [];

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Contact Growth</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            New contacts added over time
          </span>
          <span className="@[540px]/card:hidden">New contacts</span>
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
            <Skeleton className="h-[250px] w-full" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
            Failed to load analytics
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 @[540px]/card:grid-cols-[1fr_200px]">
            {/* Chart */}
            <div className="min-w-0">
              {chartData.length === 0 ||
              chartData.every((d) => d.count === 0) ? (
                <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                  No new contacts in this period
                </div>
              ) : (
                <ChartContainer
                  className="aspect-auto h-[250px] w-full"
                  config={chartConfig}
                >
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="fillCount"
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
                      tickFormatter={createYAxisFormatter(chartData)}
                      tickLine={false}
                      tickMargin={8}
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
                      fill="url(#fillCount)"
                      stroke="var(--color-count)"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>

            {/* Metrics */}
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Total Contacts
                </div>
                <div className="font-semibold text-2xl tabular-nums">
                  {analytics?.totalContacts.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  New This Period
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-2xl tabular-nums">
                    +{analytics?.newContactsThisPeriod.toLocaleString()}
                  </span>
                  {analytics && analytics.growthPercent !== 0 && (
                    <span
                      className={`text-sm ${
                        analytics.growthPercent > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {analytics.growthPercent > 0 ? "+" : ""}
                      {analytics.growthPercent}%
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">Engagement</div>
                <div className="flex items-baseline gap-3 text-sm">
                  <span>
                    <span className="font-medium">
                      {analytics?.avgOpenRate}%
                    </span>{" "}
                    <span className="text-muted-foreground">opens</span>
                  </span>
                  <span>
                    <span className="font-medium">
                      {analytics?.avgClickRate}%
                    </span>{" "}
                    <span className="text-muted-foreground">clicks</span>
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
