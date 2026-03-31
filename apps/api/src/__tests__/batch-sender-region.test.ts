/**
 * Batch Sender - SES Region Tests
 *
 * Verifies that the SES client uses the customer's AWS region
 * from the awsAccount record, not the Lambda's process.env.AWS_REGION.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Track SESv2Client constructor calls
const sesClientInstances: Array<{ region: string }> = [];

vi.mock("@aws-sdk/client-sesv2", () => {
  return {
    SESv2Client: class MockSESv2Client {
      config: { region: string };
      constructor(config: { region?: string }) {
        this.config = { region: config.region ?? "unknown" };
        sesClientInstances.push({ region: this.config.region });
      }
      send = vi.fn().mockResolvedValue({
        // GetAccountCommand response
        SendQuota: { MaxSendRate: 14 },
        // SendBulkEmailCommand response
        BulkEmailEntryResults: [{ Status: "SUCCESS", MessageId: "msg-1" }],
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
  };
});

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class MockSQSClient {
    send = vi.fn().mockResolvedValue({});
  },
  SendMessageCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("plain text"),
}));

let regionSelectIdx = 0;
const regionSelectResults: unknown[][] = [
  // 1. batch
  [{
    id: "batch-1",
    organizationId: "org-1",
    status: "queued",
    audienceType: "all",
    topicId: null,
    segmentId: null,
    emailTemplateId: "tmpl-1",
    htmlContent: null,
    subject: "Test",
    from: "test@example.com",
    fromName: "Test",
    replyTo: null,
    totalRecipients: 1,
    processedRecipients: 0,
    sent: 0,
    failed: 0,
    variableMappings: null,
  }],
  // 2. contacts
  [{
    id: "contact-1",
    email: "user@example.com",
    phone: null,
    firstName: "Test",
    lastName: "User",
    company: null,
    jobTitle: null,
    properties: {},
    createdAt: new Date("2026-01-15T10:00:00Z"),
  }],
  // 3. template
  [{ sesTemplateName: "wraps-tmpl-1", compiledHtml: null, emailType: "marketing" }],
  // 4. organization
  [{ name: "Test Org" }],
  // 5. dedup (empty = no prior sends)
  [],
];

function regionThenable(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve),
    limit: vi.fn().mockImplementation(() => regionThenable(rows)),
    orderBy: vi.fn().mockImplementation(() => regionThenable(rows)),
  };
  return obj;
}

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => {
        const rows = regionSelectResults[regionSelectIdx] ?? [];
        regionSelectIdx += 1;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => regionThenable(rows)),
          }),
        };
      }),
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

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIA-test",
    secretAccessKey: "secret-test",
    sessionToken: "token-test",
    expiration: new Date("2099-01-01"),
    region: "eu-west-1",
  }),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./variable-mappings", () => ({
  applyVariableMappings: vi
    .fn()
    .mockImplementation((data: Record<string, string>) => data),
}));

const { handler } = await import("../workers/batch-sender");

describe("batch-sender SES region", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesClientInstances.length = 0;
    regionSelectIdx = 0;
    process.env.AWS_REGION = "us-east-1";
    process.env.BATCH_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue";
  });

  it("creates SES client with customer's region, not Lambda's AWS_REGION", async () => {
    const event = {
      Records: [
        {
          body: JSON.stringify({
            batchId: "batch-1",
            organizationId: "org-1",
            awsAccountId: "aws-account-1",
            channel: "email",
            chunkIndex: 0,
          }),
          messageId: "msg-1",
          receiptHandle: "handle-1",
          attributes: {} as never,
          messageAttributes: {},
          md5OfBody: "",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:queue",
          awsRegion: "us-east-1",
        },
      ],
    };

    await handler(event, {} as never, () => {});

    // SES client should be created with customer's region (eu-west-1),
    // NOT the Lambda's region (us-east-1)
    expect(sesClientInstances.length).toBeGreaterThanOrEqual(1);
    expect(sesClientInstances[0].region).toBe("eu-west-1");
  });
});
