import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useFocus } from "../../contexts/focus";
import { useLogStream } from "../../hooks/use-log-stream";
import type { LogEntry } from "../../lib/cloudwatch";

type MonitoringProps = {
  region: string;
  onBack: () => void;
};

type Panel = "logs" | "groups" | "filter";

const LEVEL_COLORS: Record<string, string> = {
  ERROR: "#FF4444",
  WARN: "#FFAA00",
  INFO: "#00AAFF",
  DEBUG: "#666666",
  START: "#444444",
  END: "#444444",
  REPORT: "#AA88FF",
};

const LEVEL_BADGES: Record<string, string> = {
  ERROR: "ERR",
  WARN: "WRN",
  INFO: "INF",
  DEBUG: "DBG",
  START: ">>>",
  END: "<<<",
  REPORT: "RPT",
};

const JSON_KEY_COLOR = "#00AAFF";
const JSON_STRING_COLOR = "#98C379";
const JSON_NUMBER_COLOR = "#D19A66";
const JSON_BOOL_COLOR = "#C678DD";
const JSON_NULL_COLOR = "#666666";

function detectLogLevel(message: string): string {
  if (message.startsWith("START RequestId")) {
    return "START";
  }
  if (message.startsWith("END RequestId")) {
    return "END";
  }
  if (message.startsWith("REPORT RequestId")) {
    return "REPORT";
  }
  const upper = message.toUpperCase();
  if (
    upper.includes("ERROR") ||
    upper.includes("[ERROR]") ||
    upper.includes('"level":"error"') ||
    upper.includes('"level":"ERROR"')
  ) {
    return "ERROR";
  }
  if (
    upper.includes("WARN") ||
    upper.includes("[WARN]") ||
    upper.includes('"level":"warn"') ||
    upper.includes('"level":"WARN"')
  ) {
    return "WARN";
  }
  if (
    upper.includes("DEBUG") ||
    upper.includes("[DEBUG]") ||
    upper.includes('"level":"debug"') ||
    upper.includes('"level":"DEBUG"')
  ) {
    return "DEBUG";
  }
  return "INFO";
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function shortenLogGroup(name: string): string {
  return name.replace("/aws/lambda/", "λ/");
}

function tryParseJson(message: string): Record<string, unknown> | null {
  // Lambda structured logging: line often starts with timestamp + requestId + level then JSON
  // Try the raw message first
  const trimmed = message.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // not JSON
    }
  }

  // Lambda PowerTools / structured format: "2024-01-01T00:00:00.000Z\tREQUEST_ID\tINFO\t{...}"
  const tabParts = trimmed.split("\t");
  if (tabParts.length >= 3) {
    const lastPart = tabParts.at(-1)?.trim();
    if (lastPart?.startsWith("{")) {
      try {
        return JSON.parse(lastPart) as Record<string, unknown>;
      } catch {
        // not JSON
      }
    }
  }

  return null;
}

type FormattedLine = {
  content: ReactNode;
  level: string;
};

function formatJsonValue(value: unknown): ReactNode[] {
  if (value === null || value === undefined) {
    return [
      <text fg={JSON_NULL_COLOR} key="null">
        null
      </text>,
    ];
  }
  if (typeof value === "string") {
    // Truncate long strings
    const display = value.length > 80 ? `${value.slice(0, 80)}…` : value;
    return [<text fg={JSON_STRING_COLOR} key="str">{`"${display}"`}</text>];
  }
  if (typeof value === "number") {
    return [
      <text fg={JSON_NUMBER_COLOR} key="num">
        {String(value)}
      </text>,
    ];
  }
  if (typeof value === "boolean") {
    return [
      <text fg={JSON_BOOL_COLOR} key="bool">
        {String(value)}
      </text>,
    ];
  }
  // Don't recursively expand nested objects/arrays inline — just stringify compactly
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [
        <text fg="#666666" key="arr-empty">
          {"[]"}
        </text>,
      ];
    }
    const compact = JSON.stringify(value);
    if (compact.length < 60) {
      return [
        <text fg="#AAAAAA" key="arr-compact">
          {compact}
        </text>,
      ];
    }
    return [
      <text fg="#AAAAAA" key="arr-trunc">
        {compact.slice(0, 60)}…
      </text>,
    ];
  }
  if (typeof value === "object") {
    const compact = JSON.stringify(value);
    if (compact.length < 60) {
      return [
        <text fg="#AAAAAA" key="obj-compact">
          {compact}
        </text>,
      ];
    }
    return [
      <text fg="#AAAAAA" key="obj-trunc">
        {compact.slice(0, 60)}…
      </text>,
    ];
  }
  return [
    <text fg="#AAAAAA" key="other">
      {String(value)}
    </text>,
  ];
}

