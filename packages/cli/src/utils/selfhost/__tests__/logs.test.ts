import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { WrapsError } from "../../shared/errors.js";
import type { SelfhostLogGroup } from "../logs.js";
import {
  classifyLogGroup,
  createLogPoller,
  detectLevel,
  discoverSelfhostLogGroups,
  fetchLogs,
  formatMessageBody,
  isErrorLine,
  isPlatformLine,
  liveTailIdentifier,
  parseSince,
} from "../logs.js";

const logsMock = mockClient(CloudWatchLogsClient);

const REGION = "us-east-1";

function group(
  name: string,
  source: SelfhostLogGroup["source"]
): SelfhostLogGroup {
  return {
    name,
    arn: `arn:aws:logs:${REGION}:123456789012:log-group:${name}:*`,
    source,
  };
}

describe("classifyLogGroup", () => {
  // SST appends an 8-char random suffix to every physical name, so matching is
  // on the logical-name substring rather than the full string.
  it("classifies the SST variant's suffixed API Lambda", () => {
    expect(
      classifyLogGroup(
        "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-a1b2c3d4"
      )
    ).toBe("api");
  });

  it("classifies every Nextjs-expanded Lambda as web", () => {
    expect(
      classifyLogGroup(
        "/aws/lambda/wraps-selfhost-production-SelfhostWebServer-c3d4e5f6"
      )
    ).toBe("web");
    expect(
      classifyLogGroup(
        "/aws/lambda/wraps-selfhost-production-SelfhostWebImageOptimizer-11223344"
      )
    ).toBe("web");
  });

  it("classifies queue senders and DLQ consumers as workers", () => {
    expect(
      classifyLogGroup(
        "/aws/lambda/wraps-selfhost-production-SelfhostBatchQueue-e5f6a7b8"
      )
    ).toBe("workers");
    expect(
      classifyLogGroup(
        "/aws/lambda/wraps-selfhost-production-SelfhostWorkflowDlq-k1l2m3n4"
      )
    ).toBe("workers");
  });

  // A component added to the SST stack later must still appear in the output
  // rather than being silently dropped.
  it("keeps unrecognized groups as 'other' rather than discarding them", () => {
    expect(
      classifyLogGroup(
        "/aws/lambda/wraps-selfhost-production-SelfhostSomethingNew-99887766"
      )
    ).toBe("other");
  });
});

describe("parseSince", () => {
  it("converts each supported unit to milliseconds", () => {
    expect(parseSince("45s")).toBe(45_000);
    expect(parseSince("30m")).toBe(1_800_000);
    expect(parseSince("6h")).toBe(21_600_000);
    expect(parseSince("2d")).toBe(172_800_000);
  });

  it("accepts uppercase units", () => {
    expect(parseSince("2H")).toBe(7_200_000);
  });

  // Silently defaulting a typo'd window to "1h" hides logs the user asked for.
  it("throws on a missing unit", () => {
    expect(() => parseSince("30")).toThrow(WrapsError);
  });

  it("throws on an unsupported unit", () => {
    expect(() => parseSince("2w")).toThrow(WrapsError);
  });

  it("throws on a zero window", () => {
    expect(() => parseSince("0m")).toThrow(WrapsError);
  });
});

