/**
 * Batch Sender — Raw HTML Path
 *
 * Tests the `else` branch in processJob (no sesTemplateName), where each
 * contact gets an individual `sendEmail` call via Promise.allSettled.
 *
 * Covers:
 *   - transformVariablesForSes: dot-notation and fallback-syntax transforms
 *   - fulfilled sends → messageSend with status='sent' and messageId
 *   - rejected sends → messageSend with status='failed' and error message
 *   - mixed fulfilled/rejected in same chunk → both records in single insert
 *   - fallback HTML when batch.htmlContent is null
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockContext } from "./__helpers__/lambda-context";

// ─────────────────────────────────────────────────────────────────────────────
// sendEmail mock — captures call args, resolves/rejects on demand
// ─────────────────────────────────────────────────────────────────────────────

const mockSendEmail = vi.fn();

vi.mock("@wraps/email-send", () => ({
  sendEmail: mockSendEmail,
}));

// ─────────────────────────────────────────────────────────────────────────────
// AWS SDK mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn().mockResolvedValue({
      SendQuota: { MaxSendRate: 14 },
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
    send = vi.fn().mockResolvedValue({});
  },
  SendMessageCommand: class {
    constructor(public input: unknown) {}
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// DB mock — index-based select, tracks inserts
// Raw HTML path select order (batch.from != null, emailTemplateId null):
//   0: batch
//   1: contacts (from getContactsChunk)
//   2: existingSendRecords (dedup)
// ─────────────────────────────────────────────────────────────────────────────

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
const insertValuesCalls: unknown[] = [];

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
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: unknown) => {
          insertValuesCalls.push(vals);
          return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
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

function makeRawBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    organizationId: "org-1",
    status: "queued",
    audienceType: "all",
    topicId: null,
    segmentId: null,
    emailTemplateId: null,
    htmlContent: "<p>Hello!</p>",
    subject: "Test Subject",
    from: "sender@example.com",
    fromName: "Sender",
    replyTo: null,
    totalRecipients: 1,
    processedRecipients: 0,
    sent: 0,
    failed: 0,
    variableMappings: null,
    ...overrides,
  };
}

function makeContact(id: string, email: string, firstName = "Alice") {
  return {
    id,
    email,
    phone: null,
    firstName,
    lastName: null,
    company: null,
    jobTitle: null,
    properties: {},
    createdAt: new Date("2026-01-15T10:00:00Z"),
  };
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

function setupSelects(
  batch: Record<string, unknown>,
  contacts: unknown[],
  existingRecords: unknown[] = []
) {
  selectResults = [[batch], contacts, existingRecords];
}

beforeEach(() => {
  vi.clearAllMocks();
  selectCallIndex = 0;
  selectResults = [];
  insertValuesCalls.length = 0;
  mockSendEmail.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// transformVariablesForSes
// ─────────────────────────────────────────────────────────────────────────────

describe("transformVariablesForSes via raw HTML path", () => {
  it("transforms {{contact.firstName}} → {{contactFirstName}} before sending", async () => {
    setupSelects(
      makeRawBatch({ htmlContent: "<p>Hi {{contact.firstName}}!</p>" }),
      [makeContact("c1", "alice@example.com")]
    );
    mockSendEmail.mockResolvedValueOnce({ messageId: "msg-1" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const htmlSent = mockSendEmail.mock.calls[0]?.[0]?.html;
    expect(htmlSent).toBe("<p>Hi {{contactFirstName}}!</p>");
  });

  it("transforms {{contact.firstName|there}} → Handlebars conditional", async () => {
    setupSelects(makeRawBatch({ htmlContent: "{{contact.firstName|there}}" }), [
      makeContact("c1", "alice@example.com"),
    ]);
    mockSendEmail.mockResolvedValueOnce({ messageId: "msg-1" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const htmlSent = mockSendEmail.mock.calls[0]?.[0]?.html;
    expect(htmlSent).toBe(
      "{{#if contactFirstName}}{{contactFirstName}}{{else}}there{{/if}}"
    );
  });

  it("falls back to '<p>Hello from Wraps!</p>' when htmlContent is null", async () => {
    setupSelects(makeRawBatch({ htmlContent: null }), [
      makeContact("c1", "alice@example.com"),
    ]);
    mockSendEmail.mockResolvedValueOnce({ messageId: "msg-1" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const htmlSent = mockSendEmail.mock.calls[0]?.[0]?.html;
    expect(htmlSent).toBe("<p>Hello from Wraps!</p>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// messageSend record insertion
// ─────────────────────────────────────────────────────────────────────────────

describe("messageSend record insertion", () => {
  it("inserts status='sent' record with messageId when sendEmail fulfills", async () => {
    setupSelects(makeRawBatch(), [makeContact("c1", "alice@example.com")]);
    mockSendEmail.mockResolvedValueOnce({ messageId: "msg-abc" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const sendInsert = (insertValuesCalls as unknown[][]).find(
      (vals) =>
        Array.isArray(vals) &&
        vals.some(
          (r) => (r as Record<string, unknown>)?.batchSendId === "batch-1"
        )
    ) as Record<string, unknown>[] | undefined;

    expect(sendInsert).toBeDefined();
    const record = sendInsert?.[0];
    expect(record?.status).toBe("sent");
    expect(record?.messageId).toBe("msg-abc");
    expect(record?.contactId).toBe("c1");
    expect(record?.recipient).toBe("alice@example.com");
  });

  it("inserts status='failed' record with error message when sendEmail rejects", async () => {
    setupSelects(makeRawBatch(), [makeContact("c1", "alice@example.com")]);
    mockSendEmail.mockRejectedValueOnce(new Error("MessageRejected: Bounced"));

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const sendInsert = (insertValuesCalls as unknown[][]).find(
      (vals) =>
        Array.isArray(vals) &&
        vals.some(
          (r) => (r as Record<string, unknown>)?.batchSendId === "batch-1"
        )
    ) as Record<string, unknown>[] | undefined;

    expect(sendInsert).toBeDefined();
    const record = sendInsert?.[0];
    expect(record?.status).toBe("failed");
    expect(record?.error).toBe("MessageRejected: Bounced");
    expect(record?.contactId).toBe("c1");
    expect(record?.messageId).toBeUndefined();
  });

  it("inserts both sent and failed records in one batch when some contacts fail (allSettled)", async () => {
    setupSelects(makeRawBatch({ totalRecipients: 2 }), [
      makeContact("c1", "alice@example.com", "Alice"),
      makeContact("c2", "bob@example.com", "Bob"),
    ]);

    mockSendEmail
      .mockResolvedValueOnce({ messageId: "msg-alice" })
      .mockRejectedValueOnce(new Error("SMTP error"));

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const sendInsert = (insertValuesCalls as unknown[][]).find(
      (vals) =>
        Array.isArray(vals) &&
        vals.some(
          (r) => (r as Record<string, unknown>)?.batchSendId === "batch-1"
        )
    ) as Record<string, unknown>[] | undefined;

    expect(sendInsert).toBeDefined();
    expect(sendInsert).toHaveLength(2);

    const sentRecord = sendInsert?.find((r) => r.contactId === "c1");
    const failedRecord = sendInsert?.find((r) => r.contactId === "c2");

    expect(sentRecord?.status).toBe("sent");
    expect(sentRecord?.messageId).toBe("msg-alice");

    expect(failedRecord?.status).toBe("failed");
    expect(failedRecord?.error).toBe("SMTP error");
  });

  it("calls sendEmail once per contact (not once for the whole batch)", async () => {
    setupSelects(makeRawBatch({ totalRecipients: 3 }), [
      makeContact("c1", "alice@example.com"),
      makeContact("c2", "bob@example.com"),
      makeContact("c3", "carol@example.com"),
    ]);

    mockSendEmail
      .mockResolvedValueOnce({ messageId: "msg-1" })
      .mockResolvedValueOnce({ messageId: "msg-2" })
      .mockResolvedValueOnce({ messageId: "msg-3" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(mockSendEmail).toHaveBeenCalledTimes(3);

    const toAddresses = mockSendEmail.mock.calls.map(
      (args) => (args[0] as Record<string, unknown>)?.to
    );
    expect(toAddresses).toEqual([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
    ]);
  });
});
