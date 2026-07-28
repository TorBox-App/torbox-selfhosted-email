/**
 * Batch Sender — recipient-facing link base URLs
 *
 * The unsubscribe and preference links in a broadcast are mailed to real
 * recipients. A self-hosted deployment issues tokens only its own database
 * understands, so a silent fallback to the Wraps platform ships working-looking
 * mail pointing at another company's domain — and the first signal is a
 * customer complaint.
 *
 * These tests lock in both halves of the fix: the deployment's own URLs are
 * used when configured, and the send fails loudly when they are not.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockContext } from "./__helpers__/lambda-context";

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn().mockResolvedValue({});
  },
  SendMessageCommand: class {
    constructor(public input: unknown) {}
  },
}));

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

vi.mock("../workers/variable-mappings", () => ({
  applyVariableMappings: vi
    .fn()
    .mockImplementation((data: Record<string, string>) => data),
}));

// Captured at module load, unrelated to the link bases under test here.
process.env.BATCH_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue";

const { handler } = await import("../workers/batch-sender");

function makeSQSEvent() {
  return {
    Records: [
      {
        body: JSON.stringify({
          batchId: "batch-links-1",
          organizationId: "org-1",
          awsAccountId: "aws-1",
          channel: "email",
          chunkIndex: 0,
        }),
        messageId: "sqs-msg-links-1",
        receiptHandle: "handle-links-1",
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

function setupBulkSelects() {
  mockClaimReturning = [{ contactId: "contact-links-1" }];
  selectResults = [
    [
      {
        id: "batch-links-1",
        organizationId: "org-1",
        status: "queued",
        audienceType: "all",
        topicId: null,
        segmentId: null,
        emailTemplateId: "tmpl-links-1",
        htmlContent: null,
        subject: "Hello",
        from: "sender@example.com",
        fromName: "Sender",
        replyTo: null,
        totalRecipients: 1,
        processedRecipients: 0,
        sent: 0,
        failed: 0,
        variableMappings: null,
      },
    ],
    [
      {
        id: "contact-links-1",
        email: "alice@example.com",
        phone: null,
        firstName: "Alice",
        lastName: null,
        company: null,
        jobTitle: null,
        properties: {},
        createdAt: new Date("2026-01-15T10:00:00Z"),
      },
    ],
    [{}], // aws account features
    [
      {
        sesTemplateName: "wraps-tmpl-links-1",
        compiledHtml: "<p>Hi</p>",
        // Marketing, so the worker generates unsubscribe + preference links.
        emailType: "marketing",
      },
    ],
    [{ name: "Test Org" }],
  ];
}

function recipientData(): Record<string, unknown> {
  const bulkInput = sesBulkSendInputs[0] as {
    BulkEmailEntries: Array<{
      ReplacementEmailContent: {
        ReplacementTemplate: { ReplacementTemplateData: string };
      };
    }>;
  };
  return JSON.parse(
    bulkInput.BulkEmailEntries[0].ReplacementEmailContent.ReplacementTemplate
      .ReplacementTemplateData
  ) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sesCallCount = 0;
  sesBulkSendInputs.length = 0;
  selectCallIndex = 0;
  selectResults = [];
  mockClaimReturning = [];
});

afterEach(() => {
  // process.env is global to the vitest worker — restore it so sibling files
  // do not inherit these stubs.
  vi.unstubAllEnvs();
});

describe("batch sender — recipient-facing link base URLs", () => {
  it("builds unsubscribe and preference links from the deployment's own URLs", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.customer.test");
    vi.stubEnv("APP_BASE_URL", "https://mail.customer.test");
    // Highest-precedence app var must lose to nothing here: unset it so
    // APP_BASE_URL (what the worker Lambda actually receives) is what wins.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("BETTER_AUTH_URL", "");
    setupBulkSelects();

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    expect(sesBulkSendInputs).toHaveLength(1);
    const data = recipientData();
    expect(data.unsubscribeUrl).toBe(
      "https://api.customer.test/unsubscribe/mock-token"
    );
    expect(data.preferencesUrl).toBe(
      "https://mail.customer.test/preferences/mock-token"
    );
  });

  it("fails the send instead of falling back to the Wraps platform when the URLs are unset", async () => {
    vi.stubEnv("API_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("APP_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("BETTER_AUTH_URL", "");
    setupBulkSelects();

    await expect(
      handler(makeSQSEvent(), makeMockContext(), vi.fn())
    ).rejects.toThrow(/API_BASE_URL/);

    // Nothing reached SES, so no recipient got a wraps.dev link.
    expect(sesBulkSendInputs).toHaveLength(0);
    expect(JSON.stringify(sesBulkSendInputs)).not.toContain("wraps.dev");
  });
});
