/**
 * Batch Sender — Raw HTML Path
 *
 * Tests the `else` branch in processJob (no sesTemplateName), where each
 * contact gets an individual `sendEmail` call via Promise.allSettled.
 *
 * Covers:
 *   - per-recipient rendering: variables substituted into html AND subject
 *     before sending (this path has no SES template, so we are the renderer)
 *   - render failures BLOCK the send (failed record, sendEmail never called)
 *   - fulfilled sends → messageSend with status='sent', messageId, and the
 *     rendered subject (never raw {{...}} syntax)
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
  WRAPS_CONFIGURATION_SET_NAME: "wraps-email-tracking",
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
// DB mock — index-based select, tracks claim inserts + post-send updates
// Raw HTML path select order (batch.from != null, emailTemplateId null):
//   0: batch
//   1: contacts (from getContactsChunk)
//   (dedup SELECT removed — replaced by INSERT claim + UPDATE re-claim)
// ─────────────────────────────────────────────────────────────────────────────

let selectCallIndex = 0;
let selectResults: unknown[][] = [];

// Track the claim INSERT's values (the initial claimed rows before send)
const claimInsertValues: unknown[] = [];
// Track all UPDATE set calls (re-claim + post-send status updates)
type UpdateRecord = { setValues: Record<string, unknown>; contactId?: string };
const updateCalls: UpdateRecord[] = [];
// Contacts returned by the claim INSERT — default to all contacts claimed
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
        set: vi.fn().mockImplementation((setValues: Record<string, unknown>) => {
          const call: UpdateRecord = { setValues };
          updateCalls.push(call);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: unknown) => {
          claimInsertValues.push(vals);
          return {
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockImplementation(() => Promise.resolve(mockClaimReturning)),
            }),
          };
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
  contacts: unknown[]
) {
  // Set claim returning to all contacts by default
  mockClaimReturning = contacts.map((c) => ({
    contactId: (c as { id: string }).id,
  }));
  selectResults = [[batch], contacts];
}

beforeEach(() => {
  vi.clearAllMocks();
  selectCallIndex = 0;
  selectResults = [];
  claimInsertValues.length = 0;
  updateCalls.length = 0;
  mockClaimReturning = [];
  mockSendEmail.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// transformVariablesForSes
// ─────────────────────────────────────────────────────────────────────────────

describe("per-recipient rendering via raw HTML path", () => {
  it("substitutes {{contact.firstName}} with the recipient's value before sending", async () => {
    setupSelects(
      makeRawBatch({ htmlContent: "<p>Hi {{contact.firstName}}!</p>" }),
      [makeContact("c1", "alice@example.com")]
    );
    mockSendEmail.mockResolvedValueOnce({ messageId: "msg-1" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const htmlSent = mockSendEmail.mock.calls[0]?.[0]?.html;
    expect(htmlSent).toBe("<p>Hi Alice!</p>");
  });

  it("substitutes variables in the subject and records the rendered subject", async () => {
    setupSelects(
      makeRawBatch({ subject: "A gift for {{contact.firstName}}" }),
      [makeContact("c1", "alice@example.com")]
    );
    mockSendEmail.mockResolvedValueOnce({ messageId: "msg-1" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(mockSendEmail.mock.calls[0]?.[0]?.subject).toBe("A gift for Alice");

    // Post-send update carries the rendered subject
    const sentUpdate = updateCalls.find(
      (u) => u.setValues.status === "sent" && u.setValues.subject !== undefined
    );
    expect(sentUpdate?.setValues.subject).toBe("A gift for Alice");
  });

  it("evaluates {{#if}} conditionals against recipient data", async () => {
    setupSelects(
      makeRawBatch({
        htmlContent:
          "{{#if contactFirstName}}Hey {{contactFirstName}}{{else}}Hey there{{/if}}",
        totalRecipients: 2,
      }),
      [
        makeContact("c1", "alice@example.com", "Alice"),
        makeContact("c2", "bob@example.com", ""),
      ]
    );
    mockSendEmail
      .mockResolvedValueOnce({ messageId: "msg-1" })
      .mockResolvedValueOnce({ messageId: "msg-2" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const htmls = mockSendEmail.mock.calls.map(
      (args) => (args[0] as Record<string, unknown>)?.html
    );
    expect(htmls).toEqual(["Hey Alice", "Hey there"]);
  });

  it("blocks the send when the template cannot render (never ships raw {{...}})", async () => {
    // Unclosed {{#if}} — Handlebars compile throws.
    setupSelects(makeRawBatch({ htmlContent: "Hi {{#if contactFirstName}}" }), [
      makeContact("c1", "alice@example.com"),
    ]);

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(mockSendEmail).not.toHaveBeenCalled();

    // Render failure should result in a failed UPDATE on the claimed row
    const failedUpdate = updateCalls.find((u) => u.setValues.status === "failed");
    expect(failedUpdate).toBeDefined();
    expect(String(failedUpdate?.setValues.error)).toMatch(/Template rendering failed/);
  });

  it("resolves {{contact.firstName|there}} fallback syntax against recipient data", async () => {
    setupSelects(
      makeRawBatch({
        htmlContent: "{{contact.firstName|there}}",
        totalRecipients: 2,
      }),
      [
        makeContact("c1", "alice@example.com"),
        makeContact("c2", "bob@example.com", ""),
      ]
    );
    mockSendEmail
      .mockResolvedValueOnce({ messageId: "msg-1" })
      .mockResolvedValueOnce({ messageId: "msg-2" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const htmls = mockSendEmail.mock.calls.map(
      (args) => (args[0] as Record<string, unknown>)?.html
    );
    expect(htmls).toEqual(["Alice", "there"]);
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

describe("messageSend record update (claim-before-send)", () => {
  it("updates claimed row with status='sent' and messageId when sendEmail fulfills", async () => {
    setupSelects(makeRawBatch(), [makeContact("c1", "alice@example.com")]);
    mockSendEmail.mockResolvedValueOnce({ messageId: "msg-abc" });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // Post-send UPDATE should set status=sent and messageId
    const sentUpdate = updateCalls.find((u) => u.setValues.status === "sent");
    expect(sentUpdate).toBeDefined();
    expect(sentUpdate?.setValues.status).toBe("sent");
    expect(sentUpdate?.setValues.messageId).toBe("msg-abc");
  });

  it("updates claimed row with status='failed' and error message when sendEmail rejects", async () => {
    setupSelects(makeRawBatch(), [makeContact("c1", "alice@example.com")]);
    mockSendEmail.mockRejectedValueOnce(new Error("MessageRejected: Bounced"));

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const failedUpdate = updateCalls.find((u) => u.setValues.status === "failed");
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate?.setValues.status).toBe("failed");
    expect(failedUpdate?.setValues.error).toBe("MessageRejected: Bounced");
  });

  it("updates both sent and failed rows when some contacts fail (allSettled)", async () => {
    setupSelects(makeRawBatch({ totalRecipients: 2 }), [
      makeContact("c1", "alice@example.com", "Alice"),
      makeContact("c2", "bob@example.com", "Bob"),
    ]);

    mockSendEmail
      .mockResolvedValueOnce({ messageId: "msg-alice" })
      .mockRejectedValueOnce(new Error("SMTP error"));

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const sentUpdates = updateCalls.filter((u) => u.setValues.status === "sent");
    const failedUpdates = updateCalls.filter((u) => u.setValues.status === "failed");

    expect(sentUpdates).toHaveLength(1);
    expect(failedUpdates).toHaveLength(1);

    expect(sentUpdates[0]?.setValues.messageId).toBe("msg-alice");
    expect(failedUpdates[0]?.setValues.error).toBe("SMTP error");
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