describe("isErrorLine", () => {
  it("trusts the structured level over the text", () => {
    expect(
      isErrorLine(
        '{"level":"error","time":"2026-07-28T10:00:00.000Z","service":"wraps-api","msg":"send failed"}'
      )
    ).toBe(true);
  });

  // This is the whole reason for the client-side refine: the server-side
  // pattern matches any line containing "error", and a healthy API emits these
  // constantly.
  it("rejects an info line that merely contains the word error", () => {
    expect(
      isErrorLine(
        '{"level":"info","service":"wraps-api","msg":"batch complete","errorCount":0}'
      )
    ).toBe(false);
  });

  it("rejects an info line whose message names an error field", () => {
    expect(
      isErrorLine('{"level":"info","msg":"no errors in queue","errors":[]}')
    ).toBe(false);
  });

  it("reads pino numeric levels", () => {
    expect(isErrorLine('{"level":50,"msg":"boom"}')).toBe(true);
    expect(isErrorLine('{"level":30,"msg":"fine"}')).toBe(false);
  });

  it("parses JSON preceded by Lambda's text-format prefix", () => {
    expect(
      isErrorLine(
        '2026-07-28T10:00:00.000Z\tabc-123\tINFO\t{"level":"error","msg":"boom"}'
      )
    ).toBe(true);
  });

  it("falls back to text matching for unstructured lines", () => {
    expect(isErrorLine("ERROR Unhandled rejection in /dashboard")).toBe(true);
    expect(
      isErrorLine("2026-07-28T10:00:00Z abc-123 Task timed out after 30.00s")
    ).toBe(true);
    expect(isErrorLine("Runtime.UnhandledPromiseRejection")).toBe(true);
    expect(isErrorLine("GET /dashboard 200 in 42ms")).toBe(false);
  });
});

describe("isPlatformLine", () => {
  it("matches Lambda lifecycle lines", () => {
    expect(isPlatformLine("START RequestId: abc-123 Version: $LATEST")).toBe(
      true
    );
    expect(isPlatformLine("END RequestId: abc-123")).toBe(true);
    expect(
      isPlatformLine("REPORT RequestId: abc-123\tDuration: 12.34 ms")
    ).toBe(true);
    expect(isPlatformLine("INIT_START Runtime Version: nodejs:24.v1")).toBe(
      true
    );
  });

  it("does not match application output", () => {
    expect(isPlatformLine('{"level":"info","msg":"STARTED worker"}')).toBe(
      false
    );
  });
});

describe("detectLevel", () => {
  it("uppercases a structured string level", () => {
    expect(detectLevel('{"level":"warn","msg":"slow query"}')).toBe("WARN");
  });

  it("maps pino numeric levels", () => {
    expect(detectLevel('{"level":60,"msg":"x"}')).toBe("FATAL");
    expect(detectLevel('{"level":40,"msg":"x"}')).toBe("WARN");
  });

  it("returns null for platform lines", () => {
    expect(detectLevel("START RequestId: abc-123")).toBeNull();
  });

  it("normalizes WARNING to WARN", () => {
    expect(detectLevel("WARNING: deprecated config")).toBe("WARN");
  });
});

describe("formatMessageBody", () => {
  it("extracts msg from a structured record", () => {
    expect(
      formatMessageBody('{"level":"info","service":"wraps-api","msg":"sent"}')
    ).toBe("sent");
  });

  it("appends the error detail when it differs from the message", () => {
    expect(
      formatMessageBody(
        '{"level":"error","msg":"send failed","err":{"message":"MessageRejected"}}'
      )
    ).toBe("send failed — MessageRejected");
  });

  it("passes unstructured lines through untouched", () => {
    expect(formatMessageBody("GET /dashboard 200 in 42ms")).toBe(
      "GET /dashboard 200 in 42ms"
    );
  });

  it("falls back to the raw line when the record has no message", () => {
    const raw = '{"level":"info","requestId":"abc"}';
    expect(formatMessageBody(raw)).toBe(raw);
  });
});

describe("liveTailIdentifier", () => {
  // DescribeLogGroups returns ARNs ending in `:*`, which StartLiveTail rejects.
  it("strips the trailing wildcard", () => {
    expect(
      liveTailIdentifier(
        "arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345:*"
      )
    ).toBe(
      "arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345"
    );
  });

  it("leaves an already-clean ARN alone", () => {
    const arn =
      "arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345";
    expect(liveTailIdentifier(arn)).toBe(arn);
  });
});

