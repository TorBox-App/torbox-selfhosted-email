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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import type { InboundEmailListItem } from "../types";

const areaChartConfig = {
  count: {
    label: "Received",
    theme: {
      light: "oklch(0.45 0.12 200)",
      dark: "oklch(0.65 0.12 200)",
    },
  },
} satisfies ChartConfig;

const barChartConfig = {
  count: {
    label: "Count",
    theme: {
      light: "oklch(0.50 0.12 280)",
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

// Extract just the email address from "Name <email>" format
function extractEmail(toField: string): string {
  const match = toField.match(/<([^>]+)>/);
  return match ? match[1] : toField;
}

type InboundAnalyticsProps = {
  emails: InboundEmailListItem[];
};

export function InboundAnalytics({ emails }: InboundAnalyticsProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const days = timeRange === "30d" ? 30 : 7;

  // Compute analytics from the emails data
  const analytics = React.useMemo(() => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Filter emails within the time range
    const filteredEmails = emails.filter(
      (e) => new Date(e.receivedAt) >= startDate
    );

    // Count totals
    const totalReceived = filteredEmails.length;
    const withAttachments = filteredEmails.filter(
      (e) => e.hasAttachments
    ).length;
    const spamCount = filteredEmails.filter(
      (e) => e.spamVerdict === "FAIL"
    ).length;
    const cleanCount = filteredEmails.filter(
      (e) => e.spamVerdict === "PASS" && e.virusVerdict === "PASS"
    ).length;

    // Group by date for chart
    const dateMap = new Map<string, number>();
    for (const email of filteredEmails) {
      const dateStr = new Date(email.receivedAt).toISOString().split("T")[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }

    // Fill in missing dates
    const dailyData: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      dailyData.push({
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
      });
    }

    // Count by recipient address
    const recipientMap = new Map<string, number>();
    for (const email of filteredEmails) {
      for (const to of email.to) {
        const addr = extractEmail(to);
        recipientMap.set(addr, (recipientMap.get(addr) || 0) + 1);
      }
    }

    // Get top 5 recipients
    const topRecipients = Array.from(recipientMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([address, count]) => ({ address, count }));

    return {
      totalReceived,
      withAttachments,
      spamCount,
      cleanCount,
      dailyData,
      topRecipients,
    };
  }, [emails, days]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Inbound Activity</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Emails received through your inbound infrastructure
          </span>
          <span className="@[540px]/card:hidden">Received emails</span>
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
        <div className="space-y-4">
          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 @[640px]/card:grid-cols-2">
            {/* Received Over Time Chart */}
            <div className="min-w-0">
              <div className="mb-2 font-medium text-muted-foreground text-sm">
                Received Over Time
              </div>
              {analytics.dailyData.every((d) => d.count === 0) ? (
                <div className="flex h-[160px] items-center justify-center text-muted-foreground text-sm">
                  No emails received in this period
                </div>
              ) : (
                <ChartContainer
                  className="aspect-auto h-[160px] w-full"
                  config={areaChartConfig}
                >
                  <AreaChart data={analytics.dailyData}>
                    <defs>
                      <linearGradient
                        id="fillInbound"
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
                      tickFormatter={createYAxisFormatter(analytics.dailyData)}
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
                      fill="url(#fillInbound)"
                      stroke="var(--color-count)"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>

            {/* Top Recipients Bar Chart */}
            <div className="min-w-0">
              <div className="mb-2 font-medium text-muted-foreground text-sm">
                Top Recipients
              </div>
              {analytics.topRecipients.length === 0 ? (
                <div className="flex h-[160px] items-center justify-center text-muted-foreground text-sm">
                  No emails in this period
                </div>
              ) : (
                <ChartContainer
                  className="aspect-auto h-[160px] w-full"
                  config={barChartConfig}
                >
                  <BarChart data={analytics.topRecipients} layout="vertical">
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      axisLine={false}
                      tickFormatter={createYAxisFormatter(
                        analytics.topRecipients
                      )}
                      tickLine={false}
                      tickMargin={8}
                      type="number"
                    />
                    <YAxis
                      axisLine={false}
                      dataKey="address"
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
                {analytics.totalReceived.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs">
                Received ({timeRange === "30d" ? "30d" : "7d"})
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg tabular-nums">
                {analytics.cleanCount.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs">Clean</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg tabular-nums">
                {analytics.spamCount}
              </div>
              <div className="text-muted-foreground text-xs">Spam</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
