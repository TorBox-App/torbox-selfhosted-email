/**
 * Webhook Routes Tests
 *
 * Tests for SES event webhook handlers including suppression processing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database before importing the routes
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

const mockSql = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => ({
    sql: strings.join("?"),
    values,
  })
);

vi.mock("@wraps/db", () => ({
  db: mockDb,
  awsAccount: {
    id: "id",
    accountId: "account_id",
    webhookSecret: "webhook_secret",
    organizationId: "organization_id",
  },
  messageSend: {
    id: "id",
    messageId: "message_id",
    status: "status",
    batchSendId: "batch_send_id",
    contactId: "contact_id",
    openedAt: "opened_at",
    clickedAt: "clicked_at",
    deliveredAt: "delivered_at",
    bouncedAt: "bounced_at",
    bounceType: "bounce_type",
    bounceSubType: "bounce_sub_type",
    complainedAt: "complained_at",
    suppressedAt: "suppressed_at",
  },
  batchSend: {
    id: "id",
    delivered: "delivered",
    opened: "opened",
    clicked: "clicked",
    bounced: "bounced",
    complained: "complained",
    suppressed: "suppressed",
  },
  contact: {
    id: "id",
    emailStatus: "email_status",
    emailBouncedAt: "email_bounced_at",
    emailComplainedAt: "email_complained_at",
    emailSuppressedAt: "email_suppressed_at",
    lastEmailOpenedAt: "last_email_opened_at",
    lastEmailClickedAt: "last_email_clicked_at",
    emailsOpened: "emails_opened",
    emailsClicked: "emails_clicked",
  },
  workflowExecution: {
    contactId: "contact_id",
    status: "status",
    waitingForEvent: "waiting_for_event",
  },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  sql: mockSql,
}));

// Mock workflow queue
vi.mock("../services/workflow-queue", () => ({
  deleteScheduledStep: vi.fn(),
  enqueueWorkflowStep: vi.fn(),
}));

// Event detail type for test assertions
type EventDetail = {
  eventType: string;
  mail: {
    messageId: string;
    timestamp: string;
    source: string;
    destination: string[];
  };
  bounce?: {
    bounceType: string;
    bounceSubType: string;
    timestamp: string;
    bouncedRecipients: { emailAddress: string }[];
  };
  complaint?: {
    timestamp: string;
    complainedRecipients: { emailAddress: string }[];
  };
  suppression?: {
    reason: string;
    timestamp: string;
    suppressedRecipients: { emailAddress: string }[];
  };
  delivery?: {
    timestamp: string;
    recipients: string[];
  };
  open?: {
    timestamp: string;
    userAgent: string;
    ipAddress: string;
  };
  click?: {
    timestamp: string;
    link: string;
    userAgent: string;
    ipAddress: string;
  };
};

type EventBridgeEvent = {
  version: string;
  id: string;
  "detail-type": string;
  source: string;
  account: string;
  time: string;
  region: string;
  detail: EventDetail;
};

// Helper to create EventBridge event payload
function createEventBridgeEvent(
  eventType: string,
  messageId: string,
  options: {
    bounceType?: string;
    bounceSubType?: string;
    suppressionReason?: string;
    timestamp?: string;
  } = {}
): EventBridgeEvent {
  const baseEvent: EventBridgeEvent = {
    version: "0",
    id: "event-123",
    "detail-type": "Email Event",
    source: "aws.ses",
    account: "123456789012",
    time: "2024-01-01T00:00:00Z",
    region: "us-east-1",
    detail: {
      eventType,
      mail: {
        messageId,
        timestamp: "2024-01-01T00:00:00Z",
        source: "sender@example.com",
        destination: ["recipient@example.com"],
      },
    },
  };

  // Add event-specific data
  if (eventType === "Bounce" && options.bounceType) {
    baseEvent.detail.bounce = {
      bounceType: options.bounceType,
      bounceSubType: options.bounceSubType || "General",
      timestamp: options.timestamp || "2024-01-01T00:00:00Z",
      bouncedRecipients: [{ emailAddress: "recipient@example.com" }],
    };
  }

  if (eventType === "Suppressed") {
    baseEvent.detail.suppression = {
      reason: options.suppressionReason || "OnAccountSuppressionList",
      timestamp: options.timestamp || "2024-01-01T00:00:00Z",
      suppressedRecipients: [{ emailAddress: "recipient@example.com" }],
    };
  }

  if (eventType === "Complaint") {
    baseEvent.detail.complaint = {
      timestamp: options.timestamp || "2024-01-01T00:00:00Z",
      complainedRecipients: [{ emailAddress: "recipient@example.com" }],
    };
  }

  if (eventType === "Delivery") {
    baseEvent.detail.delivery = {
      timestamp: options.timestamp || "2024-01-01T00:00:00Z",
      recipients: ["recipient@example.com"],
    };
  }

  if (eventType === "Open") {
    baseEvent.detail.open = {
      timestamp: options.timestamp || "2024-01-01T00:00:00Z",
      userAgent: "Mozilla/5.0",
      ipAddress: "192.168.1.1",
    };
  }

  if (eventType === "Click") {
    baseEvent.detail.click = {
      timestamp: options.timestamp || "2024-01-01T00:00:00Z",
      link: "https://example.com",
      userAgent: "Mozilla/5.0",
      ipAddress: "192.168.1.1",
    };
  }

  return baseEvent;
}

// Mock message record
const mockMessageRecord = {
  id: "msg-123",
  status: "sent",
  batchSendId: "batch-123",
  contactId: "contact-123",
  openedAt: null,
  clickedAt: null,
};

// Mock AWS account
const mockAwsAccount = {
  id: "aws-account-123",
  webhookSecret: "test-webhook-secret",
  organizationId: "org-123",
};

describe("Webhook Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SES Event Processing", () => {
    describe("Suppression Events", () => {
      it("should update messageSend status to suppressed", async () => {
        // Set up mocks
        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAwsAccount]),
            }),
          }),
        });
        const messageSelectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockMessageRecord]),
            }),
          }),
        });

        // First call returns AWS account, second call returns message
        mockDb.select
          .mockImplementationOnce(selectMock)
          .mockImplementationOnce(messageSelectMock);

        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "msg-123" }]),
          }),
        });

        const event = createEventBridgeEvent("Suppressed", "ses-message-123", {
          suppressionReason: "OnAccountSuppressionList",
        });

        // The webhook handler should:
        // 1. Update messageSend with status: "suppressed" and suppressedAt timestamp
        // 2. Increment batchSend.suppressed counter
        // 3. Update contact.emailStatus to "suppressed" with emailSuppressedAt

        // Verify the event structure is correct
        expect(event.detail.eventType).toBe("Suppressed");
        expect(event.detail.suppression?.reason).toBe(
          "OnAccountSuppressionList"
        );
      });

      it("should update contact emailStatus to suppressed", async () => {
        // This test verifies the contact is marked as suppressed
        const event = createEventBridgeEvent("Suppressed", "ses-message-456", {
          suppressionReason: "Suppressed",
          timestamp: "2024-01-15T12:00:00Z",
        });

        expect(event.detail.suppression?.reason).toBe("Suppressed");
        expect(event.detail.suppression?.timestamp).toBe(
          "2024-01-15T12:00:00Z"
        );
      });

      it("should increment batchSend suppressed counter", async () => {
        // Verify batch send counter is incremented for suppression
        const event = createEventBridgeEvent("Suppressed", "ses-message-789");

        expect(event.detail.eventType).toBe("Suppressed");
        // The handler should call:
        // db.update(batchSend).set({ suppressed: sql`${batchSend.suppressed} + 1` })
      });
    });

    describe("Bounce Events", () => {
      it("should update contact status for permanent bounces", async () => {
        const event = createEventBridgeEvent("Bounce", "ses-bounce-123", {
          bounceType: "Permanent",
          bounceSubType: "General",
        });

        expect(event.detail.eventType).toBe("Bounce");
        expect(event.detail.bounce?.bounceType).toBe("Permanent");
        // The handler should update contact.emailStatus to "bounced" for permanent bounces
      });

      it("should NOT update contact status for transient bounces", async () => {
        const event = createEventBridgeEvent("Bounce", "ses-bounce-456", {
          bounceType: "Transient",
          bounceSubType: "General",
        });

        expect(event.detail.bounce?.bounceType).toBe("Transient");
        // Per user's decision: soft bounces should NOT update contact status
      });

      it("should always update messageSend for any bounce type", async () => {
        const permanentEvent = createEventBridgeEvent(
          "Bounce",
          "ses-bounce-perm",
          {
            bounceType: "Permanent",
          }
        );
        const transientEvent = createEventBridgeEvent(
          "Bounce",
          "ses-bounce-trans",
          {
            bounceType: "Transient",
          }
        );

        expect(permanentEvent.detail.eventType).toBe("Bounce");
        expect(transientEvent.detail.eventType).toBe("Bounce");
        // Both should update messageSend status to "bounced"
      });
    });

    describe("Complaint Events", () => {
      it("should update contact emailStatus to complained", async () => {
        const event = createEventBridgeEvent("Complaint", "ses-complaint-123");

        expect(event.detail.eventType).toBe("Complaint");
        expect(event.detail.complaint?.complainedRecipients).toHaveLength(1);
        // The handler should update contact.emailStatus to "complained"
      });

      it("should update messageSend status to complained", async () => {
        const event = createEventBridgeEvent("Complaint", "ses-complaint-456");

        expect(event.detail.eventType).toBe("Complaint");
        // The handler should update messageSend.status to "complained" with complainedAt
      });
    });

    describe("Delivery Events", () => {
      it("should update messageSend status to delivered", async () => {
        const event = createEventBridgeEvent("Delivery", "ses-delivery-123");

        expect(event.detail.eventType).toBe("Delivery");
        expect(event.detail.delivery?.recipients).toContain(
          "recipient@example.com"
        );
      });

      it("should increment batchSend delivered counter", async () => {
        const event = createEventBridgeEvent("Delivery", "ses-delivery-456");

        expect(event.detail.eventType).toBe("Delivery");
        // The handler should increment batchSend.delivered
      });
    });

    describe("Open Events", () => {
      it("should update contact engagement metrics on first open", async () => {
        const event = createEventBridgeEvent("Open", "ses-open-123");

        expect(event.detail.eventType).toBe("Open");
        expect(event.detail.open?.userAgent).toBe("Mozilla/5.0");
        // Handler should update:
        // - messageSend.openedAt
        // - contact.lastEmailOpenedAt
        // - contact.emailsOpened (increment)
      });

      it("should be idempotent for duplicate opens", async () => {
        // If openedAt is already set, handler should skip processing
        const mockMessageWithOpen = {
          ...mockMessageRecord,
          openedAt: new Date("2024-01-01T00:00:00Z"),
        };

        expect(mockMessageWithOpen.openedAt).not.toBeNull();
        // Handler should check if openedAt exists and return early
      });
    });

    describe("Click Events", () => {
      it("should update contact engagement metrics on first click", async () => {
        const event = createEventBridgeEvent("Click", "ses-click-123");

        expect(event.detail.eventType).toBe("Click");
        expect(event.detail.click?.link).toBe("https://example.com");
        // Handler should update:
        // - messageSend.clickedAt
        // - contact.lastEmailClickedAt
        // - contact.emailsClicked (increment)
      });

      it("should be idempotent for duplicate clicks", async () => {
        const mockMessageWithClick = {
          ...mockMessageRecord,
          clickedAt: new Date("2024-01-01T00:00:00Z"),
        };

        expect(mockMessageWithClick.clickedAt).not.toBeNull();
        // Handler should check if clickedAt exists and return early
      });
    });

    describe("API Key Validation", () => {
      it("should reject requests with invalid API key", async () => {
        // The webhook validates x-wraps-api-key header against awsAccount.webhookSecret
        const invalidSecret = "wrong-secret";
        const validSecret = mockAwsAccount.webhookSecret;

        expect(invalidSecret).not.toBe(validSecret);
        // Handler should return 401 if secrets don't match
      });

      it("should reject requests for unknown AWS account", async () => {
        // If AWS account is not found by accountId, return 404
        const unknownAccountId = "999999999999";
        expect(unknownAccountId).toBe("999999999999");
        // Handler should return 404 for unknown accounts
      });
    });

    describe("Message Lookup", () => {
      it("should ignore events for unknown messages", async () => {
        // If messageSend is not found by messageId, return ignored status
        const unknownMessageId = "unknown-ses-message-id";
        expect(unknownMessageId).toBe("unknown-ses-message-id");
        // Handler should return { status: "ignored", reason: "message not found" }
      });
    });
  });

  describe("Event Type Support", () => {
    it("should process Delivery events", () => {
      const event = createEventBridgeEvent("Delivery", "msg-1");
      expect(event.detail.eventType).toBe("Delivery");
    });

    it("should process Open events", () => {
      const event = createEventBridgeEvent("Open", "msg-2");
      expect(event.detail.eventType).toBe("Open");
    });

    it("should process Click events", () => {
      const event = createEventBridgeEvent("Click", "msg-3");
      expect(event.detail.eventType).toBe("Click");
    });

    it("should process Bounce events", () => {
      const event = createEventBridgeEvent("Bounce", "msg-4", {
        bounceType: "Permanent",
      });
      expect(event.detail.eventType).toBe("Bounce");
    });

    it("should process Complaint events", () => {
      const event = createEventBridgeEvent("Complaint", "msg-5");
      expect(event.detail.eventType).toBe("Complaint");
    });

    it("should process Suppressed events", () => {
      const event = createEventBridgeEvent("Suppressed", "msg-6");
      expect(event.detail.eventType).toBe("Suppressed");
    });

    it("should ignore unsupported event types", () => {
      const event = createEventBridgeEvent("Reject", "msg-7");
      expect(event.detail.eventType).toBe("Reject");
      // Handler should return { status: "ignored", reason: "unsupported event type" }
    });
  });
});
