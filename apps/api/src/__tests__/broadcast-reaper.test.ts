/**
 * Broadcast Reaper Tests
 *
 * `runBroadcastReaper(db, { enqueue })` revives broadcasts whose chunk chain
 * died in transit — the failure mode reproduced on 2026-07-31, where the
 * batch queue's event source mapping received the next chunk but never got a
 * Lambda concurrency slot to invoke it.
 *
 * The mock DB returns whatever rows the test seeds, without applying the SQL
 * WHERE clause. That is deliberate: it forces the assertions to be about what
 * the reaper DOES with a row (resume point, audit entry, skip conditions),
 * which is the part that can silently regress. The SQL-level filtering
 * (status, pausedReason, staleness) is asserted separately by inspecting the
 * generated predicate.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.BATCH_QUEUE_URL =
  "https://sqs.us-east-1.amazonaws.com/123456789/mock-queue";

vi.mock("../lib/sentry", () => ({}));
vi.mock("@sentry/aws-serverless", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  wrapHandler: (fn: unknown) => fn,
}));
vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

const { captureMessage } = await import("@sentry/aws-serverless");
const { BROADCAST_STALL_THRESHOLD_MS, runBroadcastReaper } = await import(
  "../workers/broadcast-reaper"
);

type Row = {
  id: string;
  organizationId: string;
  awsAccountId: string | null;
  channel: string;
  lastChunkIndex: number | null;
  lastCursor: { id: string } | null;
  processedRecipients: number;
  totalRecipients: number;
  errorDetails: Record<string, unknown> | null;
};

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "batch-1",
    organizationId: "org-1",
    awsAccountId: "aws-1",
    channel: "email",
    lastChunkIndex: 15,
    lastCursor: { id: "contact-800" },
    processedRecipients: 800,
    totalRecipients: 1200,
    errorDetails: null,
    ...overrides,
  };
}

function makeMockDb(rows: Row[]) {
  const updates: Array<Record<string, unknown>> = [];
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
        updates.push(values);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    }),
  };
  return { mockDb, updates };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runBroadcastReaper", () => {
  it("resumes from the durable heartbeat, not from chunk 0", async () => {
    const { mockDb } = makeMockDb([makeRow()]);
    const enqueue = vi.fn().mockResolvedValue(undefined);

    const result = await runBroadcastReaper(mockDb as never, { enqueue });

    expect(result.reaped).toBe(1);
    // lastChunkIndex 15 completed, so the chain must pick up at 16 carrying
    // that chunk's output cursor. Resuming at 0 would re-send the whole
    // audience; dropping the cursor would re-scan from the first contact.
    expect(enqueue).toHaveBeenCalledWith({
      batchId: "batch-1",
      organizationId: "org-1",
      awsAccountId: "aws-1",
      channel: "email",
      chunkIndex: 16,
      cursor: { id: "contact-800" },
    });
  });

  it("resumes at chunk 0 with no cursor when no chunk ever completed", async () => {
    const { mockDb } = makeMockDb([
      makeRow({
        lastChunkIndex: null,
        lastCursor: null,
        processedRecipients: 0,
      }),
    ]);
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await runBroadcastReaper(mockDb as never, { enqueue });

    // Off-by-one guard: null must mean "start at 0", never "start at 1".
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ chunkIndex: 0, cursor: undefined })
    );
  });

  it("skips a batch that already covered its audience", async () => {
    const { mockDb } = makeMockDb([
      makeRow({ processedRecipients: 1200, totalRecipients: 1200 }),
    ]);
    const enqueue = vi.fn().mockResolvedValue(undefined);

    const result = await runBroadcastReaper(mockDb as never, { enqueue });

    // It owes a terminal status, not another chunk — enqueueing here would
    // spin a chain that immediately finds no contacts.
    expect(enqueue).not.toHaveBeenCalled();
    expect(result.reaped).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("skips a batch with no awsAccountId rather than enqueueing an unusable job", async () => {
    const { mockDb } = makeMockDb([makeRow({ awsAccountId: null })]);
    const enqueue = vi.fn().mockResolvedValue(undefined);

    const result = await runBroadcastReaper(mockDb as never, { enqueue });

    expect(enqueue).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("writes the audit entry BEFORE enqueueing", async () => {
    const order: string[] = [];
    const rows = [makeRow()];
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(() => {
          order.push("audit");
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      }),
    };
    const enqueue = vi.fn().mockImplementation(() => {
      order.push("enqueue");
      return Promise.resolve();
    });

    await runBroadcastReaper(mockDb as never, { enqueue });

    // If the enqueue landed first and the process died, the chain would be
    // revived with no record of why.
    expect(order).toEqual(["audit", "enqueue"]);
  });

  it("appends to chunksReaped without discarding prior entries or other errorDetails", async () => {
    const { mockDb, updates } = makeMockDb([
      makeRow({
        errorDetails: {
          chunksFailed: [{ failedChunkIndex: 3 }],
          chunksReaped: [{ reapedChunkIndex: 8, at: "x", reason: "y" }],
        },
      }),
    ]);
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await runBroadcastReaper(mockDb as never, { enqueue });

    const details = updates[0].errorDetails as Record<string, unknown>;
    // The DLQ consumer's audit trail lives in the same column — clobbering it
    // would erase the evidence that a chunk dead-lettered.
    expect(details.chunksFailed).toEqual([{ failedChunkIndex: 3 }]);
    expect(details.chunksReaped).toHaveLength(2);
    expect(
      (details.chunksReaped as Array<{ reapedChunkIndex: number }>)[1]
    ).toMatchObject({ reapedChunkIndex: 16 });
  });

  it("escalates to Sentry once a batch has been reaped repeatedly", async () => {
    const { mockDb } = makeMockDb([
      makeRow({
        errorDetails: {
          chunksReaped: [{ reapedChunkIndex: 8 }, { reapedChunkIndex: 12 }],
        },
      }),
    ]);
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await runBroadcastReaper(mockDb as never, { enqueue });

    // Repeat reaps mean the underlying starvation is still there; reviving
    // forever without surfacing it is how this stayed invisible for weeks.
    expect(captureMessage).toHaveBeenCalledWith(
      "Broadcast repeatedly stalled and reaped",
      expect.objectContaining({ level: "warning" })
    );
  });

  it("does not escalate on a first-time reap", async () => {
    const { mockDb } = makeMockDb([makeRow()]);
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await runBroadcastReaper(mockDb as never, { enqueue });

    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("continues the sweep when one batch throws", async () => {
    const { mockDb } = makeMockDb([
      makeRow({ id: "batch-bad" }),
      makeRow({ id: "batch-good" }),
    ]);
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error("SQS unavailable"))
      .mockResolvedValue(undefined);

    const result = await runBroadcastReaper(mockDb as never, { enqueue });

    // The remaining batches are still stalled — one bad row must not strand
    // every broadcast behind it.
    expect(result.reaped).toBe(1);
    expect(result.skipped).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("keeps the stall threshold clear of the DLQ recovery path", () => {
    // A wedged message needs maxReceiveCount(3) x visibilityTimeout(300s) =
    // 15 min to reach the DLQ, where batch-dlq-consumer revives it. Reaping
    // sooner would double-enqueue the same chunk. Lowering this constant
    // without raising that margin reintroduces the race.
    const dlqRecoveryCeilingMs = 3 * 300 * 1000;
    expect(BROADCAST_STALL_THRESHOLD_MS).toBeGreaterThan(dlqRecoveryCeilingMs);
  });
});
