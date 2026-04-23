/**
 * Batch Draft Promote Tests
 *
 * Tests for POST /v1/batch/:id/send — promotes an existing draft batch_send
 * row to an active send (queued or scheduled). Verifies:
 *  - Draft-scoped update (org-scoped, status='draft')
 *  - IDOR prevention (cross-org draft unreachable)
 *  - Status gating (non-draft rejected with 400)
 *  - Scheduled vs immediate side-effect routing
 *  - Single-row update invariant (no concurrent promote)
 */

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted so these are available when vi.mock factories run
const {
  mockSelectLimit,
  mockInsertReturning,
  mockUpdateReturning,
  mockEnqueueJob,
  mockCreateBroadcastSchedule,
  mockDeleteBroadcastSchedule,
} = vi.hoisted(() => ({
  mockSelectLimit: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockEnqueueJob: vi.fn(async (_args: unknown) => {}),
  mockCreateBroadcastSchedule: vi.fn(async (_args: unknown) => {}),
  mockDeleteBroadcastSchedule: vi.fn(async (_args: unknown) => {}),
}));

vi.mock("@wraps/db", () => {
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
          where: vi.fn(() => ({
            returning: mockUpdateReturning,
          })),
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
  enqueueJob: mockEnqueueJob,
}));

vi.mock("../services/scheduler", () => ({
  createBroadcastSchedule: mockCreateBroadcastSchedule,
  deleteBroadcastSchedule: mockDeleteBroadcastSchedule,
}));

// Import after mocks are set up
const { batchRoutes } = await import("../routes/batch");

function createApp() {
  return new Elysia().use(batchRoutes);
}

const draftRow = {
  id: "batch-draft-1",
  organizationId: "org-123",
  awsAccountId: "aws-acc-1",
  channel: "email",
  name: "Draft Campaign",
  status: "draft",
  audienceType: "all",
  topicId: null,
  segmentId: null,
  subject: "Hello",
  previewText: null,
  from: "hello@example.com",
  fromName: null,
  replyTo: null,
  emailTemplateId: null,
  htmlContent: null,
  body: null,
  senderId: null,
  scheduledFor: null,
  totalRecipients: 0,
  processedRecipients: 0,
  sent: 0,
  failed: 0,
  startedAt: null,
  completedAt: null,
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  createdBy: "user-123",
  updatedAt: new Date("2026-04-23T00:00:00.000Z"),
};