describe("discoverSelfhostLogGroups", () => {
  beforeEach(() => {
    logsMock.reset();
  });

  it("queries the prefix shared by both variants", async () => {
    logsMock.on(DescribeLogGroupsCommand).resolves({ logGroups: [] });

    await discoverSelfhostLogGroups(REGION);

    expect(
      logsMock.commandCalls(DescribeLogGroupsCommand)[0].args[0].input
    ).toMatchObject({ logGroupNamePrefix: "/aws/lambda/wraps-selfhost" });
  });

  it("walks every page and classifies each group", async () => {
    logsMock
      .on(DescribeLogGroupsCommand, { nextToken: undefined })
      .resolves({
        logGroups: [
          {
            logGroupName:
              "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-a1b2c3d4",
            arn: "arn:aws:logs:us-east-1:1:log-group:api:*",
          },
        ],
        nextToken: "page2",
      })
      .on(DescribeLogGroupsCommand, { nextToken: "page2" })
      .resolves({
        logGroups: [
          {
            logGroupName:
              "/aws/lambda/wraps-selfhost-production-SelfhostBatchQueue-e5f6a7b8",
            arn: "arn:aws:logs:us-east-1:1:log-group:batch:*",
          },
        ],
      });

    const groups = await discoverSelfhostLogGroups(REGION);

    expect(groups.map((g) => g.source)).toEqual(["api", "workers"]);
  });

  it("skips groups missing a name or ARN", async () => {
    logsMock.on(DescribeLogGroupsCommand).resolves({
      logGroups: [
        {
          logGroupName:
            "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
        },
        {
          logGroupName:
            "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          arn: "arn:aws:logs:us-east-1:1:log-group:api:*",
        },
      ],
    });

    expect(await discoverSelfhostLogGroups(REGION)).toHaveLength(1);
  });

  // The generic AWS handler would report this as a credentials problem; the
  // user actually needs to know which log action they're missing.
  it("maps AccessDenied to a CloudWatch Logs permission error", async () => {
    const denied = Object.assign(new Error("User is not authorized"), {
      name: "AccessDeniedException",
      $metadata: { httpStatusCode: 403 },
    });
    logsMock.on(DescribeLogGroupsCommand).rejects(denied);

    await expect(discoverSelfhostLogGroups(REGION)).rejects.toMatchObject({
      code: "CLOUDWATCH_LOGS_PERMISSION_DENIED",
    });
  });
});

describe("fetchLogs", () => {
  beforeEach(() => {
    logsMock.reset();
  });

  // Reading groups sequentially would print all of one component before any of
  // the next, which is useless for following a request across them.
  it("merges groups into one chronological stream", async () => {
    logsMock
      .on(FilterLogEventsCommand, {
        logGroupName:
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
      })
      .resolves({
        events: [
          { eventId: "1", timestamp: 3000, message: "api late" },
          { eventId: "2", timestamp: 1000, message: "api early" },
        ],
      })
      .on(FilterLogEventsCommand, {
        logGroupName: "/aws/lambda/wraps-selfhost-worker",
      })
      .resolves({
        events: [{ eventId: "3", timestamp: 2000, message: "worker middle" }],
      });

    const entries = await fetchLogs({
      region: REGION,
      groups: [
        group(
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          "api"
        ),
        group("/aws/lambda/wraps-selfhost-worker", "workers"),
      ],
      startTime: 0,
    });

    expect(entries.map((e) => e.message)).toEqual([
      "api early",
      "worker middle",
      "api late",
    ]);
    expect(entries.map((e) => e.source)).toEqual(["api", "workers", "api"]);
  });

  // A redeploy can delete a group between discovery and fetch; the surviving
  // groups still have output worth showing.
  it("skips a group deleted mid-flight without failing the command", async () => {
    const notFound = Object.assign(new Error("The specified log group…"), {
      name: "ResourceNotFoundException",
      $metadata: { httpStatusCode: 400 },
    });
    logsMock
      .on(FilterLogEventsCommand, {
        logGroupName:
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
      })
      .resolves({ events: [{ eventId: "1", timestamp: 1, message: "alive" }] })
      .on(FilterLogEventsCommand, {
        logGroupName: "/aws/lambda/wraps-selfhost-gone",
      })
      .rejects(notFound);

    const entries = await fetchLogs({
      region: REGION,
      groups: [
        group(
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          "api"
        ),
        group("/aws/lambda/wraps-selfhost-gone", "workers"),
      ],
      startTime: 0,
    });

    expect(entries.map((e) => e.message)).toEqual(["alive"]);
  });

  it("passes the filter pattern through to CloudWatch", async () => {
    logsMock.on(FilterLogEventsCommand).resolves({ events: [] });

    await fetchLogs({
      region: REGION,
      groups: [
        group(
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          "api"
        ),
      ],
      startTime: 0,
      filterPattern: "?ERROR",
    });

    expect(
      logsMock.commandCalls(FilterLogEventsCommand)[0].args[0].input
    ).toMatchObject({ filterPattern: "?ERROR" });
  });
});

