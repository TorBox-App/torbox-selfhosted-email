"use client";

import { CheckCircle, Clock, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BATCH_STATUS_COLORS, BATCH_STATUS_LABELS } from "@/lib/batch";

type CompactProgressProps = {
  status: string;
  totalRecipients: number;
  processedRecipients: number;
  startedAt: Date | null;
  completedAt: Date | null;
};

function formatDuration(
  startedAt: Date | null,
  completedAt: Date | null
): string {
  if (!startedAt) return "-";
  const end = completedAt ?? new Date();
  const diffMs = end.getTime() - new Date(startedAt).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ${diffSec % 60}s`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ${diffMin % 60}m`;
}

const isActive = (status: string) =>
  status === "processing" || status === "queued";

const isTerminal = (status: string) =>
  status === "completed" || status === "failed" || status === "cancelled";

export function CompactProgress({
  status,
  totalRecipients,
  processedRecipients,
  startedAt,
  completedAt,
}: CompactProgressProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autoRefresh, setAutoRefresh] = useState(isActive(status));

  const progress =
    totalRecipients === 0
      ? 0
      : Math.round((processedRecipients / totalRecipients) * 100);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    if (isTerminal(status)) setAutoRefresh(false);
  }, [status]);

  const statusIcon = {
    processing: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    completed: <CheckCircle className="mr-1 h-3 w-3" />,
    failed: <XCircle className="mr-1 h-3 w-3" />,
    queued: <Clock className="mr-1 h-3 w-3" />,
  }[status];

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Status badge + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge
            className={
              BATCH_STATUS_COLORS[status as keyof typeof BATCH_STATUS_COLORS]
            }
            variant="secondary"
          >
            {statusIcon}
            {BATCH_STATUS_LABELS[status as keyof typeof BATCH_STATUS_LABELS]}
          </Badge>

          {/* Timing info */}
          {startedAt && (
            <span className="text-muted-foreground text-sm">
              {formatDuration(startedAt, completedAt)}
            </span>
          )}

          {autoRefresh && (
            <span className="text-muted-foreground text-xs">
              Auto-refreshing...
            </span>
          )}
        </div>

        <Button
          aria-label="Refresh stats"
          disabled={isPending}
          onClick={refresh}
          size="sm"
          variant="ghost"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Row 2: Progress bar (only shown when active) */}
      {!isTerminal(status) && status !== "draft" && (
        <div className="space-y-1">
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>
              {processedRecipients.toLocaleString("en-US")} /{" "}
              {totalRecipients.toLocaleString("en-US")} processed
            </span>
            <span>{progress}%</span>
          </div>
          <Progress className="h-1.5" value={progress} />
        </div>
      )}
    </div>
  );
}
