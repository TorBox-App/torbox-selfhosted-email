import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  StartLiveTailCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";

vi.mock("@clack/prompts");
vi.mock("../../utils/shared/aws.js");
vi.mock("../../utils/shared/metadata.js", async () => {
  const actual = await vi.importActual("../../utils/shared/metadata.js");
  return { ...actual, loadConnectionMetadata: vi.fn() };
});
vi.mock("../../utils/shared/region-resolver.js");
vi.mock("../../telemetry/events.js");

import * as prompts from "@clack/prompts";
import * as aws from "../../utils/shared/aws.js";
import * as metadata from "../../utils/shared/metadata.js";
import * as regionResolver from "../../utils/shared/region-resolver.js";
import { selfhostLogs } from "../selfhost/logs.js";

const logsMock = mockClient(CloudWatchLogsClient);

const PULUMI_GROUP = {
  logGroupName: "/aws/lambda/wraps-selfhost-api",
  arn: "arn:aws:logs:us-east-1:115690362111:log-group:/aws/lambda/wraps-selfhost-api:*",
};
const SST_WEB_GROUP = {
  logGroupName:
    "/aws/lambda/wraps-selfhost-production-SelfhostWebServer-c3d4e5f6",
  arn: "arn:aws:logs:us-east-1:115690362111:log-group:web:*",
};
const SST_WORKER_GROUP = {
  logGroupName:
    "/aws/lambda/wraps-selfhost-production-SelfhostBatchQueue-e5f6a7b8",
  arn: "arn:aws:logs:us-east-1:115690362111:log-group:batch:*",
};

const MOCK_METADATA = {
  version: "1.0.0",
  accountId: "115690362111",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2026-07-01T00:00:00.000Z",
  services: {
    selfhost: {
      deployedAt: "2026-07-01T00:00:00.000Z",
      apiUrl: "https://abc123.lambda-url.us-east-1.on.aws",
      variant: "pulumi" as const,
      config: {
        databaseUrl: "postgres://db",
        licenseKey: "v1.scale.2027-05-19.abc123",
        appUrl: "https://app.example.com",
        unsubscribeSecret: "u",
        betterAuthSecret: "b",
      },
    },
  },
};

/**
 * Invoke only the SIGINT listener the command registered.
 *
 * `process.emit("SIGINT")` would also fire vitest's own handler and kill the
 * run, so the listener is isolated by diffing against the ones already present.
 */
function interruptCommand(before: readonly unknown[]): void {
  const added = process
    .listeners("SIGINT")
    .find((listener) => !before.includes(listener));
  if (!added) {
    throw new Error("command did not register a SIGINT listener");
  }
  added("SIGINT");
}

/**
 * Assert the first FilterLogEvents call looked back `windowMs`.
 *
 * The command reads its own `Date.now()` after `before` was sampled, so the
 * lower bound is `before - windowMs` exactly and the slack goes on the far end.
 */
function expectWindow(before: number, windowMs: number): void {
  const startTime = logsMock.commandCalls(FilterLogEventsCommand)[0].args[0]
    .input.startTime as number;
  expect(startTime).toBeGreaterThanOrEqual(before - windowMs);
  expect(startTime).toBeLessThan(before - windowMs + 10_000);
}

function captureOutput() {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {
    // suppress
  });
  return () => spy.mock.calls.map((call) => call.join(" ")).join("\n");
}

