/**
 * Batch Sender Self-Reschedule Tests
 *
 * When Lambda remaining time dips below the safety floor, the worker
 * re-enqueues the current chunk instead of racing the timeout. Tests cover
 * the ordering (cancelled / unsupported-channel short-circuit FIRST so a
 * cancelled batch can't self-reschedule forever), the receive-count loop
 * guard, and the re-enqueued job body shape.
 */

import type { SQSEvent } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeMockContext,
  makeSqsRecordAttributes,
} from "./__helpers__/lambda-context";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const sqsSendCalls: Array<{ MessageBody: string; DelaySeconds?: number }> = [];
const sesSendCalls: unknown[][] = [];

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn().mockImplementation((cmd: unknown) => {
      sesSendCalls.push([cmd]);
      return Promise.resolve({
        SendQuota: { MaxSendRate: 14 },
        BulkEmailEntryResults: [{ Status: "SUCCESS", MessageId: "m-1" }],
      });
    });
  },
  GetAccountCommand: class {
    constructor(public input: unknown) {}
  },
  SendBulkEmailCommand: class {
    constructor(public input: unknown) {}
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn().mockImplementation((cmd: { input: unknown }) => {
      sqsSendCalls.push(
        cmd.input as { MessageBody: string; DelaySeconds?: number }
      );
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

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("plain text"),
}));

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIA",
    secretAccessKey: "secret",
    sessionToken: "token",
    expiration: new Date("2099-01-01"),
    region: "us-east-1",
  }),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockResolvedValue("tok"),
}));

const logWarn = vi.fn();
const logInfo = vi.fn();
const logError = vi.fn();
vi.mock("../lib/logger", () => ({
  log: { info: logInfo, warn: logWarn, error: logError },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./variable-mappings", () => ({
  applyVariableMappings: vi
    .fn()
    .mockImplementation((data: Record<string, string>) => data),
}));

// DB mock — single batch row returned by the scoped SELECT. Everything else
// is short-circuited by either the cancelled/unsupported/self-reschedule
// checks or by returning no contacts.
let batchResultFactory: () => unknown[] = () => [
  {
    id: "batch-1",
    organizationId: "org-1",
    status: "processing",
    audienceType: "all",
    topicId: null,
    segmentId: null,
    emailTemplateId: null,
    from: "ok@example.com",
    fromName: "Ok",
    replyTo: null,
    subject: "Hi",
    htmlContent: "<p>Hello</p>",
    totalRecipients: 100,
    processedRecipients: 0,
    sent: 0,
    failed: 0,
    variableMappings: null,
  },
];

let contactsFactory: () => unknown[] = () => [];

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");

  function getTableName(table: unknown): string {
    if (
      table &&
      typeof table === "object" &&
      Symbol.for("drizzle:Name") in table
    ) {
      return (table as Record<symbol, string>)[Symbol.for("drizzle:Name")];
    }
    if (typeof table === "object" && table !== null && "_" in table) {
      return (table as { _: { name: string } })._.name;
    }
    return "unknown";
  }

  function thenable(rows: unknown[]) {
    return {
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve(rows).then(resolve),
      limit: vi.fn().mockImplementation(() => thenable(rows)),
      orderBy: vi.fn().mockImplementation(() => thenable(rows)),
    };
  }

  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table: unknown) => {
          const name = getTableName(table);
          if (name === "batch_send") {
            return {
              where: vi
                .fn()
                .mockImplementation(() => thenable(batchResultFactory())),
            };
          }
          if (name === "contact") {
            return {
              where: vi
                .fn()
                .mockImplementation(() => thenable(contactsFactory())),
            };
          }
          if (name === "message_send") {
            return {
              where: vi.fn().mockImplementation(() => thenable([])),
            };
          }
          if (name === "organization") {
            return {
              where: vi
                .fn()
                .mockImplementation(() => thenable([{ name: "Test Org" }])),
            };
          }
          return {
            where: vi.fn().mockImplementation(() => thenable([])),
          };
        }),
      })),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
      }),
    },
    sql: (...args: unknown[]) => args,
  };
});

process.env.BATCH_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue";

const { handler } = await import("../workers/batch-sender");

function makeEvent(
  job: Record<string, unknown>,
  opts: { receiveCount?: number } = {}
): SQSEvent {
  return {
    Records: [
      {
        body: JSON.stringify(job),
        messageId: "msg-1",
        receiptHandle: "handle-1",
        attributes: makeSqsRecordAttributes({
          ApproximateReceiveCount: String(opts.receiveCount ?? 1),
        }),
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:queue",
        awsRegion: "us-east-1",
      },
    ],
  };
}

const baseJob = {
  batchId: "batch-1",
  organizationId: "org-1",
  awsAccountId: "aws-1",
  channel: "email",
  chunkIndex: 3,
  cursor: { createdAt: "2026-01-15T10:00:00.000Z", id: "contact-500" },
};