describe("createLogPoller", () => {
  beforeEach(() => {
    logsMock.reset();
  });

  it("re-reads a window that overlaps the previous poll", async () => {
    logsMock.on(FilterLogEventsCommand).resolves({ events: [] });
    const poll = createLogPoller({
      region: REGION,
      groups: [
        group(
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          "api"
        ),
      ],
      since: 100_000,
      now: () => 200_000,
    });

    await poll();
    await poll();

    const calls = logsMock.commandCalls(FilterLogEventsCommand);
    // First window reaches back before `since`; the second reaches back before
    // the first tick's start — CloudWatch makes events visible out of order, so
    // a non-overlapping window would drop late arrivals permanently.
    expect(calls[0].args[0].input.startTime).toBe(85_000);
    expect(calls[1].args[0].input.startTime).toBe(185_000);
  });

  // The overlap guarantees repeats, so dedupe is what makes it correct rather
  // than an optimization.
  it("suppresses events already returned by an earlier poll", async () => {
    logsMock
      .on(FilterLogEventsCommand)
      .resolvesOnce({
        events: [
          { eventId: "a", timestamp: 1000, message: "first" },
          { eventId: "b", timestamp: 2000, message: "second" },
        ],
      })
      .resolvesOnce({
        events: [
          { eventId: "b", timestamp: 2000, message: "second" },
          { eventId: "c", timestamp: 3000, message: "third" },
        ],
      });

    const poll = createLogPoller({
      region: REGION,
      groups: [
        group(
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          "api"
        ),
      ],
      since: 0,
      now: () => 10_000,
    });

    expect((await poll()).map((e) => e.message)).toEqual(["first", "second"]);
    expect((await poll()).map((e) => e.message)).toEqual(["third"]);
  });

  it("falls back to a composite key when AWS omits eventId", async () => {
    logsMock
      .on(FilterLogEventsCommand)
      .resolvesOnce({ events: [{ timestamp: 1000, message: "dup" }] })
      .resolvesOnce({
        events: [
          { timestamp: 1000, message: "dup" },
          { timestamp: 2000, message: "new" },
        ],
      });

    const poll = createLogPoller({
      region: REGION,
      groups: [
        group(
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          "api"
        ),
      ],
      since: 0,
      now: () => 10_000,
    });

    await poll();
    expect((await poll()).map((e) => e.message)).toEqual(["new"]);
  });

  it("interleaves fresh events from multiple groups by timestamp", async () => {
    logsMock
      .on(FilterLogEventsCommand, {
        logGroupName:
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
      })
      .resolves({
        events: [{ eventId: "a", timestamp: 3000, message: "api" }],
      })
      .on(FilterLogEventsCommand, {
        logGroupName: "/aws/lambda/wraps-selfhost-worker",
      })
      .resolves({
        events: [{ eventId: "w", timestamp: 1000, message: "worker" }],
      });

    const poll = createLogPoller({
      region: REGION,
      groups: [
        group(
          "/aws/lambda/wraps-selfhost-production-SelfhostApiFunction-abc12345",
          "api"
        ),
        group("/aws/lambda/wraps-selfhost-worker", "workers"),
      ],
      since: 0,
      now: () => 10_000,
    });

    expect((await poll()).map((e) => e.message)).toEqual(["worker", "api"]);
  });
});
