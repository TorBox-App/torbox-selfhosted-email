import { useCallback, useEffect, useRef, useState } from "react";
import {
  discoverLogGroups,
  fetchRecentLogs,
  type LiveTailSession,
  type LogEntry,
  type LogGroup,
  startLiveTail,
} from "../lib/cloudwatch";

const MAX_LOG_BUFFER = 1000;
const BACKFILL_MINUTES = 5;

interface UseLogStreamResult {
  logs: LogEntry[];
  logGroups: LogGroup[];
  selectedGroups: string[];
  streaming: boolean;
  loading: boolean;
  error: string | null;
  filterPattern: string;
  setFilterPattern: (pattern: string) => void;
  toggleGroup: (name: string) => void;
  selectAllGroups: () => void;
  startStream: () => void;
  stopStream: () => void;
  clearLogs: () => void;
}

export function useLogStream(region: string): UseLogStreamResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logGroups, setLogGroups] = useState<LogGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState("");
  const sessionRef = useRef<LiveTailSession | null>(null);
  const mountedRef = useRef(true);

  // Discover log groups on mount
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function discover() {
      try {
        const groups = await discoverLogGroups(region);
        if (cancelled) return;
        setLogGroups(groups);
        // Auto-select all discovered groups
        setSelectedGroups(groups.map((g) => g.name));
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to discover log groups"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    discover();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [region]);

  const appendLogs = useCallback((entries: LogEntry[]) => {
    setLogs((prev) => {
      const merged = [...prev, ...entries];
      if (merged.length > MAX_LOG_BUFFER) {
        return merged.slice(merged.length - MAX_LOG_BUFFER);
      }
      return merged;
    });
  }, []);

  const startStream = useCallback(async () => {
    if (selectedGroups.length === 0) return;

    // Stop existing session
    if (sessionRef.current) {
      sessionRef.current.abort();
      sessionRef.current = null;
    }

    setStreaming(true);
    setError(null);

    // Resolve ARNs for selected groups (StartLiveTail requires ARNs)
    const selectedArns = logGroups
      .filter((g) => selectedGroups.includes(g.name))
      .map((g) => g.arn.replace(/:?\*$/, ""));

    if (selectedArns.length === 0) {
      setError("No log group ARNs found");
      setStreaming(false);
      return;
    }

    // Backfill recent logs before starting live stream
    try {
      const backfillStart = Date.now() - BACKFILL_MINUTES * 60 * 1000;
      const backfillResults = await Promise.all(
        selectedGroups.map((group) =>
          fetchRecentLogs(
            region,
            group,
            backfillStart,
            filterPattern || undefined
          )
        )
      );
      const allRecent = backfillResults
        .flat()
        .sort((a, b) => a.timestamp - b.timestamp);
      if (mountedRef.current && allRecent.length > 0) {
        appendLogs(allRecent);
      }
    } catch {
      // Backfill is best-effort
    }

    // Start live tail with ARNs
    try {
      const session = startLiveTail(
        region,
        selectedArns,
        filterPattern || undefined
      );
      sessionRef.current = session;

      // Consume the async iterable in background
      (async () => {
        try {
          for await (const batch of session.stream) {
            if (!mountedRef.current) break;
            appendLogs(batch);
          }
          // Stream ended naturally (timeout after 3h, or server closed)
          if (mountedRef.current) {
            setError("Stream ended — press s to restart");
            setStreaming(false);
          }
        } catch (err: unknown) {
          if (!mountedRef.current) return;
          const errName = err instanceof Error ? err.name : "";
          const message = err instanceof Error ? err.message : "Stream error";
          // AbortError is expected when user stops the stream
          if (errName === "AbortError" || message.includes("abort")) {
            // User-initiated stop, no error to show
            setStreaming(false);
          } else {
            setError(message);
            setStreaming(false);
          }
        }
      })();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to start live tail"
      );
      setStreaming(false);
    }
  }, [selectedGroups, logGroups, region, filterPattern, appendLogs]);

  const stopStream = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.abort();
      sessionRef.current = null;
    }
    setStreaming(false);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleGroup = useCallback((name: string) => {
    setSelectedGroups((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  }, []);

  const selectAllGroups = useCallback(() => {
    setSelectedGroups(logGroups.map((g) => g.name));
  }, [logGroups]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      mountedRef.current = false;
      if (sessionRef.current) {
        sessionRef.current.abort();
        sessionRef.current = null;
      }
    },
    []
  );

  return {
    logs,
    logGroups,
    selectedGroups,
    streaming,
    loading,
    error,
    filterPattern,
    setFilterPattern,
    toggleGroup,
    selectAllGroups,
    startStream,
    stopStream,
    clearLogs,
  };
}
