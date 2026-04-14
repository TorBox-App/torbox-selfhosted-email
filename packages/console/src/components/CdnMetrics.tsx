import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wraps/ui/components/ui/alert";
import { Button } from "@wraps/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import { Progress } from "@wraps/ui/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import { Skeleton } from "@wraps/ui/components/ui/skeleton";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Globe,
  HardDrive,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Storage metrics from API
 */
type CdnMetrics = {
  summary: {
    totalSize: number;
    fileCount: number;
    bandwidth: {
      today: number;
      thisMonth: number;
    };
    requests: {
      today: number;
      thisMonth: number;
    };
  };
  usage: Array<{
    date: string;
    size: number;
    files: number;
  }>;
  bandwidth: Array<{
    date: string;
    bytes: number;
    requests: number;
  }>;
  topFiles: Array<{
    key: string;
    requests: number;
    bandwidth: number;
  }>;
};

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format number with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Summary stat card
 */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl">{value}</div>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs">{description}</p>
          {trend !== undefined && trend !== 0 && (
            <span
              className={`flex items-center text-xs ${trend > 0 ? "text-green-500" : "text-red-500"}`}
            >
              <TrendingUp
                className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`}
              />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Storage usage chart
 */
function UsageChart({
  data,
}: {
  data: Array<{ date: string; size: number; files: number }>;
}) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    size: d.size / (1024 * 1024 * 1024), // Convert to GB
    files: d.files,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Usage</CardTitle>
        <CardDescription>Storage size and file count over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer height={300} width="100%">
          <LineChart data={chartData}>
            <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
            <XAxis
              className="text-xs"
              dataKey="date"
              stroke="currentColor"
              tick={{ fill: "currentColor" }}
            />
            <YAxis
              className="text-xs"
              stroke="currentColor"
              tick={{ fill: "currentColor" }}
              tickFormatter={(v) => `${v} GB`}
              yAxisId="left"
            />
            <YAxis
              className="text-xs"
              orientation="right"
              stroke="currentColor"
              tick={{ fill: "currentColor" }}
              yAxisId="right"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              formatter={(value: number, name: string) => [
                name === "size" ? `${value.toFixed(2)} GB` : value,
                name === "size" ? "Storage" : "Files",
              ]}
            />
            <Legend />
            <Line
              dataKey="size"
              dot={false}
              name="Storage (GB)"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              type="monotone"
              yAxisId="left"
            />
            <Line
              dataKey="files"
              dot={false}
              name="File Count"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              type="monotone"
              yAxisId="right"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Bandwidth chart
 */
function BandwidthChart({
  data,
}: {
  data: Array<{ date: string; bytes: number; requests: number }>;
}) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    bandwidth: d.bytes / (1024 * 1024), // Convert to MB
    requests: d.requests,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>CDN Traffic</CardTitle>
        <CardDescription>Bandwidth and requests over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer height={300} width="100%">
          <BarChart data={chartData}>
            <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
            <XAxis
              className="text-xs"
              dataKey="date"
              stroke="currentColor"
              tick={{ fill: "currentColor" }}
            />
            <YAxis
              className="text-xs"
              stroke="currentColor"
              tick={{ fill: "currentColor" }}
              tickFormatter={(v) => `${v} MB`}
              yAxisId="left"
            />
            <YAxis
              className="text-xs"
              orientation="right"
              stroke="currentColor"
              tick={{ fill: "currentColor" }}
              tickFormatter={(v) => formatNumber(v)}
              yAxisId="right"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              formatter={(value: number, name: string) => [
                name === "bandwidth"
                  ? `${value.toFixed(1)} MB`
                  : formatNumber(value),
                name === "bandwidth" ? "Bandwidth" : "Requests",
              ]}
            />
            <Legend />
            <Bar
              dataKey="bandwidth"
              fill="hsl(var(--primary))"
              name="Bandwidth (MB)"
              radius={[4, 4, 0, 0]}
              yAxisId="left"
            />
            <Bar
              dataKey="requests"
              fill="hsl(var(--chart-3))"
              name="Requests"
              radius={[4, 4, 0, 0]}
              yAxisId="right"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Top files table
 */
function TopFilesCard({
  files,
}: {
  files: Array<{ key: string; requests: number; bandwidth: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Files</CardTitle>
        <CardDescription>Most requested files this month</CardDescription>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file, i) => {
              const fileName = file.key.split("/").pop() || file.key;
              const maxRequests = Math.max(...files.map((f) => f.requests));
              const percentage = (file.requests / maxRequests) * 100;

              return (
                <div key={file.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span className="max-w-[200px] truncate font-medium">
                        {fileName}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatNumber(file.requests)} requests
                    </span>
                  </div>
                  <Progress className="h-2" value={percentage} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton
 */
function MetricsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * No storage setup message
 */
function NoStorageSetup() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <HardDrive className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
      <h2 className="mb-2 font-semibold text-xl">No Storage Configured</h2>
      <p className="mb-6 max-w-md text-center text-muted-foreground">
        Storage infrastructure has not been deployed yet. Run{" "}
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
          wraps storage init
        </code>{" "}
        to get started.
      </p>
    </div>
  );
}

/**
 * Storage Metrics Component
 */
export function CdnMetrics() {
  const [metrics, setMetrics] = React.useState<CdnMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [timeRange, setTimeRange] = React.useState("7d");

  const fetchMetrics = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = sessionStorage.getItem("wraps-auth-token");
      const response = await fetch(
        `/api/cdn/metrics?token=${token}&range=${timeRange}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setMetrics(null);
          return;
        }
        throw new Error("Failed to fetch storage metrics");
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  React.useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return <MetricsSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!metrics) {
    return <NoStorageSetup />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Storage Metrics</h1>
          <p className="text-muted-foreground">
            Monitor your storage usage and CDN traffic
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={setTimeRange} value={timeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchMetrics} size="sm" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          description={`${formatNumber(metrics.summary.fileCount)} files`}
          icon={Database}
          title="Storage Used"
          value={formatBytes(metrics.summary.totalSize)}
        />
        <StatCard
          description={`${formatBytes(metrics.summary.bandwidth.thisMonth)} this month`}
          icon={ArrowDownToLine}
          title="Bandwidth Today"
          value={formatBytes(metrics.summary.bandwidth.today)}
        />
        <StatCard
          description={`${formatNumber(metrics.summary.requests.thisMonth)} this month`}
          icon={Globe}
          title="Requests Today"
          value={formatNumber(metrics.summary.requests.today)}
        />
        <StatCard
          description="Files in storage"
          icon={ArrowUpFromLine}
          title="Total Files"
          value={formatNumber(metrics.summary.fileCount)}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UsageChart data={metrics.usage} />
        <BandwidthChart data={metrics.bandwidth} />
      </div>

      {/* Top Files */}
      <TopFilesCard files={metrics.topFiles} />
    </div>
  );
}
