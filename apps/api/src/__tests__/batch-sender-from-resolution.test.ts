/**
 * Batch Sender - From Address Resolution Tests
 *
 * Verifies the fallback chain: batch.from > org defaultFrom > fail with error.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockContext } from "./__helpers__/lambda-context";

const sesSendCalls: unknown[][] = [];

vi.mock("@aws-sdk/client-sesv2", () => {
  function GetAccountCommand(this: unknown, input: unknown) {
    return input;
  }
  function SendBulkEmailCommand(this: unknown, input: unknown) {
    return input;
  }
  function SendEmailCommand(this: unknown, input: unknown) {
    return input;
  }
  return {
    SESv2Client: class {
      send(...args: unknown[]) {
        sesSendCalls.push(args);
        return Promise.resolve({
          SendQuota: { MaxSendRate: 14 },
          BulkEmailEntryResults: [{ Status: "SUCCESS", MessageId: "msg-1" }],
        });
      }
    },
    GetAccountCommand,
    SendBulkEmailCommand,
    SendEmailCommand,
  };
});

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn().mockResolvedValue({});
  },
  // biome-ignore lint: mock constructor
  SendMessageCommand: function SendMessageCommand(input: unknown) {
    return input;
  },
}));

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("plain text"),
}));

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

vi.mock("./variable-mappings", () => ({
  applyVariableMappings: vi
    .fn()
    .mockImplementation((data: Record<string, string>) => data),
}));

// ─────────────────────────────────────────────────────────────────────────────
// DB mock with per-call resolution
// ─────────────────────────────────────────────────────────────────────────────

// Default: claim INSERT returns all contacts claimed (no conflicts).
// Tests that need partial claims should reassign mockClaimReturning.
let mockClaimReturning: Array<{ contactId: string }> = [];
const mockDbInsertValues = vi.fn().mockImplementation(() => ({
  onConflictDoNothing: vi.fn().mockReturnValue({
    returning: vi.fn().mockImplementation(() => Promise.resolve(mockClaimReturning)),
  }),
}));
const mockDbUpdateSet = vi.fn();
const mockDbUpdateSetWhere = vi.fn().mockReturnValue({
  returning: vi.fn().mockResolvedValue([]),
});

let selectCallIndex = 0;
let selectResults: unknown[][] = [];

function thenable(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve(rows).then(resolve),
    limit: vi.fn().mockImplementation(() => thenable(rows)),
    orderBy: vi.fn().mockImplementation(() => thenable(rows)),
  };
  return obj;
}

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
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
        set: mockDbUpdateSet.mockReturnValue({
          where: mockDbUpdateSetWhere,
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: mockDbInsertValues,
      }),
    },
    sql: (...args: unknown[]) => args,
  };
});

process.env.BATCH_QUEUE_URL =
  "https://sqs.us-east-1.amazonaws.com/123456789012/queue";

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
    subject: "Test Subject",
    from: "explicit@example.com",
    fromName: "Explicit Sender",
    replyTo: null,
    totalRecipients: 1,
    processedRecipients: 0,
    sent: 0,
    failed: 0,
    variableMappings: null,
    ...overrides,
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
        messageId: "msg-1",
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

/**
 * DB select call order in processJob (claim-before-send contract):
 * 0. batchSend record
 * 1. contacts (getContactsChunk) — uses .where().orderBy().limit()
 * 2. aws account features (config set lookup)
 * 3. template (from Promise.all)
 * 4. organization (from Promise.all)
 * 5. organizationExtension (only when batch.from is null)
 *
 * The old dedup SELECT (slot 5) is gone — replaced by INSERT claim + UPDATE re-claim.
 */
