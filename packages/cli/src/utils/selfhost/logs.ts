import type { FilteredLogEvent } from "@aws-sdk/client-cloudwatch-logs";
import { errors, isAWSError } from "../shared/errors.js";

/**
 * Which part of the self-hosted platform a log group belongs to.
 *
 * `other` is deliberately kept rather than dropped: a new component added to
 * the SST stack should still show up in `wraps selfhost logs` (labelled by its
 * raw group name) instead of silently vanishing from the output.
 */
export type SelfhostLogSource = "api" | "web" | "workers" | "other";

export type SelfhostLogGroup = {
  name: string;
  arn: string;
  source: SelfhostLogSource;
};

export type SelfhostLogEntry = {
  timestamp: number;
  message: string;
  logStream: string;
  logGroup: string;
  source: SelfhostLogSource;
};

/**
 * The selfhost stack prefixes every Lambda log group identically
 * (`/aws/lambda/wraps-selfhost-production-<Logical>-<suffix>`), so one
 * DescribeLogGroups call covers all of them — no paginated ListFunctions
 * scan the way `api-url.ts` needs.
 */
export const SELFHOST_LOG_GROUP_PREFIX = "/aws/lambda/wraps-selfhost";

/**
 * StartLiveTail accepts at most 10 log groups per session (AWS hard limit).
 * The SST variant deploys ~7, so this only bites if the stack grows.
 */
const LIVE_TAIL_MAX_GROUPS = 10;

/**
 * How far back each poll re-reads. CloudWatch ingestion is not ordered — an
 * event written at T can become visible several seconds after a poll covering
 * T has already returned. Without the overlap those events are lost forever;
 * the overlap is what makes the eventId dedupe necessary rather than optional.
 */
const POLL_OVERLAP_MS = 15_000;

/** Cap on remembered event keys so a long tail session doesn't grow unbounded. */
const MAX_SEEN_KEYS = 5000;

/**
 * Server-side pre-filter for `--errors`. FilterLogEvents is not billed per byte
 * scanned (unlike Logs Insights), so this is only about payload size and
 * latency — it can afford to be generous and let `isErrorLine()` do the precise
 * work client-side.
 */
export const ERROR_FILTER_PATTERN =
  '?ERROR ?Error ?error ?FATAL ?fatal ?Exception ?exception ?Traceback ?"Task timed out" ?"UnhandledPromiseRejection" ?"Runtime."';

const ERROR_LEVELS = new Set(["error", "fatal", "critical"]);

/** Lambda's own lifecycle lines — noise unless you're profiling. */
const PLATFORM_LINE = /^(START|END|REPORT|INIT_START|INIT_REPORT|XRAY) /;

/**
 * Fallback for log lines that aren't structured JSON: the Next.js server, the
 * Lambda runtime's own crash output, and anything writing through `console`
 * under Lambda's text log format (`<ts>\t<reqId>\tERROR\t<msg>`).
 */
const ERROR_TEXT =
  /(^|\s)(ERROR|FATAL|CRITICAL)(\s|:|$)|Task timed out|UnhandledPromiseRejection|Unhandled Rejection|Runtime\.\w*Error|Traceback \(most recent call last\)/;

const LEVEL_TEXT = /(^|\s)(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL)(\s|:|$)/;

const SINCE_DURATION = /^(\d+)(s|m|h|d)$/i;

/** DescribeLogGroups returns ARNs ending in `:*`; StartLiveTail rejects those. */
const ARN_WILDCARD_SUFFIX = /:?\*$/;

const SOURCE_LABELS: Record<SelfhostLogSource, string> = {
  api: "api",
  web: "web",
  workers: "workers",
  other: "other",
};

export const SELFHOST_LOG_SOURCES = Object.keys(
  SOURCE_LABELS
) as SelfhostLogSource[];

/**
 * Map a log group name onto a source bucket.
 *
 * Matching is on substrings rather than full names because SST appends an
 * 8-character random suffix to every physical name — an exact match would work
 * for the Pulumi variant only.
 */