/** Known fields to display first, in order */
const PRIORITY_KEYS = [
  "level",
  "message",
  "msg",
  "error",
  "err",
  "status",
  "statusCode",
  "method",
  "path",
  "duration",
  "requestId",
];

function formatLogEntry(entry: LogEntry, termWidth: number): FormattedLine[] {
  const level = detectLogLevel(entry.message);
  const badge = LEVEL_BADGES[level] ?? "INF";
  const badgeColor = LEVEL_COLORS[level] ?? "#AAAAAA";
  const time = formatTimestamp(entry.timestamp);

  // Lambda runtime lines — show compact, dimmed
  if (level === "START" || level === "END") {
    return [
      {
        level,
        content: (
          <box flexDirection="row">
            <text fg="#444444">{` ${time} `}</text>
            <text fg="#555555">{badge} </text>
            <text fg="#555555">{entry.message.slice(0, termWidth - 20)}</text>
          </box>
        ),
      },
    ];
  }

  // REPORT lines — extract key metrics
  if (level === "REPORT") {
    const duration = entry.message.match(/Duration: ([\d.]+) ms/);
    const memory = entry.message.match(/Max Memory Used: (\d+) MB/);
    const billed = entry.message.match(/Billed Duration: (\d+) ms/);
    return [
      {
        level,
        content: (
          <box flexDirection="row" gap={1}>
            <text fg="#444444">{` ${time} `}</text>
            <text fg="#AA88FF">{badge} </text>
            {duration && <text fg="#AAAAAA">{`${duration[1]}ms`}</text>}
            {billed && <text fg="#666666">{`(billed ${billed[1]}ms)`}</text>}
            {memory && <text fg="#666666">{`${memory[1]}MB`}</text>}
          </box>
        ),
      },
    ];
  }

  // Try JSON parsing
  const json = tryParseJson(entry.message);
  if (json) {
    const lines: FormattedLine[] = [];

    // Header line with level badge + message/msg if present
    const msg = (json.message ?? json.msg ?? "") as string;
    lines.push({
      level,
      content: (
        <box flexDirection="row">
          <text fg="#444444">{` ${time} `}</text>
          <text fg={badgeColor}>
            <b>{badge}</b>
          </text>
          <text> </text>
          {msg ? (
            <text fg="#FFFFFF">{String(msg).slice(0, termWidth - 25)}</text>
          ) : (
            <text fg="#888888">{"(no message)"}</text>
          )}
        </box>
      ),
    });

    // Render remaining key-value pairs
    const shownKeys = new Set(["message", "msg", "level", "timestamp", "time"]);
    const sortedKeys = [
      ...PRIORITY_KEYS.filter((k) => k in json && !shownKeys.has(k)),
      ...Object.keys(json).filter(
        (k) => !(PRIORITY_KEYS.includes(k) || shownKeys.has(k))
      ),
    ];

    for (const key of sortedKeys) {
      const value = json[key];
      const valueNodes = formatJsonValue(value);
      lines.push({
        level,
        content: (
          <box flexDirection="row" paddingLeft={10}>
            <text fg={JSON_KEY_COLOR}>{key}</text>
            <text fg="#666666">{": "}</text>
            {...valueNodes}
          </box>
        ),
      });
    }

    return lines;
  }

  // Plain text log — extract message after Lambda prefix if present
  let displayMsg = entry.message;
  const tabParts = displayMsg.split("\t");
  if (tabParts.length >= 4) {
    // Lambda format: "timestamp\trequestId\tLEVEL\tmessage"
    displayMsg = tabParts.slice(3).join("\t");
  } else if (tabParts.length === 3) {
    displayMsg = tabParts[2]!;
  }

  // Truncate to terminal width
  const maxMsg = Math.max(40, termWidth - 18);
  if (displayMsg.length > maxMsg) {
    displayMsg = `${displayMsg.slice(0, maxMsg)}…`;
  }

  return [
    {
      level,
      content: (
        <box flexDirection="row">
          <text fg="#444444">{` ${time} `}</text>
          <text fg={badgeColor}>
            <b>{badge}</b>
          </text>
          <text> </text>
          <text
            fg={
              level === "ERROR"
                ? "#FF6666"
                : level === "WARN"
                  ? "#FFCC00"
                  : "#DDDDDD"
            }
          >
            {displayMsg}
          </text>
        </box>
      ),
    },
  ];
}

