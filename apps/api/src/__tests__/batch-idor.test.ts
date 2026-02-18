/**
 * Batch IDOR Security Tests
 *
 * Tests that batch send validates awsAccountId belongs to the
 * authenticated organization, preventing cross-org AWS account usage.
 */

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted so these are available when vi.mock factories run (hoisted)
const { mockSelectLimit, mockInsertReturning } = vi.hoisted(() => ({
  mockSelectLimit: vi.fn(),
  mockInsertReturning: vi.fn(),
}));

vi.mock("@wraps/db", () => {
  // Drizzle queries can end with .where() (awaited directly) or .where().limit()
  // This mock supports both by making where() return a thenable with a .limit() method
  const makeWhereResult = () => ({
    limit: mockSelectLimit,
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle query chains
    then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
      return Promise.resolve(mockSelectLimit()).then(resolve, reject);
    },
  });

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => makeWhereResult()),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: mockInsertReturning,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
    },
    batchSend: {
      id: "id",
      organizationId: "organization_id",
      awsAccountId: "aws_account_id",
      channel: "channel",
      name: "name",
      status: "status",
      audienceType: "audience_type",
      topicId: "topic_id",
      segmentId: "segment_id",
      subject: "subject",
      previewText: "preview_text",
      from: "from",
      fromName: "from_name",
      replyTo: "reply_to",
      emailTemplateId: "email_template_id",
      htmlContent: "html_content",
      body: "body",
      senderId: "sender_id",
      scheduledFor: "scheduled_for",
      totalRecipients: "total_recipients",
      processedRecipients: "processed_recipients",
      sent: "sent",
      failed: "failed",
      startedAt: "started_at",
      completedAt: "completed_at",
      createdAt: "created_at",
      createdBy: "created_by",
      updatedAt: "updated_at",
    },
    awsAccount: {
      id: "id",
      organizationId: "organization_id",
    },
    contact: {
      id: "id",
      organizationId: "organization_id",
      email: "email",
      emailStatus: "email_status",
      phone: "phone",
      smsStatus: "sms_status",
    },
    contactTopic: {
      contactId: "contact_id",
      topicId: "topic_id",
      status: "status",
    },
    eq: vi.fn((a, b) => ({ eq: [a, b] })),
    and: vi.fn((...args) => ({ and: args })),
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => ({ and: args })),
  exists: vi.fn(),
  isNotNull: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../middleware/auth", () => ({
  createAuthenticatedRoutes: vi.fn((prefix: string) =>
    new Elysia({ prefix }).derive(() => ({
      auth: {
        apiKeyId: "key-123",
        organizationId: "org-123",
        userId: "user-123",
        planId: "pro",
      },
      authError: null,
    }))
  ),
}));

vi.mock("../middleware/plan-gate", () => ({
  planGateMiddleware: vi.fn(() => new Elysia()),
}));

vi.mock("../middleware/rate-limit", () => ({
  rateLimitMiddleware: new Elysia(),
}));

vi.mock("../services/queue", () => ({
  enqueueJob: vi.fn(async () => {}),
}));

vi.mock("../services/scheduler", () => ({
  createBroadcastSchedule: vi.fn(async () => {}),
  deleteBroadcastSchedule: vi.fn(async () => {}),
}));

// Import after mocks are set up
const { batchRoutes } = await import("../routes/batch");

function createApp() {
  return new Elysia().use(batchRoutes);
}

describe("Batch IDOR Prevention", () => {
  beforeEach(() => {
    mockSelectLimit.mockReset();
    mockInsertReturning.mockReset();
  });

  it("allows batch send when awsAccountId belongs to the authenticated org", async () => {
    // First select: AWS account ownership check → found
    mockSelectLimit.mockResolvedValueOnce([{ id: "valid-aws-account" }]);
    // Second select: recipient count query
    mockSelectLimit.mockResolvedValueOnce([{ count: 50 }]);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: "batch-new",
        status: "queued",
        channel: "email",
        totalRecipients: 50,
        createdAt: new Date("2024-01-01"),
      },
    ]);

    const app = createApp();

    const response = await app.handle(
      new Request("http://localhost/v1/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: "valid-aws-account",
          channel: "email",
          subject: "Legit Campaign",
          from: "hello@mycompany.com",
        }),
      })
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.id).toBe("batch-new");
    expect(body.status).toBe("queued");
  });

  it("rejects batch send when awsAccountId does not belong to the authenticated org", async () => {
    // AWS account ownership check → not found
    mockSelectLimit.mockResolvedValueOnce([]);

    const app = createApp();

    const response = await app.handle(
      new Request("http://localhost/v1/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: "attacker-aws-account-id",
          channel: "email",
          subject: "Phishing Campaign",
          from: "legit@victim-company.com",
        }),
      })
    );

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});