export function classifyLogGroup(logGroupName: string): SelfhostLogSource {
  const name = logGroupName.toLowerCase();

  // The API Lambda is named `...-SelfhostApiFunction-<suffix>`.
  if (name.includes("selfhostapi")) {
    return "api";
  }
  // sst.aws.Nextjs expands into several Lambdas (server, image optimizer,
  // warmer) that all carry the SelfhostWeb logical name.
  if (name.includes("selfhostweb")) {
    return "web";
  }
  if (name.includes("batch") || name.includes("workflow")) {
    return "workers";
  }
  return "other";
}

export function logSourceLabel(source: SelfhostLogSource): string {
  return SOURCE_LABELS[source];
}

export function isValidLogSource(value: string): value is SelfhostLogSource {
  return value in SOURCE_LABELS;
}

/**
 * Parse a `--since` duration like `30m`, `2h`, `7d` into milliseconds.
 * Throws rather than silently defaulting — a typo'd window that quietly
 * becomes "1 hour" hides logs the user asked to see.
 */
export function parseSince(value: string): number {
  const match = SINCE_DURATION.exec(value.trim());
  if (!match) {
    throw errors.invalidLogWindow(value);
  }
  const amount = Number.parseInt(match[1], 10);
  if (amount <= 0) {
    throw errors.invalidLogWindow(value);
  }
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}

/** Lambda lifecycle line (START/END/REPORT), suppressed unless `--platform`. */
export function isPlatformLine(message: string): boolean {
  return PLATFORM_LINE.test(message);
}

/**
 * Pull the JSON payload out of a log line.
 *
 * pino writes straight to stdout so its line is pure JSON, but anything routed
 * through `console.*` under Lambda's text log format arrives prefixed with
 * `<timestamp>\t<requestId>\t<level>\t`. Parsing from the first brace handles
 * both without a second code path.
 */
function parseStructured(message: string): Record<string, unknown> | null {
  const start = message.indexOf("{");
  if (start === -1) {
    return null;
  }
  try {
    const parsed = JSON.parse(message.slice(start));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
    // baseline:allow-next-line no-swallowed-errors — a non-JSON line is normal
  } catch {
    return null;
  }
}

/**
 * Decide whether a line is genuinely an error.
 *
 * The server-side pattern matches any line *containing* the word "error",
 * which on a healthy API is mostly `"errorCount":0` and field names. For
 * structured logs the `level` field is authoritative, so trust it and ignore
 * the text entirely — that refinement is what keeps `--errors` usable.
 */
export function isErrorLine(message: string): boolean {
  const structured = parseStructured(message);
  const level = structured?.level;
  if (typeof level === "string") {
    return ERROR_LEVELS.has(level.toLowerCase());
  }
  if (typeof level === "number") {
    // pino's numeric levels: 50 = error, 60 = fatal.
    return level >= 50;
  }
  return ERROR_TEXT.test(message);
}

/** Best-effort level for display/coloring. Returns null when undetectable. */
export function detectLevel(message: string): string | null {
  const structured = parseStructured(message);
  const level = structured?.level;
  if (typeof level === "string") {
    return level.toUpperCase();
  }
  if (typeof level === "number") {
    if (level >= 60) {
      return "FATAL";
    }
    if (level >= 50) {
      return "ERROR";
    }
    if (level >= 40) {
      return "WARN";
    }
    if (level >= 30) {
      return "INFO";
    }
    return "DEBUG";
  }
  if (isPlatformLine(message)) {
    return null;
  }
  const match = LEVEL_TEXT.exec(message);
  if (match) {
    return match[2] === "WARNING" ? "WARN" : match[2];
  }
  return ERROR_TEXT.test(message) ? "ERROR" : null;
}

/**
 * Human-readable body for a log line: the `msg` of a structured record, or the
 * raw line. The full record is still available via `--verbose`.
 */
export function formatMessageBody(message: string): string {
  const structured = parseStructured(message);
  if (!structured) {
    return message;
  }
  const body = structured.msg ?? structured.message;
  if (typeof body !== "string" || body.length === 0) {
    return message;
  }
  const err = structured.err ?? structured.error;
  if (err && typeof err === "object") {
    const detail = (err as Record<string, unknown>).message;
    if (typeof detail === "string" && detail !== body) {
      return `${body} — ${detail}`;
    }
  }
  return body;
}

async function getLogsClient(region: string) {
  const { CloudWatchLogsClient } = await import(
    "@aws-sdk/client-cloudwatch-logs"
  );
  return new CloudWatchLogsClient({ region });
}