describe("POST /v1/batch/:id/send (promote draft)", () => {
  beforeEach(() => {
    mockSelectLimit.mockReset();
    mockInsertReturning.mockReset();
    mockUpdateReturning.mockReset();
    mockEnqueueJob.mockReset();
    mockCreateBroadcastSchedule.mockReset();
    mockDeleteBroadcastSchedule.mockReset();
  });

  it("loads a draft matching (id, orgId) and enqueues it (201)", async () => {
    // 1st select: load the existing batch by (id, orgId)
    mockSelectLimit.mockResolvedValueOnce([draftRow]);
    // 2nd select: awsAccount ownership check
    mockSelectLimit.mockResolvedValueOnce([{ id: draftRow.awsAccountId }]);

    // update().returning() returns the single promoted row
    mockUpdateReturning.mockResolvedValueOnce([
      {
        ...draftRow,
        status: "queued",
        totalRecipients: 42,
      },
    ]);

    const app = createApp();

    const response = await app.handle(
      new Request(`http://localhost/v1/batch/${draftRow.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: draftRow.awsAccountId,
          channel: "email",
          subject: "Hello",
          from: "hello@example.com",
          totalRecipients: 42,
        }),
      })
    );

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.id).toBe(draftRow.id);
    expect(body.status).toBe("queued");

    // Side-effect: immediate send → enqueueJob called, not scheduler
    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
    expect(mockCreateBroadcastSchedule).not.toHaveBeenCalled();
  });

  it("returns 404 when the draft belongs to a different org (IDOR)", async () => {
    // The org-scoped select returns empty — simulating a draft that exists
    // in another org but is unreachable under the authenticated org's scope.
    mockSelectLimit.mockResolvedValueOnce([]);

    const app = createApp();

    const response = await app.handle(
      new Request(`http://localhost/v1/batch/${draftRow.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: draftRow.awsAccountId,
          channel: "email",
          subject: "Phishing",
          from: "attacker@evil.com",
          totalRecipients: 1,
        }),
      })
    );

    expect(response.status).toBe(404);

    // No side-effects should fire on a 404
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockCreateBroadcastSchedule).not.toHaveBeenCalled();
    expect(mockUpdateReturning).not.toHaveBeenCalled();
  });

  it("returns 400 when the target batch is not a draft (e.g., already queued)", async () => {
    // Row exists in this org but is already queued — promote must refuse.
    mockSelectLimit.mockResolvedValueOnce([
      {
        ...draftRow,
        status: "queued",
      },
    ]);

    const app = createApp();

    const response = await app.handle(
      new Request(`http://localhost/v1/batch/${draftRow.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: draftRow.awsAccountId,
          channel: "email",
          subject: "Hello",
          from: "hello@example.com",
          totalRecipients: 10,
        }),
      })
    );

    expect(response.status).toBe(400);

    // No side-effects — the route must bail before update/enqueue.
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockCreateBroadcastSchedule).not.toHaveBeenCalled();
    expect(mockUpdateReturning).not.toHaveBeenCalled();
  });

  it("with scheduledFor in the future, sets status='scheduled' and calls createBroadcastSchedule", async () => {
    mockSelectLimit.mockResolvedValueOnce([draftRow]);
    mockSelectLimit.mockResolvedValueOnce([{ id: draftRow.awsAccountId }]);

    const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);

    mockUpdateReturning.mockResolvedValueOnce([
      {
        ...draftRow,
        status: "scheduled",
        scheduledFor,
        totalRecipients: 7,
      },
    ]);

    const app = createApp();

    const response = await app.handle(
      new Request(`http://localhost/v1/batch/${draftRow.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: draftRow.awsAccountId,
          channel: "email",
          subject: "Hello",
          from: "hello@example.com",
          totalRecipients: 7,
          scheduledFor: scheduledFor.toISOString(),
        }),
      })
    );

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.status).toBe("scheduled");

    // Scheduler path — NOT the queue path.
    expect(mockCreateBroadcastSchedule).toHaveBeenCalledTimes(1);
    expect(mockEnqueueJob).not.toHaveBeenCalled();

    const args = mockCreateBroadcastSchedule.mock.calls[0][0] as unknown as {
      batchId: string;
      organizationId: string;
      awsAccountId: string;
      scheduledFor: Date;
      channel: string;
    };
    expect(args.batchId).toBe(draftRow.id);
    expect(args.organizationId).toBe("org-123");
    expect(args.awsAccountId).toBe(draftRow.awsAccountId);
    expect(args.channel).toBe("email");
  });

  it("refuses to promote when the status-gated update returns 0 rows (concurrent promote)", async () => {
    // Draft existed at read time...
    mockSelectLimit.mockResolvedValueOnce([draftRow]);
    // ...AWS account ownership OK...
    mockSelectLimit.mockResolvedValueOnce([{ id: draftRow.awsAccountId }]);
    // ...but the guarded update finds zero rows (someone else promoted it first).
    mockUpdateReturning.mockResolvedValueOnce([]);

    const app = createApp();

    const response = await app.handle(
      new Request(`http://localhost/v1/batch/${draftRow.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: draftRow.awsAccountId,
          channel: "email",
          subject: "Hello",
          from: "hello@example.com",
          totalRecipients: 5,
        }),
      })
    );

    // Endpoint raises — we document 409 as the chosen response for this race.
    expect(response.status).toBe(409);

    // Critical: NO side-effects fire when the single-row invariant is broken.
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockCreateBroadcastSchedule).not.toHaveBeenCalled();
  });
});
