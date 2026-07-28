import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { SelfhostLogsOptions } from "../../types/index.js";
import type {
  SelfhostLogEntry,
  SelfhostLogGroup,
  SelfhostLogSource,
} from "../../utils/selfhost/logs.js";
import {
  createLogPoller,
  detectLevel,
  discoverSelfhostLogGroups,
  ERROR_FILTER_PATTERN,
  fetchLogs,
  formatMessageBody,
  isErrorLine,
  isPlatformLine,
  isValidLogSource,
  liveTailGroupLimit,
  logSourceLabel,
  parseSince,
  startSelfhostLiveTail,
} from "../../utils/selfhost/logs.js";
import { validateAWSCredentials } from "../../utils/shared/aws.js";
import { errors } from "../../utils/shared/errors.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import { DeploymentProgress } from "../../utils/shared/output.js";
import { resolveRegionForCommand } from "../../utils/shared/region-resolver.js";

const DEFAULT_SINCE = "1h";
const DEFAULT_INTERVAL_SECONDS = 3;
const MIN_INTERVAL_SECONDS = 1;
const MAX_INTERVAL_SECONDS = 60;
/** How far back `--follow` backfills before streaming, so the screen isn't empty. */
const FOLLOW_BACKFILL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;

const SOURCE_COLORS: Record<SelfhostLogSource, (text: string) => string> = {
  api: pc.cyan,
  web: pc.magenta,
  workers: pc.blue,
  other: pc.gray,
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function colorLevel(level: string | null): string {
  if (!level) {
    return pc.dim("     ");
  }
  const padded = level.padEnd(5).slice(0, 5);
  if (level === "ERROR" || level === "FATAL" || level === "CRITICAL") {
    return pc.red(padded);
  }
  if (level === "WARN") {
    return pc.yellow(padded);
  }
  if (level === "INFO") {
    return pc.green(padded);
  }
  return pc.dim(padded);
}

function renderEntry(
  entry: SelfhostLogEntry,
  options: { sourceWidth: number; verbose: boolean }
): string {
  const level = detectLevel(entry.message);
  const label = logSourceLabel(entry.source).padEnd(options.sourceWidth);
  const body = options.verbose
    ? entry.message
    : formatMessageBody(entry.message);
  return `${pc.dim(formatTime(entry.timestamp))}  ${SOURCE_COLORS[entry.source](label)}  ${colorLevel(level)}  ${body}`;
}

function toJsonEntry(entry: SelfhostLogEntry): Record<string, unknown> {
  return {
    timestamp: entry.timestamp,
    time: new Date(entry.timestamp).toISOString(),
    source: entry.source,
    level: detectLevel(entry.message),
    logGroup: entry.logGroup,
    logStream: entry.logStream,
    message: entry.message,
  };
}

/**
 * Client-side pass over what CloudWatch returned.
 *
 * The server pattern for `--errors` matches any line containing "error", which
 * on a healthy API is mostly `"errorCount":0` and field names — `isErrorLine()`
 * reads the structured `level` instead and throws those away.
 */
function refine(
  entries: SelfhostLogEntry[],
  options: { errorsOnly: boolean; platform: boolean }
): SelfhostLogEntry[] {
  return entries.filter((entry) => {
    if (entry.message.length === 0) {
      return false;
    }
    if (!options.platform && isPlatformLine(entry.message)) {
      return false;
    }
    if (options.errorsOnly && !isErrorLine(entry.message)) {
      return false;
    }
    return true;
  });
}

function parseInterval(value: string | undefined): number {
  if (!value) {
    return DEFAULT_INTERVAL_SECONDS;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_INTERVAL_SECONDS;
  }
  return Math.min(Math.max(parsed, MIN_INTERVAL_SECONDS), MAX_INTERVAL_SECONDS);
}

function selectGroups(
  groups: SelfhostLogGroup[],
  source: string | undefined
): SelfhostLogGroup[] {
  if (!source || source === "all") {
    return groups;
  }
  if (!isValidLogSource(source)) {
    throw errors.invalidLogSource(source);
  }
  return groups.filter((group) => group.source === source);
}

/**
 * A plain `setTimeout` await leaves Ctrl+C waiting out the full interval before
 * the loop notices. Handing the resolver to the signal handler makes the stop
 * feel immediate while still exiting through the normal return path, so
 * telemetry flushes.
 */
function createInterruptibleSleep() {
  let wake: (() => void) | null = null;
  return {
    sleep: (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          wake = null;
          resolve();
        }, ms);
        wake = () => {
          clearTimeout(timer);
          wake = null;
          resolve();
        };
      }),
    interrupt: () => wake?.(),
  };
}

