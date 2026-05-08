/**
 * Broadcast Scale Integration Test
 *
 * Tests the batch-sender worker at scale by invoking the handler directly
 * in-process — no SST dev or Lambda infrastructure required.
 *
 * The key difference from broadcast-smoke.integration.test.ts:
 *   - `getCredentials` is mocked to use env credentials (no STS AssumeRole)
 *   - SQS is mocked — the test drives the chunk loop itself
 *   - The handler is imported and called directly in-process
 *   - Real DB writes + real SES calls (SES mailbox simulator)
 *
 * AUTO-SKIPS unless RUN_BROADCAST_SMOKE=1. This is an explicit opt-in
 * because it requires a verified SES identity and AWS credentials with
 * SES:SendEmail permission.
 *
 * Required env vars:
 *   RUN_BROADCAST_SMOKE=1                  — opt-in flag
 *   BROADCAST_SMOKE_AWS_ACCOUNT_ID=<uuid>  — aws_account row id in dev DB
 *   BROADCAST_SMOKE_SENDER=<email>         — verified SES identity
 *
 * Optional env vars:
 *   BROADCAST_SMOKE_REGION=us-east-1       — default: us-east-1
 *   BROADCAST_SMOKE_CONTACT_COUNT=500      — default: 500
 *
 * Run it:
 *   RUN_BROADCAST_SMOKE=1 \
 *   BROADCAST_SMOKE_AWS_ACCOUNT_ID=<id> \
 *   BROADCAST_SMOKE_SENDER=<verified@domain.com> \
 *   AWS_PROFILE=<your-profile> \
 *     pnpm --filter @wraps/api test:integration -- \
 *       src/__tests__/broadcast-scale.integration.test.ts
 */

import { createHash } from "node:crypto";
import { awsAccount, batchSend, contact, db, messageSend } from "@wraps/db";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { BatchJob } from "../services/queue";
import { makeMockContext } from "./__helpers__/lambda-context";

// Required by the worker at module load time — must be set before import
process.env.BATCH_QUEUE_URL =
  "https://sqs.us-east-1.amazonaws.com/123456789/mock-queue";

// ---------------------------------------------------------------------------
// Mocks — must be declared before handler import (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockImplementation(async () => ({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    sessionToken: process.env.AWS_SESSION_TOKEN ?? "",
    expiration: new Date(Date.now() + 3_600_000),
    region:
      process.env.BROADCAST_SMOKE_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      process.env.AWS_REGION ??
      "us-east-1",
  })),
}));

const sqsCapture: unknown[] = [];
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn().mockImplementation((cmd: { input?: unknown }) => {
      sqsCapture.push(cmd.input ?? cmd);
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

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockResolvedValue("smoke-token"),
}));

vi.mock("../lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("scale test plain text"),
}));

vi.mock("./variable-mappings", () => ({
  applyVariableMappings: vi.fn().mockImplementation((data: unknown) => data),
}));

// ---------------------------------------------------------------------------
// Handler import (after mocks)
// ---------------------------------------------------------------------------

const { handler } = await import("../workers/batch-sender");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RUN_SMOKE = process.env.RUN_BROADCAST_SMOKE === "1";

const SMOKE_AWS_ACCOUNT_ID = process.env.BROADCAST_SMOKE_AWS_ACCOUNT_ID ?? "";
const BROADCAST_SMOKE_SENDER = process.env.BROADCAST_SMOKE_SENDER ?? "";
const CONTACT_COUNT = Number(process.env.BROADCAST_SMOKE_CONTACT_COUNT ?? 500);

const CHUNK_SIZE = 50;

// SES mailbox simulator mix — plus-addressed for uniqueness across runs
const SIMULATOR_MIX: Array<{ address: string; weight: number }> = [
  { address: "success@simulator.amazonses.com", weight: 0.9 },
  { address: "bounce@simulator.amazonses.com", weight: 0.05 },
  { address: "complaint@simulator.amazonses.com", weight: 0.03 },
  { address: "suppressionlist@simulator.amazonses.com", weight: 0.02 },
];