describe("batch-sender self-reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqsSendCalls.length = 0;
    sesSendCalls.length = 0;
    logWarn.mockReset();
    logInfo.mockReset();
    logError.mockReset();
    process.env.BATCH_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue";
    contactsFactory = () => [];
    batchResultFactory = () => [
      {
        id: "batch-1",
        organizationId: "org-1",
        status: "processing",
        audienceType: "all",
        topicId: null,
        segmentId: null,
        emailTemplateId: null,
        from: "ok@example.com",
        fromName: "Ok",
        replyTo: null,
        subject: "Hi",
        htmlContent: "<p>Hello</p>",
        totalRecipients: 100,
        processedRecipients: 0,
        sent: 0,
        failed: 0,
        variableMappings: null,
      },
    ];
  });

  it("re-enqueues the same chunk when remaining time is below the 45s floor", async () => {
    // Tracer: unit 4.
    const event = makeEvent(baseJob);
    await handler(event, makeMockContext({ remainingMs: 30_000 }), () => {});

    expect(sqsSendCalls).toHaveLength(1);
    const body = JSON.parse(sqsSendCalls[0].MessageBody) as Record<
      string,
      unknown
    >;
    expect(body.chunkIndex).toBe(3); // SAME chunk, not next
    expect(body.cursor).toEqual(baseJob.cursor); // preserve cursor
    expect(sqsSendCalls[0].DelaySeconds).toBe(10);

    // Must NOT have called SES — the handler bailed out
    expect(sesSendCalls).toHaveLength(0);
    // self-reschedule log emitted
    expect(logInfo).toHaveBeenCalledWith(
      "broadcast.self_reschedule",
      expect.objectContaining({ batchId: "batch-1", chunkIndex: 3 })
    );
  });

  it("logs a loop warning and processes anyway when receive count > 2", async () => {
    // Unit 5: loop guard.
    contactsFactory = () => []; // no contacts → completes cleanly without SES
    const event = makeEvent(baseJob, { receiveCount: 3 });

    await handler(event, makeMockContext({ remainingMs: 30_000 }), () => {});

    expect(logWarn).toHaveBeenCalledWith(
      "broadcast.self_reschedule.suspected_loop",
      expect.objectContaining({
        batchId: "batch-1",
        chunkIndex: 3,
        receiveCount: 3,
      })
    );
    // NO re-enqueue while under loop guard
    expect(sqsSendCalls).toHaveLength(0);
  });

  it("proceeds normally when remaining time is above the floor", async () => {
    // Unit 6.
    const event = makeEvent(baseJob);
    await handler(event, makeMockContext({ remainingMs: 120_000 }), () => {});

    // No self-reschedule log and no re-enqueue of the SAME chunk index
    expect(logInfo).not.toHaveBeenCalledWith(
      "broadcast.self_reschedule",
      expect.anything()
    );
    const selfReschedule = sqsSendCalls.find((c) => {
      const b = JSON.parse(c.MessageBody);
      return b.chunkIndex === baseJob.chunkIndex;
    });
    expect(selfReschedule).toBeUndefined();
  });

  it("preserves full job body shape when re-enqueueing (org/aws/channel/cursor/chunkIndex)", async () => {
    // Unit 7.
    const event = makeEvent(baseJob);
    await handler(event, makeMockContext({ remainingMs: 20_000 }), () => {});

    expect(sqsSendCalls).toHaveLength(1);
    const body = JSON.parse(sqsSendCalls[0].MessageBody) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      batchId: baseJob.batchId,
      organizationId: baseJob.organizationId,
      awsAccountId: baseJob.awsAccountId,
      channel: baseJob.channel,
      chunkIndex: baseJob.chunkIndex,
      cursor: baseJob.cursor,
    });
  });

  it("does NOT self-reschedule a cancelled batch (cancel check runs first)", async () => {
    // Unit 8: ordering guarantee.
    batchResultFactory = () => [
      {
        id: "batch-1",
        organizationId: "org-1",
        status: "cancelled",
        audienceType: "all",
        topicId: null,
        segmentId: null,
        emailTemplateId: null,
        from: "ok@example.com",
        fromName: "Ok",
        replyTo: null,
        subject: "Hi",
        htmlContent: "<p>Hello</p>",
        totalRecipients: 100,
        processedRecipients: 0,
        sent: 0,
        failed: 0,
        variableMappings: null,
      },
    ];

    const event = makeEvent(baseJob);
    await handler(event, makeMockContext({ remainingMs: 20_000 }), () => {});

    // The cancelled path short-circuits: zero SQS sends even though we're
    // under the self-reschedule floor.
    expect(sqsSendCalls).toHaveLength(0);
    // No self-reschedule log
    expect(logInfo).not.toHaveBeenCalledWith(
      "broadcast.self_reschedule",
      expect.anything()
    );
  });
});

describe("batch-sender worker load org scoping (unit 9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqsSendCalls.length = 0;
    sesSendCalls.length = 0;
    logWarn.mockReset();
    logInfo.mockReset();
    logError.mockReset();
    contactsFactory = () => [];
  });

  it("exits when the scoped SELECT returns no row (cross-org or deleted batch)", async () => {
    // Simulate: the (id, organizationId) WHERE clause returns no match.
    batchResultFactory = () => [];

    const event = makeEvent(baseJob);
    await handler(event, makeMockContext(), () => {});

    // No SES call, no re-enqueue, no UPDATE — the handler logged and exited
    expect(sesSendCalls).toHaveLength(0);
    expect(sqsSendCalls).toHaveLength(0);
    expect(logError).toHaveBeenCalledWith(
      "Batch not found",
      undefined,
      expect.objectContaining({ batchId: "batch-1" })
    );
  });
});