function printGroupSummary(groups: SelfhostLogGroup[]): void {
  const bySource = new Map<SelfhostLogSource, string[]>();
  for (const group of groups) {
    const existing = bySource.get(group.source) ?? [];
    existing.push(group.name);
    bySource.set(group.source, existing);
  }
  const parts = [...bySource.entries()].map(
    ([source, names]) =>
      `${SOURCE_COLORS[source](logSourceLabel(source))} ${pc.dim(`(${names.length})`)}`
  );
  console.log(
    `${pc.dim("Sources:")} ${parts.join(pc.dim(" · "))}  ${pc.dim(`${groups.length} log group${groups.length === 1 ? "" : "s"}`)}`
  );
}

/**
 * Stream self-hosted platform logs from CloudWatch.
 *
 * Both selfhost variants prefix their Lambda log groups with
 * `/aws/lambda/wraps-selfhost`, so a single DescribeLogGroups call discovers
 * the Pulumi variant's one function and the SST variant's seven alike — no
 * variant probe needed.
 */
export async function selfhostLogs(
  options: SelfhostLogsOptions
): Promise<void> {
  const progress = new DeploymentProgress();
  const json = isJsonMode();

  if (!json) {
    clack.intro(pc.bold("Wraps Self-Hosted Logs"));
  }

  const sinceMs = parseSince(options.since ?? DEFAULT_SINCE);
  const intervalSeconds = parseInterval(options.interval);

  const identity = await progress.execute(
    "Checking AWS credentials",
    async () => validateAWSCredentials()
  );

  // Region resolution can prompt, so it must sit outside a spinner.
  const region = await resolveRegionForCommand({
    accountId: identity.accountId,
    optionRegion: options.region,
    service: "selfhost",
    label: "self-hosted deployment",
  });

  const metadata = await loadConnectionMetadata(identity.accountId, region);
  const allGroups = await progress.execute("Locating log groups", async () =>
    discoverSelfhostLogGroups(region)
  );
  const groups = selectGroups(allGroups, options.source);

  progress.stop();

  // Deliberately softer than every other selfhost command, which exits here.
  // Discovery only needs a region, and "logs won't open" is the worst possible
  // failure for a debugging tool when the deploy ran on CI or another machine.
  if (!(metadata?.services?.selfhost || json)) {
    clack.log.warn(
      "No self-hosted deployment recorded on this machine — reading log groups directly from AWS."
    );
  }

  if (allGroups.length === 0) {
    throw errors.noSelfhostLogGroups(region);
  }

  if (groups.length === 0) {
    throw errors.noLogGroupsForSource(
      options.source ?? "all",
      [...new Set(allGroups.map((group) => group.source))].join(", ")
    );
  }

  // --filter is a raw CloudWatch pattern. It wins server-side because the
  // pattern language can't AND two OR-groups together; --errors still applies
  // client-side, so `--errors --filter X` means "errors, among lines matching X".
  const filterPattern =
    options.filter ?? (options.errors ? ERROR_FILTER_PATTERN : undefined);
  const refineOptions = {
    errorsOnly: Boolean(options.errors),
    platform: Boolean(options.platform),
  };
  const sourceWidth = Math.max(
    ...groups.map((group) => logSourceLabel(group.source).length)
  );
  const renderOptions = {
    sourceWidth,
    verbose: Boolean(options.verbose),
  };

  const emit = (entries: SelfhostLogEntry[]) => {
    for (const entry of entries) {
      console.log(
        json
          ? JSON.stringify(toJsonEntry(entry))
          : renderEntry(entry, renderOptions)
      );
    }
  };

  const context: StreamContext = {
    region,
    groups,
    filterPattern,
    refineOptions,
    emit,
    json,
    live: Boolean(options.live),
    intervalSeconds,
  };

  if (options.follow) {
    await follow(context);
    return;
  }

  await printWindow(context, {
    sinceMs,
    sinceLabel: options.since ?? DEFAULT_SINCE,
    errorsOnly: refineOptions.errorsOnly,
  });
}

type StreamContext = {
  region: string;
  groups: SelfhostLogGroup[];
  filterPattern?: string;
  refineOptions: { errorsOnly: boolean; platform: boolean };
  emit: (entries: SelfhostLogEntry[]) => void;
  json: boolean;
  live: boolean;
  intervalSeconds: number;
};