function pickAddress(rng: number): string {
  let acc = 0;
  for (const entry of SIMULATOR_MIX) {
    acc += entry.weight;
    if (rng < acc) return entry.address;
  }
  return SIMULATOR_MIX[0].address;
}

// ---------------------------------------------------------------------------
// SQS event helper
// ---------------------------------------------------------------------------

function makeSQSEvent(job: BatchJob) {
  return {
    Records: [
      {
        body: JSON.stringify(job),
        messageId: "smoke-msg-1",
        receiptHandle: "smoke-handle",
        attributes: {
          ApproximateReceiveCount: "1",
          SentTimestamp: "0",
          SenderId: "test",
          ApproximateFirstReceiveTimestamp: "0",
        } as never,
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:123:queue",
        awsRegion: "us-east-1",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Drive the chunk loop until batch reaches terminal status
// ---------------------------------------------------------------------------

type RunResult = {
  batch: typeof batchSend.$inferSelect;
  chunkCount: number;
  totalMs: number;
  chunkTimingsMs: number[];
};

async function runToCompletion(job: BatchJob): Promise<RunResult> {
  const maxIterations = Math.ceil(CONTACT_COUNT / CHUNK_SIZE) * 2;
  let currentJob = { ...job };
  let chunkCount = 0;
  const chunkTimingsMs: number[] = [];
  const overallStart = Date.now();

  for (let i = 0; i < maxIterations; i++) {
    const chunkStart = Date.now();
    await handler(
      makeSQSEvent(currentJob) as never,
      makeMockContext({ remainingMs: 120_000 }),
      vi.fn()
    );
    chunkTimingsMs.push(Date.now() - chunkStart);
    chunkCount++;

    const [row] = await db
      .select()
      .from(batchSend)
      .where(eq(batchSend.id, currentJob.batchId))
      .limit(1);

    if (!row) throw new Error(`batch_send row ${currentJob.batchId} not found`);

    if (row.status === "completed" || row.status === "failed") {
      return {
        batch: row,
        chunkCount,
        totalMs: Date.now() - overallStart,
        chunkTimingsMs,
      };
    }

    // Build next job using the cursor written by the worker
    currentJob = {
      ...currentJob,
      chunkIndex: (row.lastChunkIndex ?? -1) + 1,
      cursor: row.lastCursor ?? undefined,
    };
  }

  // Safety: read final state before failing
  const [row] = await db
    .select()
    .from(batchSend)
    .where(eq(batchSend.id, currentJob.batchId))
    .limit(1);

  throw new Error(
    `runToCompletion exceeded safety limit of ${maxIterations} iterations. ` +
      `Final status: ${row?.status ?? "unknown"}, processed: ${row?.processedRecipients ?? 0}/${CONTACT_COUNT}`
  );
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!RUN_SMOKE)(
  "Broadcast Scale (in-process handler, SES simulator, real DB)",
  () => {
    let organizationId: string;
    let batchId: string | null = null;
    const seededContactIds: string[] = [];
    const run = Date.now();

    beforeAll(async () => {
      if (!SMOKE_AWS_ACCOUNT_ID) {
        throw new Error(
          "BROADCAST_SMOKE_AWS_ACCOUNT_ID env var is required — set it to a connected aws_account row id from your dev DB."
        );
      }
      if (!BROADCAST_SMOKE_SENDER) {
        throw new Error(
          "BROADCAST_SMOKE_SENDER env var is required — set it to a verified SES identity."
        );
      }

      const [account] = await db
        .select()
        .from(awsAccount)
        .where(eq(awsAccount.id, SMOKE_AWS_ACCOUNT_ID))
        .limit(1);

      if (!account) {
        throw new Error(
          `aws_account row ${SMOKE_AWS_ACCOUNT_ID} not found. Connect an AWS account in the dashboard first.`
        );
      }
      organizationId = account.organizationId;

      // Seed contacts in batches of 500
      const rows = Array.from({ length: CONTACT_COUNT }, (_, i) => {
        const base = pickAddress(Math.random());
        const email = base.replace("@", `+smoke-${run}-${i}@`);
        return {
          organizationId,
          email,
          emailHash: createHash("sha256").update(email).digest("hex"),
          emailStatus: "active" as const,
          firstName: "Scale",
          lastName: `Test-${i}`,
          properties: { smokeRun: String(run) },
        };
      });

      const INSERT_CHUNK = 500;
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const inserted = await db
          .insert(contact)
          .values(rows.slice(i, i + INSERT_CHUNK))
          .returning({ id: contact.id });
        seededContactIds.push(...inserted.map((r) => r.id));
      }

      // Create the batch_send row directly
      const [batch] = await db
        .insert(batchSend)
        .values({
          organizationId,
          awsAccountId: SMOKE_AWS_ACCOUNT_ID,
          channel: "email",
          status: "queued",
          name: `Scale smoke ${run}`,
          subject: "Scale test",
          from: BROADCAST_SMOKE_SENDER,
          fromName: "Scale Test",
          audienceType: "all",
          totalRecipients: CONTACT_COUNT,
          htmlContent: "<p>Scale test {{contactFirstName}}</p>",
        })
        .returning();
      batchId = batch.id;
    }, 120_000);

    afterAll(async () => {
      // Best-effort cleanup — delete in correct FK order
      if (batchId) {
        await db
          .delete(messageSend)
          .where(eq(messageSend.batchSendId, batchId))
          .catch(() => {});
        await db
          .delete(batchSend)
          .where(eq(batchSend.id, batchId))
          .catch(() => {});
      }
      for (let i = 0; i < seededContactIds.length; i += 500) {
        await db
          .delete(contact)
          .where(inArray(contact.id, seededContactIds.slice(i, i + 500)))
          .catch(() => {});
      }
    }, 60_000);

    it(
      "completes a multi-chunk broadcast via direct handler invocation",
      async () => {
        if (!batchId) throw new Error("batchId not set — beforeAll failed");

        const job: BatchJob = {
          batchId,
          organizationId,
          awsAccountId: SMOKE_AWS_ACCOUNT_ID,
          channel: "email",
          chunkIndex: 0,
        };

        const { batch, chunkCount, totalMs, chunkTimingsMs } =
          await runToCompletion(job);

        // Print timing report (intentional console.log for a perf test)
        const sorted = [...chunkTimingsMs].sort((a, b) => a - b);
        const avgChunk =
          chunkTimingsMs.length > 0
            ? Math.round(
                chunkTimingsMs.reduce((s, v) => s + v, 0) /
                  chunkTimingsMs.length
              )
            : 0;
        const p50 = percentile(sorted, 50);
        const p95 = percentile(sorted, 95);
        const throughput =
          totalMs > 0 ? ((CONTACT_COUNT / totalMs) * 1000).toFixed(1) : "0";

        // biome-ignore lint/suspicious/noConsole: intentional perf report
        console.log(`
=== Broadcast Scale Results ===
Contacts:    ${CONTACT_COUNT}
Chunks:      ${chunkCount}
Total time:  ${(totalMs / 1000).toFixed(1)}s
Throughput:  ${throughput} emails/sec
Avg chunk:   ${avgChunk}ms  p50: ${p50}ms  p95: ${p95}ms
Sent:        ${batch.sent ?? 0}  Failed: ${batch.failed ?? 0}  Processed: ${batch.processedRecipients}
===============================`);

        const expectedChunkCount = Math.ceil(CONTACT_COUNT / CHUNK_SIZE);

        expect(batch.status).toBe("completed");
        expect(batch.processedRecipients).toBe(CONTACT_COUNT);
        expect((batch.sent ?? 0) + (batch.failed ?? 0)).toBe(CONTACT_COUNT);
        expect(chunkCount).toBe(expectedChunkCount);
        expect(batch.lastChunkIndex).toBe(expectedChunkCount - 1);
      },
      // Allow 10 minutes for large contact counts
      10 * 60_000
    );
  }
);