/**
 * Translate a CloudWatch Logs failure into a WrapsError with a specific cause.
 * A bare rethrow lands in the generic AWS handler, which cannot tell "you lack
 * logs:FilterLogEvents" from "the region has no deployment".
 */
function toLogsError(error: unknown, action: string): Error {
  if (!isAWSError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }
  if (
    error.name === "AccessDeniedException" ||
    error.name === "AccessDenied" ||
    error.message.includes("AccessDenied") ||
    error.message.includes("not authorized")
  ) {
    return errors.cloudWatchLogsPermissionDenied(action);
  }
  return error;
}

/**
 * Find every log group belonging to a self-hosted deployment in this region.
 * Works for both variants — see SELFHOST_LOG_GROUP_PREFIX.
 */
export async function discoverSelfhostLogGroups(
  region: string
): Promise<SelfhostLogGroup[]> {
  const { DescribeLogGroupsCommand } = await import(
    "@aws-sdk/client-cloudwatch-logs"
  );
  const client = await getLogsClient(region);
  const groups: SelfhostLogGroup[] = [];
  let nextToken: string | undefined;

  try {
    do {
      const result = await client.send(
        new DescribeLogGroupsCommand({
          logGroupNamePrefix: SELFHOST_LOG_GROUP_PREFIX,
          nextToken,
        })
      );
      for (const group of result.logGroups ?? []) {
        if (group.logGroupName && group.arn) {
          groups.push({
            name: group.logGroupName,
            arn: group.arn,
            source: classifyLogGroup(group.logGroupName),
          });
        }
      }
      nextToken = result.nextToken;
    } while (nextToken);
  } catch (error) {
    throw toLogsError(error, "logs:DescribeLogGroups");
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function toEntries(
  events: FilteredLogEvent[],
  group: SelfhostLogGroup
): SelfhostLogEntry[] {
  return events.map((event) => ({
    timestamp: event.timestamp ?? Date.now(),
    message: (event.message ?? "").trimEnd(),
    logStream: event.logStreamName ?? "",
    logGroup: group.name,
    source: group.source,
  }));
}

function eventKey(event: FilteredLogEvent, groupName: string): string {
  return (
    event.eventId ?? `${groupName}:${event.timestamp}:${event.message ?? ""}`
  );
}

async function fetchGroupEvents(options: {
  region: string;
  group: SelfhostLogGroup;
  startTime: number;
  endTime?: number;
  filterPattern?: string;
  maxEntries: number;
  onKey?: (key: string) => boolean;
}): Promise<SelfhostLogEntry[]> {
  const { FilterLogEventsCommand } = await import(
    "@aws-sdk/client-cloudwatch-logs"
  );
  const client = await getLogsClient(options.region);
  const collected: FilteredLogEvent[] = [];
  let nextToken: string | undefined;

  try {
    do {
      const result = await client.send(
        new FilterLogEventsCommand({
          logGroupName: options.group.name,
          startTime: options.startTime,
          endTime: options.endTime,
          filterPattern: options.filterPattern,
          nextToken,
          limit: 200,
        })
      );
      for (const event of result.events ?? []) {
        if (
          options.onKey &&
          !options.onKey(eventKey(event, options.group.name))
        ) {
          continue;
        }
        collected.push(event);
      }
      nextToken = result.nextToken;
    } while (nextToken && collected.length < options.maxEntries);
  } catch (error) {
    // A group deleted between discovery and fetch (mid-redeploy) should not
    // take the whole command down — the other groups still have output.
    if (isAWSError(error) && error.name === "ResourceNotFoundException") {
      return [];
    }
    throw toLogsError(error, "logs:FilterLogEvents");
  }

  return toEntries(collected.slice(0, options.maxEntries), options.group);
}

/**
 * Fetch a time window across every selected group and return one
 * chronologically ordered list.
 *
 * Groups are read concurrently and merged, so API and worker lines interleave
 * by time. Reading them sequentially would print all of one group before any
 * of the next, which is useless for correlating a request across components.
 */
export async function fetchLogs(options: {
  region: string;
  groups: SelfhostLogGroup[];
  startTime: number;
  endTime?: number;
  filterPattern?: string;
  maxEntries?: number;
}): Promise<SelfhostLogEntry[]> {
  const maxEntries = options.maxEntries ?? 1000;
  const perGroup = await Promise.all(
    options.groups.map((group) =>
      fetchGroupEvents({
        region: options.region,
        group,
        startTime: options.startTime,
        endTime: options.endTime,
        filterPattern: options.filterPattern,
        maxEntries,
      })
    )
  );
  return perGroup
    .flat()
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-maxEntries);
}

export type LogPoller = () => Promise<SelfhostLogEntry[]>;

/**
 * Build a stateful poller that returns only events not seen before.
 *
 * Two mechanisms are needed together and neither is sufficient alone:
 * advancing the window drops events that CloudWatch made visible late, and
 * dedupe alone would re-download the whole window every tick.
 */
export function createLogPoller(options: {
  region: string;
  groups: SelfhostLogGroup[];
  filterPattern?: string;
  since: number;
  now?: () => number;
}): LogPoller {
  const now = options.now ?? (() => Date.now());
  const seen = new Set<string>();
  const order: string[] = [];
  let nextStart = options.since;

  const remember = (key: string): boolean => {
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    order.push(key);
    if (order.length > MAX_SEEN_KEYS) {
      const evicted = order.splice(0, order.length - MAX_SEEN_KEYS);
      for (const stale of evicted) {
        seen.delete(stale);
      }
    }
    return true;
  };

  return async function poll(): Promise<SelfhostLogEntry[]> {
    const windowStart = Math.max(0, nextStart - POLL_OVERLAP_MS);
    const tickStart = now();

    const perGroup = await Promise.all(
      options.groups.map((group) =>
        fetchGroupEvents({
          region: options.region,
          group,
          startTime: windowStart,
          filterPattern: options.filterPattern,
          maxEntries: 1000,
          onKey: remember,
        })
      )
    );

    nextStart = tickStart;
    return perGroup.flat().sort((a, b) => a.timestamp - b.timestamp);
  };
}

export type LiveTailSession = {
  stream: AsyncIterable<SelfhostLogEntry[]>;
  abort: () => void;
};

/**
 * StartLiveTail identifies groups by ARN, and the ARN returned by
 * DescribeLogGroups carries a trailing `:*` that the API rejects.
 */
export function liveTailIdentifier(arn: string): string {
  return arn.replace(ARN_WILDCARD_SUFFIX, "");
}

/**
 * Open a CloudWatch Live Tail session. Billed by AWS per minute the session is
 * open — callers must disclose that before calling.
 *
 * The session is terminated by AWS after roughly 3 hours; the stream simply
 * ends, which callers should treat as "reconnect", not "no more logs".
 */
export function startSelfhostLiveTail(options: {
  region: string;
  groups: SelfhostLogGroup[];
  filterPattern?: string;
}): LiveTailSession {
  const abortController = new AbortController();
  const bySource = new Map(
    options.groups.map((group) => [liveTailIdentifier(group.arn), group])
  );

  const stream = (async function* () {
    const { StartLiveTailCommand } = await import(
      "@aws-sdk/client-cloudwatch-logs"
    );
    const client = await getLogsClient(options.region);

    const response = await client.send(
      new StartLiveTailCommand({
        logGroupIdentifiers: [...bySource.keys()].slice(
          0,
          LIVE_TAIL_MAX_GROUPS
        ),
        logEventFilterPattern: options.filterPattern ?? "",
      }),
      { abortSignal: abortController.signal }
    );

    if (!response.responseStream) {
      return;
    }

    for await (const event of response.responseStream) {
      const results = event.sessionUpdate?.sessionResults;
      if (!results?.length) {
        continue;
      }
      yield results.map((result) => {
        const identifier = result.logGroupIdentifier ?? "";
        const group = bySource.get(identifier);
        return {
          timestamp: result.timestamp ?? Date.now(),
          message: (result.message ?? "").trimEnd(),
          logStream: result.logStreamName ?? "",
          logGroup: group?.name ?? identifier,
          source: group?.source ?? classifyLogGroup(identifier),
        };
      });
    }
  })();

  return { stream, abort: () => abortController.abort() };
}

export function liveTailGroupLimit(): number {
  return LIVE_TAIL_MAX_GROUPS;
}
