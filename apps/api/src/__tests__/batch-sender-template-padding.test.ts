/**
 * Batch Sender — TemplateData padding
 *
 * SES hard-fails rendering when a template references a bare {{var}} that is
 * absent from TemplateData (status: "RenderingFailure", silent non-delivery).
 *
 * This test file verifies that the bulk-send path (sesTemplateName present)
 * pads BOTH per-recipient ReplacementTemplateData AND DefaultContent.TemplateData
 * with empty-string values for any variable referenced in the template's
 * subject/html that is not already supplied by contact fields.
 *
 * Test case: a nudge-send template whose subject contains {{contactCount}}
 * (a custom var not in the standard contact-field set). Without padding,
 * SES returns RenderingFailure for every recipient.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockContext } from "./__helpers__/lambda-context";

// ─────────────────────────────────────────────────────────────────────────────
// SQS mock (no assertions needed here — just prevent real calls)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn().mockResolvedValue({});
  },
  SendMessageCommand: class {
    constructor(public input: unknown) {}
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// SES mock — captures SendBulkEmailCommand inputs for assertions
// ─────────────────────────────────────────────────────────────────────────────

const sesBulkSendInputs: unknown[] = [];
let sesCallCount = 0;

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn().mockImplementation((cmd: { input: unknown }) => {
      sesCallCount++;
      // Index 0 = GetAccount quota fetch; index 1+ = SendBulkEmail
      if (sesCallCount === 1) {
        return Promise.resolve({ SendQuota: { MaxSendRate: 14 } });
      }
      sesBulkSendInputs.push(cmd.input);
      return Promise.resolve({
        BulkEmailEntryResults: [{ Status: "SUCCESS", MessageId: "msg-bulk-1" }],
      });
    });
  },
  GetAccountCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  SendBulkEmailCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// DB mock — index-based selects, tracks inserts
// Bulk path select order:
//   0: batch
//   1: contacts (from getContactsChunk)
//   2: aws account features (config set)
//   3: template  \  via Promise.all
//   4: org       /
//   5: existingSendRecords (dedup)
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
            returning: vi.fn().mockImplementation(() =>
              Promise.resolve(mockClaimReturning)
            ),
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
    id: "batch-pad-1",
    organizationId: "org-1",
    status: "queued",
    audienceType: "all",
    topicId: null,
    segmentId: null,
    emailTemplateId: "tmpl-pad-1",
    htmlContent: null,
    subject: "You have {{contactCount}} contacts",
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

function makeContact() {
  return {
    id: "contact-pad-1",
    email: "alice@example.com",
    phone: null,
    firstName: "Alice",
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
          batchId: "batch-pad-1",
          organizationId: "org-1",
          awsAccountId: "aws-1",
          channel: "email",
          chunkIndex: 0,
        }),
        messageId: "sqs-msg-pad-1",
        receiptHandle: "handle-pad-1",
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
 * Setup selects for the bulk path.
 * Template has a custom var ({{contactCount}}) in subject and html that is
 * not part of the standard contact-field set.
 */
function setupBulkSelects() {
  mockClaimReturning = [{ contactId: "contact-pad-1" }];
  selectResults = [
    [makeBulkBatch()],
    [makeContact()],
    [{}], // aws account features
    [
      {
        sesTemplateName: "wraps-tmpl-pad-1",
        compiledHtml:
          "<p>Hi {{firstName}}, you have {{contactCount}} contacts.</p>",
        emailType: "marketing",
      },
    ],
    [{ name: "Test Org" }],
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  sesCallCount = 0;
  sesBulkSendInputs.length = 0;
  selectCallIndex = 0;
  selectResults = [];
  mockClaimReturning = [];
});

// ─────────────────────────────────────────────────────────────────────────────
// Padding tests
// ─────────────────────────────────────────────────────────────────────────────

describe("batch sender — TemplateData padding for custom template vars", () => {
  it("pads per-recipient ReplacementTemplateData with '' for vars in template but absent from contact", async () => {
    // Template subject: "You have {{contactCount}} contacts"
    // Template html: "<p>Hi {{firstName}}, you have {{contactCount}} contacts.</p>"
    // Contact does NOT have contactCount — without padding SES returns RenderingFailure
    setupBulkSelects();
    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sesBulkSendInputs).toHaveLength(1);
    const bulkInput = sesBulkSendInputs[0] as {
      BulkEmailEntries: Array<{
        ReplacementEmailContent: {
          ReplacementTemplate: { ReplacementTemplateData: string };
        };
      }>;
    };

    const recipientData = JSON.parse(
      bulkInput.BulkEmailEntries[0].ReplacementEmailContent.ReplacementTemplate
        .ReplacementTemplateData
    ) as Record<string, unknown>;

    // contactCount is referenced in subject + html but not supplied by contact fields
    expect(
      Object.prototype.hasOwnProperty.call(recipientData, "contactCount")
    ).toBe(true);
    expect(recipientData.contactCount).toBe("");
  });

  it("pads DefaultContent.TemplateData with '' for vars in template but absent from standard keys", async () => {
    setupBulkSelects();
    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sesBulkSendInputs).toHaveLength(1);
    const bulkInput = sesBulkSendInputs[0] as {
      DefaultContent: {
        Template: { TemplateData: string };
      };
    };

    const defaultData = JSON.parse(
      bulkInput.DefaultContent.Template.TemplateData
    ) as Record<string, unknown>;

    // contactCount must also be present in DefaultContent.TemplateData
    // (SES uses this as a fallback when a recipient entry lacks a key)
    expect(
      Object.prototype.hasOwnProperty.call(defaultData, "contactCount")
    ).toBe(true);
    expect(defaultData.contactCount).toBe("");
  });

  it("does not overwrite existing non-empty values when padding", async () => {
    setupBulkSelects();
    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sesBulkSendInputs).toHaveLength(1);
    const bulkInput = sesBulkSendInputs[0] as {
      BulkEmailEntries: Array<{
        ReplacementEmailContent: {
          ReplacementTemplate: { ReplacementTemplateData: string };
        };
      }>;
    };

    const recipientData = JSON.parse(
      bulkInput.BulkEmailEntries[0].ReplacementEmailContent.ReplacementTemplate
        .ReplacementTemplateData
    ) as Record<string, unknown>;

    // firstName was supplied by contact — must remain "Alice", not ""
    expect(recipientData.firstName).toBe("Alice");
    // email is always present
    expect(recipientData.email).toBe("alice@example.com");
  });
});
