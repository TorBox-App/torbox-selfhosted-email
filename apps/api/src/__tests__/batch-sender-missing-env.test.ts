/**
 * Batch Sender — Missing Environment Variable Guard
 *
 * Verifies the handler throws immediately when BATCH_QUEUE_URL is absent,
 * rather than silently succeeding chunk 0 and failing to enqueue chunk 1.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = vi.fn();
  },
  GetAccountCommand: class {},
  SendBulkEmailCommand: class {},
  SendEmailCommand: class {},
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn();
  },
  SendMessageCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@react-email/render", () => ({ toPlainText: vi.fn() }));

vi.mock("@wraps/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
  batchSend: {},
  contact: {},
  contactTopic: {},
  messageSend: {},
  organization: {},
  organizationExtension: {},
  segment: {},
  template: {},
  eq: vi.fn(),
  and: vi.fn(),
  exists: vi.fn(),
  inArray: vi.fn(),
  isNotNull: vi.fn(),
  sql: vi.fn(),
  buildConditionSQL: vi.fn(),
}));

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn(),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn(),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../workers/variable-mappings", () => ({
  applyVariableMappings: vi.fn(),
}));

// Deliberately do NOT set process.env.BATCH_QUEUE_URL

const { handler } = await import("../workers/batch-sender");

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
        eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:queue",
        awsRegion: "us-east-1",
      },
    ],
  };
}

describe("batch-sender missing BATCH_QUEUE_URL", () => {
  it("throws before processing any records when BATCH_QUEUE_URL is absent", async () => {
    await expect(
      handler(makeSQSEvent(), {} as never, () => {})
    ).rejects.toThrow("BATCH_QUEUE_URL not configured");
  });
});