describe("selfhostLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logsMock.reset();
    setJsonMode(false);

    vi.mocked(prompts.intro).mockImplementation(() => {
      // suppress
    });
    vi.mocked(prompts.outro).mockImplementation(() => {
      // suppress
    });
    vi.mocked(prompts.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    } as unknown as ReturnType<typeof prompts.spinner>);
    vi.mocked(prompts.log).info = vi.fn();
    vi.mocked(prompts.log).warn = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).success = vi.fn();

    vi.mocked(aws.validateAWSCredentials).mockResolvedValue({
      accountId: "115690362111",
      userId: "AIDACKCEVSQ6C2EXAMPLE",
      arn: "arn:aws:iam::115690362111:user/test",
    });
    vi.mocked(regionResolver.resolveRegionForCommand).mockResolvedValue(
      "us-east-1"
    );
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      MOCK_METADATA as never
    );

    logsMock
      .on(DescribeLogGroupsCommand)
      .resolves({ logGroups: [PULUMI_GROUP] });
    logsMock.on(FilterLogEventsCommand).resolves({ events: [] });
  });

  describe("error filtering", () => {
    it("applies the server-side error pattern when --errors is set", async () => {
      captureOutput();

      await selfhostLogs({ region: "us-east-1", errors: true });

      const input = logsMock.commandCalls(FilterLogEventsCommand)[0].args[0]
        .input;
      expect(input.filterPattern).toContain("?ERROR");
      expect(input.filterPattern).toContain('"Task timed out"');
    });

    // The server pattern matches any line containing "error"; without the
    // client-side refine, a healthy API floods --errors with false positives.
    it("drops info lines that merely contain the word error", async () => {
      logsMock.on(FilterLogEventsCommand).resolves({
        events: [
          {
            eventId: "1",
            timestamp: 1000,
            message:
              '{"level":"info","service":"wraps-api","msg":"batch complete","errorCount":0}',
          },
          {
            eventId: "2",
            timestamp: 2000,
            message:
              '{"level":"error","service":"wraps-api","msg":"send rejected"}',
          },
        ],
      });
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1", errors: true });

      expect(output()).toContain("send rejected");
      expect(output()).not.toContain("batch complete");
    });

    // The pattern language can't AND two OR-groups, so --filter owns the server
    // request and --errors narrows what came back.
    it("sends --filter to CloudWatch and still refines with --errors", async () => {
      logsMock.on(FilterLogEventsCommand).resolves({
        events: [
          {
            eventId: "1",
            timestamp: 1000,
            message: '{"level":"info","msg":"org 8c01 ok","errors":0}',
          },
          {
            eventId: "2",
            timestamp: 2000,
            message: '{"level":"error","msg":"org 8c01 failed"}',
          },
        ],
      });
      const output = captureOutput();

      await selfhostLogs({
        region: "us-east-1",
        errors: true,
        filter: '"organizationId"',
      });

      expect(
        logsMock.commandCalls(FilterLogEventsCommand)[0].args[0].input
          .filterPattern
      ).toBe('"organizationId"');
      expect(output()).toContain("org 8c01 failed");
      expect(output()).not.toContain("org 8c01 ok");
    });

    it("sends no filter pattern when neither flag is set", async () => {
      captureOutput();

      await selfhostLogs({ region: "us-east-1" });

      expect(
        logsMock.commandCalls(FilterLogEventsCommand)[0].args[0].input
          .filterPattern
      ).toBeUndefined();
    });
  });

  describe("platform lines", () => {
    beforeEach(() => {
      logsMock.on(FilterLogEventsCommand).resolves({
        events: [
          {
            eventId: "1",
            timestamp: 1000,
            message: "START RequestId: abc-123 Version: $LATEST",
          },
          {
            eventId: "2",
            timestamp: 2000,
            message: '{"level":"info","msg":"handled request"}',
          },
        ],
      });
    });

    it("suppresses Lambda lifecycle lines by default", async () => {
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1" });

      expect(output()).toContain("handled request");
      expect(output()).not.toContain("START RequestId");
    });

    it("includes them with --platform", async () => {
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1", platform: true });

      expect(output()).toContain("START RequestId");
    });
  });

  describe("rendering", () => {
    beforeEach(() => {
      logsMock.on(FilterLogEventsCommand).resolves({
        events: [
          {
            eventId: "1",
            timestamp: 1000,
            message:
              '{"level":"error","service":"wraps-api","msg":"send rejected","err":{"message":"MessageRejected"}}',
          },
        ],
      });
    });

    it("shows the structured message body, not the raw record", async () => {
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1" });

      expect(output()).toContain("send rejected — MessageRejected");
      expect(output()).not.toContain('"service":"wraps-api"');
    });

    it("shows the raw line with --verbose", async () => {
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1", verbose: true });

      expect(output()).toContain('"service":"wraps-api"');
    });
  });

  describe("source selection", () => {
    beforeEach(() => {
      logsMock.on(DescribeLogGroupsCommand).resolves({
        logGroups: [PULUMI_GROUP, SST_WEB_GROUP, SST_WORKER_GROUP],
      });
    });

    it("queries only the selected source's log groups", async () => {
      captureOutput();

      await selfhostLogs({ region: "us-east-1", source: "api" });

      const queried = logsMock
        .commandCalls(FilterLogEventsCommand)
        .map((call) => call.args[0].input.logGroupName);
      expect(queried).toEqual(["/aws/lambda/wraps-selfhost-api"]);
    });

    it("queries every group when no source is given", async () => {
      captureOutput();

      await selfhostLogs({ region: "us-east-1" });

      expect(logsMock.commandCalls(FilterLogEventsCommand)).toHaveLength(3);
    });

    it("rejects an unknown source", async () => {
      captureOutput();

      await expect(
        selfhostLogs({ region: "us-east-1", source: "database" })
      ).rejects.toMatchObject({ code: "INVALID_LOG_SOURCE" });
    });

    // The Pulumi variant is API-only, so `--source web` is a reasonable request
    // with no answer rather than a typo.
    it("explains when the deployment has no groups for that source", async () => {
      logsMock
        .on(DescribeLogGroupsCommand)
        .resolves({ logGroups: [PULUMI_GROUP] });
      captureOutput();

      await expect(
        selfhostLogs({ region: "us-east-1", source: "web" })
      ).rejects.toMatchObject({ code: "SELFHOST_NO_LOG_GROUPS_FOR_SOURCE" });
    });
  });

  describe("discovery", () => {
    it("scans the prefix shared by both variants", async () => {
      captureOutput();

      await selfhostLogs({ region: "us-east-1" });

      expect(
        logsMock.commandCalls(DescribeLogGroupsCommand)[0].args[0].input
          .logGroupNamePrefix
      ).toBe("/aws/lambda/wraps-selfhost");
    });

    it("errors when the region has no self-hosted log groups", async () => {
      logsMock.on(DescribeLogGroupsCommand).resolves({ logGroups: [] });
      captureOutput();

      await expect(selfhostLogs({ region: "us-east-1" })).rejects.toMatchObject(
        { code: "SELFHOST_NO_LOG_GROUPS" }
      );
    });

    // Unlike every other selfhost command, missing metadata must not stop a
    // debugging tool — the deploy may have run on CI or another machine.
    it("warns but still reads logs when no deployment is recorded locally", async () => {
      vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(null);
      logsMock.on(FilterLogEventsCommand).resolves({
        events: [
          {
            eventId: "1",
            timestamp: 1000,
            message: '{"level":"info","msg":"still readable"}',
          },
        ],
      });
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1" });

      expect(prompts.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("No self-hosted deployment recorded")
      );
      expect(output()).toContain("still readable");
    });
  });

  describe("window", () => {
    it("defaults to the last hour", async () => {
      captureOutput();
      const before = Date.now();

      await selfhostLogs({ region: "us-east-1" });

      expectWindow(before, 3_600_000);
    });

    it("honors --since", async () => {
      captureOutput();
      const before = Date.now();

      await selfhostLogs({ region: "us-east-1", since: "15m" });

      expectWindow(before, 900_000);
    });

    // Rejecting the value beats quietly falling back to 1h and hiding logs.
    it("rejects a malformed --since before calling AWS", async () => {
      captureOutput();

      await expect(
        selfhostLogs({ region: "us-east-1", since: "yesterday" })
      ).rejects.toMatchObject({ code: "INVALID_LOG_WINDOW" });
      expect(logsMock.commandCalls(DescribeLogGroupsCommand)).toHaveLength(0);
    });
  });

  describe("follow", () => {
    // Live Tail only delivers events that arrive after the session opens, and
    // the poller starts at "now" — without the backfill the screen sits empty
    // until the next request lands.
    it("backfills the last 5 minutes, then keeps polling until interrupted", async () => {
      logsMock.on(FilterLogEventsCommand).resolves({
        events: [
          {
            eventId: "1",
            timestamp: 1000,
            message: '{"level":"info","msg":"backfilled line"}',
          },
        ],
      });
      const output = captureOutput();
      const before = Date.now();
      const listeners = process.listeners("SIGINT");

      const run = selfhostLogs({
        region: "us-east-1",
        follow: true,
        interval: "1",
      });
      await vi.waitFor(() => expect(output()).toContain("backfilled line"));
      interruptCommand(listeners);
      await run;

      expectWindow(before, 300_000);
      expect(prompts.outro).toHaveBeenCalled();
    });

    it("does not leave a SIGINT listener behind", async () => {
      captureOutput();
      const listeners = process.listeners("SIGINT");

      const run = selfhostLogs({
        region: "us-east-1",
        follow: true,
        interval: "1",
      });
      await vi.waitFor(() =>
        expect(process.listenerCount("SIGINT")).toBe(listeners.length + 1)
      );
      interruptCommand(listeners);
      await run;

      expect(process.listenerCount("SIGINT")).toBe(listeners.length);
    });

    it("discloses the Live Tail cost before opening a session", async () => {
      logsMock.on(StartLiveTailCommand).resolves({ responseStream: [] });
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1", follow: true, live: true });

      expect(output()).toContain("Live Tail bills ~$0.01/min");
    });

    // DescribeLogGroups returns ARNs ending in `:*`, which StartLiveTail rejects.
    it("strips the trailing wildcard from log group ARNs", async () => {
      logsMock.on(StartLiveTailCommand).resolves({ responseStream: [] });
      captureOutput();

      await selfhostLogs({ region: "us-east-1", follow: true, live: true });

      expect(
        logsMock.commandCalls(StartLiveTailCommand)[0].args[0].input
          .logGroupIdentifiers
      ).toEqual([
        "arn:aws:logs:us-east-1:115690362111:log-group:/aws/lambda/wraps-selfhost-api",
      ]);
    });

    it("renders streamed events with the right source", async () => {
      logsMock.on(StartLiveTailCommand).resolves({
        responseStream: (async function* () {
          yield {
            sessionUpdate: {
              sessionResults: [
                {
                  timestamp: 1000,
                  message: '{"level":"error","msg":"streamed failure"}',
                  logStreamName: "stream-1",
                  logGroupIdentifier:
                    "arn:aws:logs:us-east-1:115690362111:log-group:/aws/lambda/wraps-selfhost-api",
                },
              ],
            },
          };
        })(),
      } as never);
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1", follow: true, live: true });

      expect(output()).toContain("streamed failure");
    });

    // AWS caps a Live Tail session at ~3 hours; the stream simply ending means
    // "reconnect", not "no more logs".
    it("explains an expired Live Tail session rather than exiting silently", async () => {
      logsMock.on(StartLiveTailCommand).resolves({ responseStream: [] });
      captureOutput();

      await selfhostLogs({ region: "us-east-1", follow: true, live: true });

      expect(prompts.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("Live Tail session ended")
      );
    });
  });

  describe("json mode", () => {
    it("emits one envelope with entries and their source", async () => {
      setJsonMode(true);
      logsMock.on(FilterLogEventsCommand).resolves({
        events: [
          {
            eventId: "1",
            timestamp: 1000,
            message: '{"level":"error","msg":"send rejected"}',
            logStreamName: "2026/07/28/[$LATEST]abc",
          },
        ],
      });
      const output = captureOutput();

      await selfhostLogs({ region: "us-east-1", json: true });

      const parsed = JSON.parse(output());
      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe("selfhost.logs");
      expect(parsed.data.region).toBe("us-east-1");
      expect(parsed.data.groups).toEqual([
        { name: "/aws/lambda/wraps-selfhost-api", source: "api" },
      ]);
      expect(parsed.data.entries).toEqual([
        {
          timestamp: 1000,
          time: "1970-01-01T00:00:01.000Z",
          source: "api",
          level: "ERROR",
          logGroup: "/aws/lambda/wraps-selfhost-api",
          logStream: "2026/07/28/[$LATEST]abc",
          message: '{"level":"error","msg":"send rejected"}',
        },
      ]);
    });

    it("suppresses the missing-deployment warning in JSON mode", async () => {
      setJsonMode(true);
      vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(null);
      captureOutput();

      await selfhostLogs({ region: "us-east-1", json: true });

      expect(prompts.log.warn).not.toHaveBeenCalled();
    });
  });
});