function setupSelects(opts: {
  batch: Record<string, unknown>;
  orgExt?: { defaultFrom: string | null; defaultFromName: string | null };
}) {
  const contact = {
    id: "contact-1",
    email: "recipient@example.com",
    phone: null,
    firstName: "Test",
    lastName: "User",
    company: null,
    jobTitle: null,
    properties: {},
    createdAt: new Date("2026-01-15T10:00:00Z"),
  };

  // Claim INSERT returns contact-1 as claimed (successful claim)
  mockClaimReturning = [{ contactId: "contact-1" }];

  const results: unknown[][] = [
    [opts.batch], // 0: batchSend
    [contact], // 1: contacts (getContactsChunk)
    [{}], // 2: aws account features (config set lookup — after contacts)
    [
      {
        sesTemplateName: "ses-tmpl-1",
        compiledHtml: "<p>Hello</p>",
        emailType: "marketing",
      },
    ], // 3: template
    [{ name: "Test Org" }], // 4: organization
  ];

  // organizationExtension is only queried when batch.from is null
  if (!opts.batch.from) {
    results.push(opts.orgExt ? [opts.orgExt] : []);
  }

  selectResults = results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("batch-sender from address resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesSendCalls.length = 0;
    selectCallIndex = 0;
    selectResults = [];
    mockClaimReturning = [{ contactId: "contact-1" }];
    // Re-wire mockDbUpdateSet after clearAllMocks clears its return value
    mockDbUpdateSet.mockReturnValue({
      where: mockDbUpdateSetWhere,
      returning: vi.fn().mockResolvedValue([]),
    });
    process.env.BATCH_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue";
  });

  // Note: sesSendCalls captures ALL SES client.send() calls, including
  // GetAccountCommand (rate limit check). The actual email send is the 2nd call.

  it("uses batch.from when set", async () => {
    setupSelects({ batch: makeBatch({ from: "sender@mycompany.com" }) });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // GetAccountCommand + SendBulkEmailCommand = 2 calls
    expect(sesSendCalls).toHaveLength(2);
    const sendInput = sesSendCalls[1][0] as Record<string, string>;
    expect(sendInput.FromEmailAddress).toBe(
      "Explicit Sender <sender@mycompany.com>"
    );
  });

  it("falls back to org defaultFrom when batch.from is null", async () => {
    setupSelects({
      batch: makeBatch({ from: null, fromName: null }),
      orgExt: {
        defaultFrom: "default@orgdomain.com",
        defaultFromName: "Org Default",
      },
    });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sesSendCalls).toHaveLength(2);
    const sendInput = sesSendCalls[1][0] as Record<string, string>;
    expect(sendInput.FromEmailAddress).toBe(
      "Org Default <default@orgdomain.com>"
    );
  });

  it("uses org defaultFrom address but keeps batch fromName when set", async () => {
    setupSelects({
      batch: makeBatch({ from: null, fromName: "Batch Name" }),
      orgExt: {
        defaultFrom: "default@orgdomain.com",
        defaultFromName: "Org Name",
      },
    });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sesSendCalls).toHaveLength(2);
    const sendInput = sesSendCalls[1][0] as Record<string, string>;
    expect(sendInput.FromEmailAddress).toBe(
      "Batch Name <default@orgdomain.com>"
    );
  });

  it("fails with clear error when no sender is configured anywhere", async () => {
    setupSelects({
      batch: makeBatch({ from: null, fromName: null }),
      orgExt: { defaultFrom: null, defaultFromName: null },
    });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // Only GetAccountCommand — no email send attempted
    expect(sesSendCalls).toHaveLength(1);

    // Should UPDATE claimed rows to failed (claim-before-send: rows were already inserted)
    expect(mockDbUpdateSet).toHaveBeenCalled();
    const failedUpdate = mockDbUpdateSet.mock.calls.find(
      (call) => (call[0] as Record<string, unknown>).status === "failed"
    );
    expect(failedUpdate).toBeDefined();
    expect((failedUpdate![0] as Record<string, unknown>).error).toContain(
      "No sender email configured"
    );
  });

  it("fails when org extension has no record at all", async () => {
    setupSelects({
      batch: makeBatch({ from: null, fromName: null }),
    });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // Only GetAccountCommand — no email send attempted
    expect(sesSendCalls).toHaveLength(1);

    // Should UPDATE claimed rows to failed
    expect(mockDbUpdateSet).toHaveBeenCalled();
    const failedUpdate = mockDbUpdateSet.mock.calls.find(
      (call) => (call[0] as Record<string, unknown>).status === "failed"
    );
    expect(failedUpdate).toBeDefined();
    expect((failedUpdate![0] as Record<string, unknown>).error).toContain(
      "No sender email configured"
    );
  });
});
