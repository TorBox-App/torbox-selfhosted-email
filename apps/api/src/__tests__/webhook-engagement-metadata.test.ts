import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn(),
  deleteScheduledStep: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");
  return {
    ...actual,
    db: {
      select: mockDbSelect,
      update: mockDbUpdate,
    },
  };
});

const { webhooksRoutes } = await import("../routes/webhooks");
const { Elysia } = await import("elysia");

const TEST_AWS_ACCOUNT_NUMBER = "123456789012";
const TEST_WEBHOOK_SECRET = "test-secret-key";

function createTestApp() {
  return new Elysia().use(webhooksRoutes);
}

function makeOpenEvent(openData: Record<string, unknown> = {}) {
  return {
    version: "0",
    id: "event-1",
    "detail-type": "Email Sending Events",
    source: "aws.ses",
    account: TEST_AWS_ACCOUNT_NUMBER,
    time: new Date().toISOString(),
    region: "us-east-1",
    detail: {
      eventType: "Open",
      mail: {
        messageId: "ses-msg-001",
        timestamp: new Date().toISOString(),
        source: "noreply@test.com",
        destination: ["user@example.com"],
      },
      open: {
        timestamp: "2026-03-09T12:00:00Z",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        ipAddress: "203.0.113.42",
        ...openData,
      },
    },
  };
}

function makeClickEvent(clickData: Record<string, unknown> = {}) {
  return {
    version: "0",
    id: "event-2",
    "detail-type": "Email Sending Events",
    source: "aws.ses",
    account: TEST_AWS_ACCOUNT_NUMBER,
    time: new Date().toISOString(),
    region: "us-east-1",
    detail: {
      eventType: "Click",
      mail: {
        messageId: "ses-msg-002",
        timestamp: new Date().toISOString(),
        source: "noreply@test.com",
        destination: ["user@example.com"],
      },
      click: {
        timestamp: "2026-03-09T12:05:00Z",
        link: "https://example.com/cta",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        ipAddress: "198.51.100.10",
        ...clickData,
      },
    },
  };
}

function setupMocks(messageOverrides: Record<string, unknown> = {}) {
  // Mock account lookup
  mockDbSelect.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve([
            {
              id: "aws-acc-1",
              webhookSecret: TEST_WEBHOOK_SECRET,
              organizationId: "org-1",
            },
          ]),
      }),
    }),
  });

  // Mock messageSend lookup
  mockDbSelect.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve([
            {
              id: "msg-1",
              status: "delivered",
              batchSendId: null,
              contactId: null,
              openedAt: null,
              clickedAt: null,
              ...messageOverrides,
            },
          ]),
      }),
    }),
  });

  // Mock update calls — chain: set → where → Promise
  mockDbUpdate.mockImplementation(() => ({
    set: (data: Record<string, unknown>) => {
      // Capture the set data for assertions
      (mockDbUpdate as any).__lastSetData = data;
      return {
        where: () => Promise.resolve(),
      };
    },
  }));
}

describe("webhook engagement metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processOpen", () => {
    it("stores userAgent and ipAddress from SES open event", async () => {
      setupMocks();
      const app = createTestApp();

      const response = await app.handle(
        new Request(
          `http://localhost/webhooks/ses/${TEST_AWS_ACCOUNT_NUMBER}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-wraps-api-key": TEST_WEBHOOK_SECRET,
            },
            body: JSON.stringify(makeOpenEvent()),
          }
        )
      );

      expect(response.status).toBe(200);

      // Find the update call that sets openUserAgent
      const updateCalls = mockDbUpdate.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);

      // Check that set() was called with openUserAgent and openIpAddress
      const setDataCalls = updateCalls.map(() => {
        // Each update call returns an object with .set() which captures data
        return (mockDbUpdate as any).__lastSetData;
      });

      // The first update should be the messageSend update with engagement metadata
      const firstSetData = (mockDbUpdate as any).__lastSetData;
      expect(firstSetData).toHaveProperty("openUserAgent");
      expect(firstSetData.openUserAgent).toBe(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
      );
      expect(firstSetData).toHaveProperty("openIpAddress");
      expect(firstSetData.openIpAddress).toBe("203.0.113.42");
    });
  });

  describe("processClick", () => {
    it("stores userAgent and ipAddress from SES click event", async () => {
      setupMocks();
      const app = createTestApp();

      const response = await app.handle(
        new Request(
          `http://localhost/webhooks/ses/${TEST_AWS_ACCOUNT_NUMBER}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-wraps-api-key": TEST_WEBHOOK_SECRET,
            },
            body: JSON.stringify(makeClickEvent()),
          }
        )
      );

      expect(response.status).toBe(200);

      const firstSetData = (mockDbUpdate as any).__lastSetData;
      expect(firstSetData).toHaveProperty("clickUserAgent");
      expect(firstSetData.clickUserAgent).toBe(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
      );
      expect(firstSetData).toHaveProperty("clickIpAddress");
      expect(firstSetData.clickIpAddress).toBe("198.51.100.10");
    });
  });
});
