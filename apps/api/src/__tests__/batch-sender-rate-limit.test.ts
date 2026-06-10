/**
 * Batch Sender — Per-Account SES Rate Limit
 *
 * The worker reads MaxSendRate from GetAccountCommand and uses it to calculate
 * the DelaySeconds on the next-chunk SQS message:
 *
 *   rateLimitDelay = ceil(CHUNK_SIZE / maxSendRate)
 *                  = ceil(50 / maxSendRate)
 *
 * This per-account value varies based on sending reputation and AWS limits.
 * New accounts get ~14 emails/sec; high-volume senders can be 200+.
 *
 * Tests:
 *   - Default new-account rate (14 eps) → 4s delay between chunks
 *   - High-volume account (200 eps) → 1s delay (minimum meaningful)
 *   - Mid-range account (25 eps) → 2s delay
 *   - GetAccount failure → falls back to DEFAULT_RATE_LIMIT (14 eps) → 4s
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockContext } from "./__helpers__/lambda-context";

// ─────────────────────────────────────────────────────────────────────────────
// SQS mock — captures DelaySeconds on outgoing chunk messages
// ─────────────────────────────────────────────────────────────────────────────

const sqsSendCalls: Array<{ MessageBody: string; DelaySeconds?: number }> = [];

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

// ─────────────────────────────────────────────────────────────────────────────
// SES mock — configurable MaxSendRate, or throws on GetAccount call
// ─────────────────────────────────────────────────────────────────────────────

let sesMaxSendRate: number | null = 14; // null = throw on GetAccount
let sesCallCount = 0;

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn().mockImplementation(() => {
      sesCallCount++;
      // Call 0 = GetAccountCommand
      if (sesCallCount === 1) {
        if (sesMaxSendRate === null) {
          return Promise.reject(new Error("GetAccount failed: network error"));
        }
        return Promise.resolve({
          SendQuota: { MaxSendRate: sesMaxSendRate },
        });
      }
      // Call 1+ = SendBulkEmailCommand
      return Promise.resolve({
        BulkEmailEntryResults: [
          { Status: "SUCCESS", MessageId: "msg-1" },
          { Status: "SUCCESS", MessageId: "msg-2" },
        ],
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

// ─────────────────────────────────────────────────────────────────────────────
// DB mock — bulk path select order (claim-before-send contract):
//   0: batch  1: contacts  2: aws account  3: template  4: org
// ─────────────────────────────────────────────────────────────────────────────

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
let mockClaimReturning: Array<{ contactId: string }> = [];

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");

  function thenable(rows: unknown[]) {
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve(rows).then(resolve),
      limit: vi.fn().mockImplementation(() => thenable(rows)),
      orderBy: vi.fn().mockImplementation(() => thenable(rows)),
    };
    return obj;
  }

  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => {
        const rows = selectResults[selectCallIndex] ?? [];
        selectCallIndex += 1;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => thenable(rows)),
          }),
        };
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockImplementation(() => Promise.resolve(mockClaimReturning)),
          }),
        }),
      }),
    },
    sql: (...args: unknown[]) => args,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Service mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIA-test",
    secretAccessKey: "secret-test",
    sessionToken: "token-test",
    expiration: new Date("2099-01-01"),
    region: "us-east-1",
  }),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("plain text"),
}));

vi.mock("./variable-mappings", () => ({
  applyVariableMappings: vi
    .fn()
    .mockImplementation((data: Record<string, string>) => data),
}));

process.env.BATCH_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue";

const { handler } = await import("../workers/batch-sender");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    organizationId: "org-1",
    status: "queued",
    audienceType: "all",
    topicId: null,
    segmentId: null,
    emailTemplateId: "tmpl-1",
    htmlContent: null,
    subject: "Rate Test",
    from: "sender@example.com",
    fromName: "Sender",
    replyTo: null,
    // Ensure more contacts remain so the worker enqueues a next chunk
    totalRecipients: 100,
    processedRecipients: 0,
    sent: 0,
    failed: 0,
    variableMappings: null,
    ...overrides,
  };
}

function makeContacts(count = 50) {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    email: `user${i}@example.com`,
    phone: null,
    firstName: `User${i}`,
    lastName: null,
    company: null,
    jobTitle: null,
    properties: {},
    createdAt: new Date("2026-01-15T10:00:00Z"),
  }));
}

function setupSelects() {
  // Claim INSERT returns all 50 contacts claimed
  mockClaimReturning = makeContacts(50).map((c) => ({ contactId: c.id }));
  selectResults = [
    [makeBatch()],
    makeContacts(50),
    [{}], // aws account features
    [
      {
        sesTemplateName: "wraps-tmpl-1",
        compiledHtml: null,
        emailType: "marketing",
      },
    ],
    [{ name: "Test Org" }],
  ];
}

function makeSQSEvent() {
  return {
    Records: [
      {
        body: JSON.stringify({
          batchId: "batch-1",
          organizationId: "org-1",
          awsAccountId: "aws-1",
          channel: "email",
          chunkIndex: 0,
        }),
        messageId: "sqs-msg-1",
        receiptHandle: "handle-1",
        attributes: {} as never,
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:123:queue",
        awsRegion: "us-east-1",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sesCallCount = 0;
  sesMaxSendRate = 14;
  sqsSendCalls.length = 0;
  selectCallIndex = 0;
  selectResults = [];
  mockClaimReturning = [];
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate limit delay calculations
// ─────────────────────────────────────────────────────────────────────────────

describe("inter-chunk delay reflects account MaxSendRate", () => {
  it("new-account rate (14 eps) → ceil(50/14) = 4s delay on next chunk", async () => {
    sesMaxSendRate = 14;
    setupSelects();

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sqsSendCalls).toHaveLength(1);
    expect(sqsSendCalls[0].DelaySeconds).toBe(4);
  });

  it("high-volume account (200 eps) → ceil(50/200) = 1s delay on next chunk", async () => {
    sesMaxSendRate = 200;
    setupSelects();

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sqsSendCalls).toHaveLength(1);
    expect(sqsSendCalls[0].DelaySeconds).toBe(1);
  });

  it("mid-range account (25 eps) → ceil(50/25) = 2s delay on next chunk", async () => {
    sesMaxSendRate = 25;
    setupSelects();

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sqsSendCalls).toHaveLength(1);
    expect(sqsSendCalls[0].DelaySeconds).toBe(2);
  });

  it("very constrained account (1 eps) → ceil(50/1) = 50s delay on next chunk", async () => {
    sesMaxSendRate = 1;
    setupSelects();

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sqsSendCalls).toHaveLength(1);
    expect(sqsSendCalls[0].DelaySeconds).toBe(50);
  });

  it("GetAccount failure falls back to default (14 eps) → 4s delay", async () => {
    sesMaxSendRate = null; // makes GetAccountCommand throw
    setupSelects();

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sqsSendCalls).toHaveLength(1);
    expect(sqsSendCalls[0].DelaySeconds).toBe(4);
  });

  it("next-chunk message carries the correct chunkIndex (not re-using current)", async () => {
    sesMaxSendRate = 14;
    setupSelects();

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const nextJob = JSON.parse(sqsSendCalls[0].MessageBody);
    expect(nextJob.chunkIndex).toBe(1); // incremented from 0
    expect(nextJob.batchId).toBe("batch-1");
  });
});
