import { Badge } from "@wraps/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import { Activity, MessageSquare, Phone, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

type SMSMetricsData = {
  metrics: {
    sends: Array<{ timestamp: number; value: number }>;
    deliveries: Array<{ timestamp: number; value: number }>;
    failures: Array<{ timestamp: number; value: number }>;
    optOuts: Array<{ timestamp: number; value: number }>;
  };
  quota: {
    spendLimitMonthly: number;
    spendLimitDaily: number;
    spentThisMonth: number;
  };
  phoneNumber?: {
    number: string;
    type: string;
    status: string;
    throughput: string;
  };
  timestamp: number;
};

export function SMSMetrics() {
  const [dateRange, setDateRange] = useState("7");
  const [data, setData] = useState<SMSMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch metrics data from API
  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        setError(null);

        // Get token from sessionStorage or URL params
        let token = sessionStorage.getItem("wraps-auth-token");

        if (!token) {
          const params = new URLSearchParams(window.location.search);
          token = params.get("token");

          // Store token for future use
          if (token) {
            sessionStorage.setItem("wraps-auth-token", token);
          }
        }

        if (!token) {
          throw new Error(
            "Authentication token not found. Please use the URL provided by 'wraps console' command."
          );
        }

        // Calculate time range
        const daysAgo = Number.parseInt(dateRange, 10);
        const startTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
        const endTime = Date.now();

        const response = await fetch(
          `/api/sms/metrics?startTime=${startTime}&endTime=${endTime}&token=${token}`
        );

        if (!response.ok) {
          let errorMessage = "Failed to fetch SMS metrics";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (_e) {
            errorMessage = `${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const metricsData = await response.json();
        setData(metricsData);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching SMS metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [dateRange]);

  if (error) {
    return (
      <>
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">SMS Metrics</h1>
          <p className="mt-2 text-muted-foreground">
            View detailed metrics and analytics for your SMS messaging
          </p>
        </div>

        <div className="mt-4 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">SMS Metrics</h1>
          <p className="mt-2 text-muted-foreground">
            View detailed metrics and analytics for your SMS messaging
          </p>
        </div>

        <div className="mt-4 flex h-[400px] items-center justify-center text-muted-foreground">
          Loading metrics...
        </div>
      </>
    );
  }

  // Calculate summary stats
  const totalSends =
    data.metrics.sends.reduce((sum, point) => sum + point.value, 0) || 0;
  const totalDeliveries =
    data.metrics.deliveries.reduce((sum, point) => sum + point.value, 0) || 0;
  const totalFailures =
    data.metrics.failures.reduce((sum, point) => sum + point.value, 0) || 0;
  const totalOptOuts =
    data.metrics.optOuts.reduce((sum, point) => sum + point.value, 0) || 0;
  const deliveryRate =
    totalSends > 0 ? (totalDeliveries / totalSends) * 100 : 0;
  const failureRate = totalSends > 0 ? (totalFailures / totalSends) * 100 : 0;

  const stats = [
    {
      title: "Messages Sent",
      value: totalSends.toLocaleString(),
      description: `${dateRange === "1" ? "Last 24 hours" : `Last ${dateRange} days`}`,
      icon: MessageSquare,
    },
    {
      title: "Delivery Rate",
      value: `${deliveryRate.toFixed(1)}%`,
      description: `${totalDeliveries.toLocaleString()} delivered`,
      icon: TrendingUp,
    },
    {
      title: "Failure Rate",
      value: `${failureRate.toFixed(1)}%`,
      description: `${totalFailures.toLocaleString()} failed`,
      icon: Activity,
    },
    {
      title: "Opt Outs",
      value: totalOptOuts.toLocaleString(),
      description: "Recipients unsubscribed",
      icon: Phone,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">SMS Metrics</h1>
          <p className="mt-2 text-muted-foreground">
            View detailed metrics and analytics for your SMS messaging
          </p>
        </div>

        <Select onValueChange={setDateRange} value={dateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="15">Last 15 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stat.value}</div>
              <p className="text-muted-foreground text-xs">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Phone Number Info */}
      {data.phoneNumber && (
        <Card>
          <CardHeader>
            <CardTitle>Phone Number</CardTitle>
            <CardDescription>Your SMS sending number</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Number</span>
              <span className="font-mono text-sm">
                {data.phoneNumber.number}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Type</span>
              <Badge variant="outline">{data.phoneNumber.type}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Status</span>
              <Badge
                variant={
                  data.phoneNumber.status === "ACTIVE" ? "default" : "secondary"
                }
              >
                {data.phoneNumber.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Throughput</span>
              <span className="text-muted-foreground text-sm">
                {data.phoneNumber.throughput}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spend Limits */}
      {data.quota && (
        <Card>
          <CardHeader>
            <CardTitle>Spend Limits</CardTitle>
            <CardDescription>Your AWS SMS spending limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Monthly Spend</span>
                <span className="font-medium">
                  ${data.quota.spentThisMonth.toFixed(2)} / $
                  {data.quota.spendLimitMonthly.toFixed(2)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min((data.quota.spentThisMonth / data.quota.spendLimitMonthly) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Daily Limit</span>
              <span className="text-muted-foreground text-sm">
                ${data.quota.spendLimitDaily.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Metrics Summary</CardTitle>
          <CardDescription>
            Detailed breakdown of your SMS performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Total Messages Sent</span>
            <Badge variant="outline">{totalSends.toLocaleString()}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Successfully Delivered</span>
            <Badge variant="default">{totalDeliveries.toLocaleString()}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Failed</span>
            <Badge variant="destructive">
              {totalFailures.toLocaleString()}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Opt Outs</span>
            <Badge variant="secondary">{totalOptOuts.toLocaleString()}</Badge>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
