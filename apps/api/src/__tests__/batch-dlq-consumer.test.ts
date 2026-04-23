/**
 * Batch DLQ Consumer Tests
 *
 * After SQS exhausts its 3 retries, failed batch jobs land in the DLQ.
 * The consumer reads batchSend.lastChunkIndex/lastCursor to compute where
 * to resume and re-enqueues the next chunk. Must never throw — there is no
 * DLQ-of-DLQ to catch thrown errors.
 */

import type { SQSEvent } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSQSEvent(...bodies: unknown[]): SQSEvent {
  return {
    Records: bodies.map((body, i) => ({
      messageId: `msg-${i}`,
      receiptHandle: `rh-${i}`,
      body: typeof body === "string" ? body : JSON.stringify(body),
      attributes: {
        ApproximateReceiveCount: "4",
        SentTimestamp: "0",
        SenderId: "test",
        ApproximateFirstReceiveTimestamp: "0",
      },
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:000:batch-dlq",
      awsRegion: "us-east-1",
    })),
  };
}

function selectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const sqsSendCalls: Array<Record<string, unknown>> = [];

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn().mockImplementation((cmd: { input: unknown }) => {
      sqsSendCalls.push(cmd.input as Record<string, unknown>);
      return Promise.resolve({});
    });
  },
  SendMessageCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const updateSetCalls: Record<string, unknown>[] = [];
const updateWhereCalls: unknown[] = [];

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
  return {
    ...actual,
    db: {
      select: mockDbSelect,
      update: mockDbUpdate,
    },
    sql: (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      sql: strings.join("?"),
    }),
  };
});

const logInfo = vi.fn();
const logWarn = vi.fn();
const logError = vi.fn();
vi.mock("../lib/logger", () => ({
  log: { info: logInfo, warn: logWarn, error: logError },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

process.env.BATCH_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/batch-queue";

const { handler } = await import("../workers/batch-dlq-consumer");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockBatchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    organizationId: "org-1",
    awsAccountId: "aws-1",
    channel: "email",
    status: "processing",
    totalRecipients: 1000,
    processedRecipients: 250,
    lastChunkIndex: 4,
    lastCursor: { createdAt: "2026-01-15T12:00:00.000Z", id: "contact-250" },
    errorDetails: null,
    ...overrides,
  };
}

function mockUpdateCapture() {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
      updateSetCalls.push(values);
      return {
        where: vi.fn().mockImplementation((clause: unknown) => {
          updateWhereCalls.push(clause);
          return Promise.resolve(undefined);
        }),
      };
    }),
  });
}

const baseBody = {
  batchId: "batch-1",
  organizationId: "org-1",
  awsAccountId: "aws-1",
  channel: "email",
  chunkIndex: 5,
  cursor: { createdAt: "2026-01-15T12:00:00.000Z", id: "contact-250" },
};

