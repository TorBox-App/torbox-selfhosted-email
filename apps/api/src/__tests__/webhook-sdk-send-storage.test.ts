/**
 * Webhook SDK Send Storage Tests
 *
 * Verifies that Send events for unknown messageIds (SDK transactional sends)
 * insert a messageSend row, while other event types are still ignored.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockOnConflictDoNothing = vi.fn();

vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn(),
  deleteScheduledStep: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailDelivered: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
  return {
    ...actual,
    db: {
      select: mockDbSelect,
      update: vi.fn().mockImplementation(() => ({
        set: () => ({ where: () => Promise.resolve({ rowCount: 1 }) }),
      })),
      insert: mockDbInsert,
    },
  };
});

const { webhooksRoutes } = await import("../routes/webhooks");
const { Elysia } = await import("elysia");

const AWS_ACCOUNT_NUMBER = "111122223333";
const WEBHOOK_SECRET = "sdk-send-secret";
const ORG_ID = "org-sdk-send-1";

function createApp() {
  return new Elysia().use(webhooksRoutes);
}

function mockAccountLookup() {
  mockDbSelect.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve([
            {
              id: "aws-acc-sdk-1",
              webhookSecret: WEBHOOK_SECRET,
              organizationId: ORG_ID,
            },
          ]),
      }),
    }),
  });
}

function mockMessageSendLookup(found: boolean) {
  mockDbSelect.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () =>
          found
            ? Promise.resolve([
                {
                  id: "msg-found",
                  status: "sent",
                  batchSendId: null,
                  contactId: null,
                  openedAt: null,
                  clickedAt: null,
                },
              ])
            : Promise.resolve([]),
      }),
    }),
  });
}

function mockInsertChain() {
  mockOnConflictDoNothing.mockResolvedValue([]);
  mockInsertValues.mockReturnValue({
    onConflictDoNothing: mockOnConflictDoNothing,
  });
  mockDbInsert.mockReturnValue({ values: mockInsertValues });
}

function makeSendEvent(messageId = "ses-sdk-001") {
  return {
    version: "0",
    id: "event-send-1",
    "detail-type": "Email Sending Events",
    source: "aws.ses",
    account: AWS_ACCOUNT_NUMBER,
    time: new Date().toISOString(),
    region: "us-east-1",
    detail: {
      eventType: "Send",
      mail: {
        messageId,
        timestamp: new Date().toISOString(),
        source: "sender@example.com",
        destination: ["recipient@example.com"],
      },
    },
  };
}

function makeEventOfType(eventType: string, messageId = "ses-sdk-002") {
  return {
    ...makeSendEvent(messageId),
    detail: {
      eventType,
      mail: {
        messageId,
        timestamp: new Date().toISOString(),
        source: "sender@example.com",
        destination: ["recipient@example.com"],
      },
    },
  };
}

async function sendWebhook(event: Record<string, unknown>) {
  const app = createApp();
  return app.handle(
    new Request(`http://localhost/webhooks/ses/${AWS_ACCOUNT_NUMBER}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wraps-api-key": WEBHOOK_SECRET,
      },
      body: JSON.stringify(event),
    })
  );
}

describe("webhook SDK send storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Send event for unknown messageId inserts exactly one messageSend row", async () => {
    mockAccountLookup();
    mockMessageSendLookup(false);
    mockInsertChain();

    const response = await sendWebhook(makeSendEvent("ses-sdk-new-001"));

    expect(response.status).toBe(200);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: "ses-sdk-new-001" })
    );
  });

  it("messageSend row has sourceType:'transactional', correct org, recipient, from, messageId", async () => {
    mockAccountLookup();
    mockMessageSendLookup(false);
    mockInsertChain();

    await sendWebhook(makeSendEvent("ses-sdk-new-002"));

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        sourceType: "transactional",
        recipient: "recipient@example.com",
        from: "sender@example.com",
        messageId: "ses-sdk-new-002",
        channel: "email",
        status: "sent",
      })
    );
  });

  it("Send insert uses onConflictDoNothing — idempotent on duplicate", async () => {
    mockAccountLookup();
    mockMessageSendLookup(false);
    mockInsertChain();

    await sendWebhook(makeSendEvent("ses-sdk-dupe-001"));

    // Called with no arguments — bare .onConflictDoNothing(), not .onConflictDoNothing({ target })
    expect(mockOnConflictDoNothing).toHaveBeenCalledWith();
  });

  it("Delivery event for unknown messageId is still ignored (no messageSend insert)", async () => {
    mockAccountLookup();
    mockMessageSendLookup(false);
    // Delivery path fires the usage-tracking insert; wire that up here.
    const mockUsageInsertValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue([{ messageCount: 1 }]),
    });
    mockDbInsert.mockReturnValue({ values: mockUsageInsertValues });

    await sendWebhook(makeEventOfType("Delivery", "ses-sdk-delivery-001"));

    // Exactly one insert fires (usage tracking), never a messageSend row
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(mockUsageInsertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "transactional" })
    );
  });

  it("Send event with no destination is skipped (no insert)", async () => {
    mockAccountLookup();
    mockMessageSendLookup(false);
    mockInsertChain();

    const eventNoRecipient = {
      ...makeSendEvent("ses-sdk-no-recipient"),
      detail: {
        eventType: "Send",
        mail: {
          messageId: "ses-sdk-no-recipient",
          timestamp: new Date().toISOString(),
          source: "sender@example.com",
          destination: [],
        },
      },
    };

    const response = await sendWebhook(eventNoRecipient);

    expect(response.status).toBe(200);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("Bounce event for unknown messageId is still ignored (no insert)", async () => {
    mockAccountLookup();
    mockMessageSendLookup(false);
    mockInsertChain();

    const response = await sendWebhook(
      makeEventOfType("Bounce", "ses-sdk-bounce-001")
    );

    expect(response.status).toBe(200);
    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
  });
});