/** One-shot mode: fetch a window, print it, exit. */
async function printWindow(
  context: StreamContext,
  window: { sinceMs: number; sinceLabel: string; errorsOnly: boolean }
): Promise<void> {
  const entries = refine(
    await fetchLogs({
      region: context.region,
      groups: context.groups,
      startTime: Date.now() - window.sinceMs,
      filterPattern: context.filterPattern,
      maxEntries: MAX_ENTRIES,
    }),
    context.refineOptions
  );

  if (context.json) {
    jsonSuccess("selfhost.logs", {
      region: context.region,
      groups: context.groups.map((group) => ({
        name: group.name,
        source: group.source,
      })),
      entries: entries.map(toJsonEntry),
    });
    return;
  }

  printGroupSummary(context.groups);
  console.log("");

  if (entries.length === 0) {
    clack.log.info(
      window.errorsOnly
        ? `No errors in the last ${window.sinceLabel}.`
        : `No log events in the last ${window.sinceLabel}.`
    );
    clack.outro(pc.dim("Nothing to report"));
    return;
  }

  context.emit(entries);
  console.log("");
  if (entries.length >= MAX_ENTRIES) {
    clack.log.warn(
      `Showing the most recent ${MAX_ENTRIES} events — narrow the window with ${pc.cyan("--since")} to see more.`
    );
  }
  clack.outro(
    pc.dim(
      `${entries.length} event${entries.length === 1 ? "" : "s"} from the last ${window.sinceLabel}`
    )
  );
}

function printFollowHeader(context: StreamContext): void {
  printGroupSummary(context.groups);
  if (context.live) {
    console.log(
      pc.yellow(
        "⚠ CloudWatch Live Tail bills ~$0.01/min for as long as this session is open."
      )
    );
    console.log(
      pc.dim(`Live tailing · ${pc.reset(pc.bold("Ctrl+C"))} to stop`)
    );
  } else {
    console.log(
      pc.dim(
        `Polling every ${context.intervalSeconds}s · ${pc.reset(pc.bold("Ctrl+C"))} to stop`
      )
    );
  }
  console.log("");
}

async function follow(context: StreamContext): Promise<void> {
  let stopped = false;
  const timer = createInterruptibleSleep();
  let abortStream: (() => void) | null = null;

  const onSigint = () => {
    stopped = true;
    abortStream?.();
    timer.interrupt();
  };
  process.on("SIGINT", onSigint);

  try {
    if (!context.json) {
      printFollowHeader(context);
    }

    // Neither mode shows anything older than the moment it starts — Live Tail
    // only delivers events arriving after the session opens, and the poller
    // starts its window at "now". Backfill or the screen sits empty until the
    // next request lands.
    context.emit(
      refine(
        await fetchLogs({
          region: context.region,
          groups: context.groups,
          startTime: Date.now() - FOLLOW_BACKFILL_MS,
          filterPattern: context.filterPattern,
          maxEntries: MAX_ENTRIES,
        }),
        context.refineOptions
      )
    );

    if (context.live) {
      await runLiveTail(context, {
        isStopped: () => stopped,
        onSession: (abort) => {
          abortStream = abort;
        },
      });
    } else {
      await runPolling(context, {
        isStopped: () => stopped,
        sleep: timer.sleep,
      });
    }
  } finally {
    process.off("SIGINT", onSigint);
  }

  if (!context.json) {
    console.log("");
    clack.outro(pc.dim("Stopped"));
  }
}

async function runLiveTail(
  context: StreamContext,
  control: { isStopped: () => boolean; onSession: (abort: () => void) => void }
): Promise<void> {
  if (context.groups.length > liveTailGroupLimit() && !context.json) {
    clack.log.warn(
      `Live Tail supports ${liveTailGroupLimit()} log groups per session — tailing the first ${liveTailGroupLimit()}. Use ${pc.cyan("--source")} to choose which.`
    );
  }

  const session = startSelfhostLiveTail({
    region: context.region,
    groups: context.groups,
    filterPattern: context.filterPattern,
  });
  control.onSession(session.abort);

  try {
    for await (const batch of session.stream) {
      context.emit(refine(batch, context.refineOptions));
    }
  } catch (error) {
    // Ctrl+C aborts the in-flight request; that's the normal exit path.
    if (!(control.isStopped() && isAbortError(error))) {
      throw error;
    }
    return;
  }

  // AWS ends a Live Tail session after ~3h. Reaching here without a stop means
  // the stream expired, not that the deployment went quiet.
  if (!(control.isStopped() || context.json)) {
    clack.log.warn(
      `Live Tail session ended (AWS caps sessions at ~3 hours). Run ${pc.cyan("wraps selfhost logs --follow --live")} again to resume.`
    );
  }
}

async function runPolling(
  context: StreamContext,
  control: { isStopped: () => boolean; sleep: (ms: number) => Promise<void> }
): Promise<void> {
  const poll = createLogPoller({
    region: context.region,
    groups: context.groups,
    filterPattern: context.filterPattern,
    since: Date.now(),
  });

  while (!control.isStopped()) {
    await control.sleep(context.intervalSeconds * 1000);
    if (control.isStopped()) {
      break;
    }
    context.emit(refine(await poll(), context.refineOptions));
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  );
}