beforeEach(() => {
  vi.clearAllMocks();
  sqsSendCalls.length = 0;
  updateSetCalls.length = 0;
  updateWhereCalls.length = 0;
  logInfo.mockReset();
  logWarn.mockReset();
  logError.mockReset();
  process.env.BATCH_QUEUE_URL =
    "https://sqs.us-east-1.amazonaws.com/batch-queue";
  delete process.env.BROADCAST_DLQ_CONSUMER_ENABLED;
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 10 (tracer): resume from durable heartbeat, not SQS body cursor
// ─────────────────────────────────────────────────────────────────────────────

describe("DLQ consumer — resume from lastChunkIndex/lastCursor", () => {
  it("re-enqueues chunkIndex = lastChunkIndex + 1 with lastCursor, and appends chunksFailed audit", async () => {
    mockDbSelect.mockReturnValue(selectChain([mockBatchRow()]));
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    // Note: body's chunkIndex is 5 (the failed chunk). DLQ body is NOT
    // the source of truth — batch.lastChunkIndex is (which is 4). So
    // resume happens at chunkIndex 5 with batch.lastCursor (contact-250).
    // In this specific case both point at the same place; the test for
    // the difference lives in Unit 11.
    await handler(makeSQSEvent(baseBody), {} as never, () => {});

    expect(sqsSendCalls).toHaveLength(1);
    const body = JSON.parse(sqsSendCalls[0].MessageBody as string) as Record<
      string,
      unknown
    >;

    expect(body).toMatchObject({
      batchId: "batch-1",
      organizationId: "org-1",
      awsAccountId: "aws-1",
      channel: "email",
      chunkIndex: 5, // lastChunkIndex (4) + 1
      cursor: { createdAt: "2026-01-15T12:00:00.000Z", id: "contact-250" },
    });

    // Audit trail: errorDetails.chunksFailed appended
    const errorUpdate = updateSetCalls.find((c) => "errorDetails" in c);
    expect(errorUpdate).toBeDefined();
    const details = errorUpdate?.errorDetails as {
      chunksFailed?: Array<Record<string, unknown>>;
    };
    expect(details?.chunksFailed).toBeDefined();
    expect(details?.chunksFailed?.[0]).toMatchObject({
      failedChunkIndex: 5,
      reason: "SQS DLQ",
    });
  });

  it("uses DB lastCursor, not body.cursor (body is chunk N's INPUT, not N-1's output)", async () => {
    // Body says chunk 5 started from contact-100.
    // But the DB says lastChunkIndex=4 ended at contact-250.
    // DLQ consumer should trust the DB — the heartbeat pointer — and
    // re-enqueue chunk 5 with cursor=contact-250, NOT body.cursor.
    const bodyCursor = {
      createdAt: "2026-01-15T10:00:00.000Z",
      id: "contact-100",
    };
    const dbCursor = {
      createdAt: "2026-01-15T12:00:00.000Z",
      id: "contact-250",
    };
    mockDbSelect.mockReturnValue(
      selectChain([mockBatchRow({ lastCursor: dbCursor })])
    );
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    await handler(
      makeSQSEvent({ ...baseBody, chunkIndex: 5, cursor: bodyCursor }),
      {} as never,
      () => {}
    );

    expect(sqsSendCalls).toHaveLength(1);
    const body = JSON.parse(sqsSendCalls[0].MessageBody as string) as Record<
      string,
      unknown
    >;
    expect(body.cursor).toEqual(dbCursor);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 11: first-chunk failure semantics
// ─────────────────────────────────────────────────────────────────────────────

describe("DLQ consumer — first chunk failure (lastChunkIndex null)", () => {
  it("re-enqueues chunkIndex 0 with cursor=undefined when no chunk has completed", async () => {
    mockDbSelect.mockReturnValue(
      selectChain([mockBatchRow({ lastChunkIndex: null, lastCursor: null })])
    );
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    await handler(
      makeSQSEvent({ ...baseBody, chunkIndex: 0, cursor: undefined }),
      {} as never,
      () => {}
    );

    expect(sqsSendCalls).toHaveLength(1);
    const body = JSON.parse(sqsSendCalls[0].MessageBody as string) as Record<
      string,
      unknown
    >;
    expect(body.chunkIndex).toBe(0);
    // cursor must not be null — it must be undefined (omitted) so the
    // worker treats it as a fresh scan.
    expect(body.cursor).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 12 + 19: malformed JSON + multi-record resilience
// ─────────────────────────────────────────────────────────────────────────────

describe("DLQ consumer — never throws", () => {
  it("logs error and continues on malformed body", async () => {
    mockDbSelect.mockReturnValue(selectChain([mockBatchRow()]));
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    const event = makeSQSEvent(
      "not-valid-json{",
      baseBody // second record is valid
    );

    await expect(
      handler(event, {} as never, () => {})
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalled();
    // Second record should still have been processed
    expect(sqsSendCalls).toHaveLength(1);
  });

  it("processes all healthy records when the middle one is malformed (10-record batch)", async () => {
    // 10 records, index 5 is malformed
    const bodies: unknown[] = [];
    for (let i = 0; i < 10; i++) {
      bodies.push(i === 5 ? "garbage{" : { ...baseBody, chunkIndex: i + 5 });
    }

    mockDbSelect.mockReturnValue(selectChain([mockBatchRow()]));
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    await handler(makeSQSEvent(...bodies), {} as never, () => {});

    // 9 healthy records all produced an enqueue
    expect(sqsSendCalls).toHaveLength(9);
    expect(logError).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Units 13-16: guards
// ─────────────────────────────────────────────────────────────────────────────

describe("DLQ consumer — guards", () => {
  it("does not enqueue for a terminal-status batch", async () => {
    for (const status of ["completed", "cancelled", "failed"] as const) {
      vi.clearAllMocks();
      sqsSendCalls.length = 0;
      mockDbSelect.mockReturnValue(selectChain([mockBatchRow({ status })]));
      mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

      await handler(makeSQSEvent(baseBody), {} as never, () => {});

      expect(sqsSendCalls, `status=${status} must skip`).toHaveLength(0);
    }
  });

  it("does not enqueue when the batch row is missing", async () => {
    mockDbSelect.mockReturnValue(selectChain([]));
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    await handler(makeSQSEvent(baseBody), {} as never, () => {});

    expect(sqsSendCalls).toHaveLength(0);
    expect(logWarn).toHaveBeenCalled();
  });

  it("does not enqueue when processedRecipients >= totalRecipients", async () => {
    mockDbSelect.mockReturnValue(
      selectChain([
        mockBatchRow({ processedRecipients: 1000, totalRecipients: 1000 }),
      ])
    );
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    await handler(makeSQSEvent(baseBody), {} as never, () => {});

    expect(sqsSendCalls).toHaveLength(0);
  });

  it("does not enqueue when batch.awsAccountId is null (DB-side truth)", async () => {
    mockDbSelect.mockReturnValue(
      selectChain([mockBatchRow({ awsAccountId: null })])
    );
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    // Note: body still has awsAccountId (it's from the original enqueue).
    // The consumer must trust the DB, not the body.
    await handler(makeSQSEvent(baseBody), {} as never, () => {});

    expect(sqsSendCalls).toHaveLength(0);
    expect(logWarn).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 17: cross-org safety
// ─────────────────────────────────────────────────────────────────────────────

describe("DLQ consumer — cross-org safety", () => {
  it("exits without enqueue when the org-scoped SELECT returns no row", async () => {
    // Body has organizationId: 'org-evil' that doesn't match any batch.
    mockDbSelect.mockReturnValue(selectChain([]));
    mockDbUpdate.mockImplementation(() => mockUpdateCapture()());

    await handler(
      makeSQSEvent({ ...baseBody, organizationId: "org-evil" }),
      {} as never,
      () => {}
    );

    expect(sqsSendCalls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit 18: kill switch
// ─────────────────────────────────────────────────────────────────────────────

describe("DLQ consumer — kill switch", () => {
  it("returns early when BROADCAST_DLQ_CONSUMER_ENABLED=false (no DB or SQS calls)", async () => {
    process.env.BROADCAST_DLQ_CONSUMER_ENABLED = "false";

    await handler(makeSQSEvent(baseBody), {} as never, () => {});

    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(sqsSendCalls).toHaveLength(0);
    expect(logInfo).toHaveBeenCalledWith(
      expect.stringContaining("broadcast.dlq.disabled"),
      expect.anything()
    );
  });
});
