/**
 * Batch Sender — SES Error Recovery
 *
 * Tests the catch-block inside the SES bulk send loop (sesTemplateName path):
 *
 *   Throttle  → re-queues same chunkIndex with 30s delay; does NOT proceed
 *   Permission → inserts failed records for all recipients, then re-throws
 *   Generic    → inserts failed records, increments failed counter, continues
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockContext } from "./__helpers__/lambda-context";

// ─────────────────────────────────────────────────────────────────────────────
// SQS mock — captures SendMessageCommand inputs so we can assert re-queue args
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
// SES mock — throws specific errors on the bulk send call (index 1)
// ─────────────────────────────────────────────────────────────────────────────

let sesCallCount = 0;
let sesErrorToThrow: Error | null = null;

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn().mockImplementation(() => {
      sesCallCount++;
      // Index 0 = GetAccount, index 1+ = SendBulkEmail
      if (sesCallCount > 1 && sesErrorToThrow) {
        return Promise.reject(sesErrorToThrow);
      }
      return Promise.resolve({ SendQuota: { MaxSendRate: 14 } });
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
// DB mock — index-based selects, tracks inserts
// Bulk path select order (batch.from != null, emailTemplateId set):
//   0: batch
//   1: contacts
//   2: template  \  via Promise.all
//   3: org       /
//   4: existingSendRecords (dedup)
// ─────────────────────────────────────────────────────────────────────────────

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
// Track UPDATE set calls for post-send status assertions
const updateSetCalls: Record<string, unknown>[] = [];
// Contacts returned by claim INSERT
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
        set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
          updateSetCalls.push(vals);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => Promise.resolve(mockClaimReturning)),
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

function makeBulkBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    organizationId: "org-1",
    status: "queued",
    audienceType: "all",
    topicId: null,
    segmentId: null,
    emailTemplateId: "tmpl-1",
    htmlContent: null,
    subject: "Test Subject",
    from: "sender@example.com",
    fromName: "Sender",
    replyTo: null,
    totalRecipients: 2,
    processedRecipients: 0,
    sent: 0,
    failed: 0,
    variableMappings: null,
    ...overrides,
  };
}

function makeContacts() {
  return [
    {
      id: "contact-1",
      email: "alice@example.com",
      phone: null,
      firstName: "Alice",
      lastName: null,
      company: null,
      jobTitle: null,
      properties: {},
      createdAt: new Date("2026-01-15T10:00:00Z"),
    },
    {
      id: "contact-2",
      email: "bob@example.com",
      phone: null,
      firstName: "Bob",
      lastName: null,
      company: null,
      jobTitle: null,
      properties: {},
      createdAt: new Date("2026-01-15T11:00:00Z"),
    },
  ];
}

function setupBulkSelects() {
  // Default: both contacts claimed by INSERT
  mockClaimReturning = makeContacts().map((c) => ({ contactId: c.id }));
  selectResults = [
    [makeBulkBatch()],
    makeContacts(),
    [{}], // aws account features (config set lookup — after contacts)
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

function makeSQSEvent(chunkIndex = 0) {
  return {
    Records: [
      {
        body: JSON.stringify({
          batchId: "batch-1",
          organizationId: "org-1",
          awsAccountId: "aws-1",
          channel: "email",
          chunkIndex,
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
  sesErrorToThrow = null;
  sqsSendCalls.length = 0;
  selectCallIndex = 0;
  selectResults = [];
  updateSetCalls.length = 0;
  mockClaimReturning = [];
});

// ─────────────────────────────────────────────────────────────────────────────
// Throttle error
// ─────────────────────────────────────────────────────────────────────────────

describe("SES throttle error", () => {
  it("re-queues the same chunkIndex (not incremented) with 30s delay", async () => {
    setupBulkSelects();
    sesErrorToThrow = Object.assign(new Error("Rate exceeded"), {
      name: "Throttling",
    });

    await handler(makeSQSEvent(2), makeMockContext(), vi.fn());

    expect(sqsSendCalls).toHaveLength(1);

    const requeued = JSON.parse(sqsSendCalls[0].MessageBody);
    // chunkIndex must remain 2 — NOT incremented to 3
    expect(requeued.chunkIndex).toBe(2);
    expect(requeued.batchId).toBe("batch-1");
    expect(requeued.organizationId).toBe("org-1");
  });

  it("delays the re-queued message by exactly 30 seconds", async () => {
    setupBulkSelects();
    sesErrorToThrow = Object.assign(new Error("Rate exceeded"), {
      name: "TooManyRequestsException",
    });

    await handler(makeSQSEvent(0), makeMockContext(), vi.fn());

    expect(sqsSendCalls[0]?.DelaySeconds).toBe(30);
  });

  it("does NOT update messageSend rows with error status when throttled (chunk will retry)", async () => {
    setupBulkSelects();
    sesErrorToThrow = Object.assign(new Error("Rate limit exceeded"), {
      name: "Throttling",
    });

    await handler(makeSQSEvent(0), makeMockContext(), vi.fn());

    // On throttle, we re-queue and return early — no post-send status updates
    const failedUpdates = updateSetCalls.filter((u) => u.status === "failed");
    expect(failedUpdates).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Permission error
// ─────────────────────────────────────────────────────────────────────────────

describe("SES permission error", () => {
  it("updates claimed rows to failed for all recipients before re-throwing", async () => {
    setupBulkSelects();
    sesErrorToThrow = Object.assign(
      new Error("User is not authorized to perform: ses:SendBulkEmail"),
      { name: "AccessDeniedException" }
    );

    await expect(
      handler(makeSQSEvent(0), makeMockContext(), vi.fn())
    ).rejects.toThrow();

    // Permission error path updates claimed rows to failed via a single UPDATE
    // with inArray for all recipients in the batch
    const failedUpdate = updateSetCalls.find((u) => u.status === "failed");
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate?.status).toBe("failed");
  });

  it("error message mentions IAM role and instructs how to fix it", async () => {
    setupBulkSelects();
    sesErrorToThrow = Object.assign(new Error("AccessDenied"), {
      name: "AccessDenied",
    });

    await expect(
      handler(makeSQSEvent(0), makeMockContext(), vi.fn())
    ).rejects.toThrow(/IAM role|CloudFormation|update-role/i);
  });

  it("does NOT re-queue an SQS message when permission error occurs", async () => {
    setupBulkSelects();
    sesErrorToThrow = Object.assign(new Error("is not authorized to perform"), {
      name: "AccessDeniedException",
    });

    await expect(
      handler(makeSQSEvent(0), makeMockContext(), vi.fn())
    ).rejects.toThrow();

    expect(sqsSendCalls).toHaveLength(0);
  });
});