export function Monitoring({ region, onBack }: MonitoringProps) {
  const { width, height } = useTerminalDimensions();
  const {
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
  } = useLogStream(region);

  const [panel, setPanel] = useState<Panel>("logs");
  const [paused, setPaused] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [groupCursor, setGroupCursor] = useState(0);
  const { inputActive, setInputActive } = useFocus();
  const pausedLogsRef = useRef<LogEntry[]>([]);

  useEffect(() => {
    if (paused) {
      pausedLogsRef.current = logs;
    }
  }, [paused, logs]);

  const displayLogs = paused ? pausedLogsRef.current : logs;

  // Pre-format all visible log entries into lines
  const allLines: FormattedLine[] = [];
  for (const entry of displayLogs) {
    allLines.push(...formatLogEntry(entry, width));
  }

  // Visible lines in the log area (shell header + status bar + divider + controls + shell footer ~ 8)
  const visibleLines = Math.max(5, height - 8);

  useEffect(() => {
    if (!paused) {
      const maxOffset = Math.max(0, allLines.length - visibleLines);
      setScrollOffset(maxOffset);
    }
  }, [visibleLines, paused]);

  useEffect(() => {
    setInputActive(panel === "filter");
    return () => setInputActive(false);
  }, [panel, setInputActive]);

  useKeyboard((key) => {
    if (panel === "filter") {
      if (key.name === "escape") {
        setPanel("logs");
      }
      if (key.name === "enter") {
        setPanel("logs");
        if (streaming) {
          stopStream();
          setTimeout(startStream, 100);
        }
      }
      return;
    }

    if (inputActive) {
      return;
    }

    if (key.name === "escape") {
      if (panel === "groups") {
        setPanel("logs");
      } else {
        stopStream();
        onBack();
      }
    }

    if (panel === "logs") {
      if (key.name === "space") {
        setPaused((p) => !p);
      }
      if (key.name === "s") {
        if (streaming) {
          stopStream();
        } else {
          startStream();
        }
      }
      if (key.name === "c") {
        clearLogs();
        setScrollOffset(0);
      }
      if (key.name === "g") {
        setPanel("groups");
      }
      if (key.name === "f") {
        setPanel("filter");
      }

      if (paused) {
        const maxOff = Math.max(0, allLines.length - visibleLines);
        if (key.name === "j" || key.name === "down") {
          setScrollOffset((o) => Math.min(o + 1, maxOff));
        }
        if (key.name === "k" || key.name === "up") {
          setScrollOffset((o) => Math.max(0, o - 1));
        }
        if (key.name === "pagedown" || key.name === "d") {
          setScrollOffset((o) => Math.min(o + visibleLines, maxOff));
        }
        if (key.name === "pageup" || key.name === "u") {
          setScrollOffset((o) => Math.max(0, o - visibleLines));
        }
      }
    }

    if (panel === "groups") {
      if (key.name === "j" || key.name === "down") {
        setGroupCursor((c) => Math.min(c + 1, logGroups.length - 1));
      }
      if (key.name === "k" || key.name === "up") {
        setGroupCursor((c) => Math.max(0, c - 1));
      }
      if (key.name === "space" || key.name === "enter") {
        const group = logGroups[groupCursor];
        if (group) {
          toggleGroup(group.name);
        }
      }
      if (key.name === "a") {
        selectAllGroups();
      }
    }
  });

  if (loading) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg="#888888">Discovering log groups...</text>
      </box>
    );
  }

  if (error && logGroups.length === 0) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg="#FF4444">
          <b>Error</b>
        </text>
        <text fg="#FF4444">{error}</text>
        <text> </text>
        <text fg="#888888">
          No CloudWatch log groups found with prefix /aws/lambda/wraps-
        </text>
        <text fg="#888888">
          Deploy email infrastructure first with `wraps email init`.
        </text>
      </box>
    );
  }

  if (panel === "groups") {
    return (
      <box flexDirection="column" padding={1} width="100%">
        <text fg="#00AAFF">
          <b>Log Groups</b>
        </text>
        <text fg="#444444">{"─".repeat(60)}</text>
        <text fg="#888888">
          Select which log groups to stream. Press space to toggle, a for all.
        </text>
        <text> </text>
        {logGroups.map((group, i) => {
          const selected = selectedGroups.includes(group.name);
          const cursor = i === groupCursor;
          return (
            <box flexDirection="row" gap={1} key={group.name}>
              <text fg={cursor ? "#00AAFF" : "#666666"}>
                {cursor ? ">" : " "}
              </text>
              <text fg={selected ? "#00FF00" : "#666666"}>
                {selected ? "[x]" : "[ ]"}
              </text>
              <text fg={cursor ? "#FFFFFF" : "#AAAAAA"}>
                {shortenLogGroup(group.name)}
              </text>
              {group.retentionDays && (
                <text fg="#666666">{`${group.retentionDays}d retention`}</text>
              )}
            </box>
          );
        })}
        <text> </text>
        <text fg="#666666">
          <b>space</b> Toggle <b>a</b> All <b>esc</b> Back
        </text>
      </box>
    );
  }

  if (panel === "filter") {
    return (
      <box flexDirection="column" padding={1} width="100%">
        <text fg="#00AAFF">
          <b>Filter Pattern</b>
        </text>
        <text fg="#444444">{"─".repeat(60)}</text>
        <text fg="#888888">
          CloudWatch filter pattern (e.g. "ERROR", "RequestId", or leave empty
          for all)
        </text>
        <box flexDirection="row" gap={1} paddingTop={1}>
          <text fg="#888888">Pattern:</text>
          <input
            backgroundColor="#1a1a1a"
            cursorColor="#00AAFF"
            focused={true}
            focusedBackgroundColor="#222222"
            onChange={setFilterPattern}
            placeholder="e.g. ERROR"
            placeholderColor="#555555"
            textColor="#FFFFFF"
            value={filterPattern}
            width={40}
          />
        </box>
        <text fg="#666666" paddingTop={1}>
          Press enter to apply, escape to cancel
        </text>
      </box>
    );
  }

  // Main logs panel
  const slicedLines = allLines.slice(scrollOffset, scrollOffset + visibleLines);

  return (
    <box flexDirection="column" height="100%" width="100%">
      {/* Status bar */}
      <box flexDirection="row" gap={2} paddingLeft={1}>
        <text fg={streaming ? "#00FF00" : "#FF4444"}>
          {streaming ? "● LIVE" : "○ STOPPED"}
        </text>
        {paused && <text fg="#FFAA00">PAUSED</text>}
        <text fg="#666666">{`${displayLogs.length} events`}</text>
        <text fg="#666666">{`${selectedGroups.length} groups`}</text>
        {filterPattern && (
          <text fg="#AA88FF">{`filter: "${filterPattern}"`}</text>
        )}
        {error && <text fg="#FF4444">{error}</text>}
      </box>
      <text fg="#333333">{` ${"─".repeat(Math.max(0, width - 2))}`}</text>

      {/* Log lines */}
      <box flexDirection="column" flexGrow={1}>
        {allLines.length === 0 ? (
          <box flexDirection="column" padding={1}>
            {streaming ? (
              <text fg="#888888">Waiting for log events...</text>
            ) : (
              <box flexDirection="column">
                <text fg="#888888">No logs to display.</text>
                <text fg="#888888">
                  Press <b>s</b> to start streaming.
                </text>
              </box>
            )}
          </box>
        ) : (
          slicedLines.map((line, i) => (
            <box key={`line-${scrollOffset + i}`}>{line.content}</box>
          ))
        )}
      </box>

      {/* Controls */}
      <box flexDirection="row" gap={3} paddingLeft={1}>
        <text fg="#666666">
          <b>s</b> {streaming ? "Stop" : "Start"}
          {"  "}
          <b>space</b> {paused ? "Resume" : "Pause"}
          {"  "}
          <b>f</b> Filter <b>g</b> Groups <b>c</b> Clear <b>esc</b> Back
        </text>
      </box>
    </box>
  );
}
