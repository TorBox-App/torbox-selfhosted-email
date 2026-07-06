/**
 * Webhook Counter Idempotency Tests
 *
 * SES -> EventBridge delivery is at-least-once: the same lifecycle event can
 * be redelivered. The Delivery/Bounce/Complaint/Suppressed handlers must only
 * increment batchSend lifecycle counters and messageUsageMonthly billing
 * counts when the underlying messageSend row genuinely transitions status —
 * a redelivered event for an already-transitioned row must not double-count.
 *
 * The update mock below applies the SAME transition guards as the real
 * handlers (a status update only "succeeds" if the row's current status
 * differs from the target), so POSTing the same event twice genuinely
 * exercises the idempotency guard rather than a mock that always reports
 * success.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBounceEvent,
  buildComplaintEvent,
  buildDeliveryEvent,
  buildSuppressionEvent,
} from "./fixtures/ses-events";

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();

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
      update: mockDbUpdate,
      insert: mockDbInsert,
    },
  };
});

const { webhooksRoutes } = await import("../routes/webhooks");
const { Elysia } = await import("elysia");

const TEST_AWS_ACCOUNT_NUMBER = "123456789012";
const TEST_WEBHOOK_SECRET = "test-secret-key";
const ORG_ID = "org-1";

function createTestApp() {
  return new Elysia().use(webhooksRoutes);
}

async function sendWebhookEvent(
  app: ReturnType<typeof createTestApp>,
  body: Record<string, unknown>
) {
  return app.handle(
    new Request(`http://localhost/webhooks/ses/${TEST_AWS_ACCOUNT_NUMBER}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wraps-api-key": TEST_WEBHOOK_SECRET,
      },
      body: JSON.stringify(body),
    })
  );
}

const mockAwsAccount = {
  id: "aws-1",
  webhookSecret: TEST_WEBHOOK_SECRET,
  organizationId: ORG_ID,
};

type MessageState = {
  id: string;
  status: string;
  batchSendId: string | null;
  contactId: string | null;
  openedAt: Date | null;
  clickedAt: Date | null;
};

// Dual-shape select mock: works whether a select's terminal call awaits at
// .limit() (current code for both account + message lookups) or at .where()
// directly (plan 086's rewrite of the account lookup only). Using the same
// shape for every select in this file keeps it correct under both versions.
function selectChain(rows: unknown[]) {
  const whereResult = Object.assign(Promise.resolve(rows), {
    limit: vi.fn().mockResolvedValue(rows),
  });
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
    }),
  };
}

function withReturning(rows: unknown[]) {
  return Object.assign(Promise.resolve(undefined), {
    returning: vi.fn().mockResolvedValue(rows),
  });
}

/**
 * Minimal stateful harness modeling the messageSend row, batchSend counters,
 * and messageUsageMonthly count across multiple HTTP round trips.
 */
function createHarness(initialMessage: MessageState) {
  const message = { ...initialMessage };
  const counters = {
    delivered: 0,
    bounced: 0,
    complained: 0,
    suppressed: 0,
    failedDecrements: 0,
  };
  const usage = { messageCount: 0 };

  mockDbUpdate.mockImplementation(() => ({
    set: (data: Record<string, unknown>) => ({
      where: () => {
        if (data.status === "delivered") {
          const isHealedAttempt = Object.hasOwn(data, "error");
          if (isHealedAttempt) {
            if (message.status === "failed") {
              message.status = "delivered";
              return withReturning([{ id: message.id }]);
            }
            return withReturning([]);
          }
          if (message.status !== "failed" && message.status !== "delivered") {
            message.status = "delivered";
            return withReturning([{ id: message.id }]);
          }
          return withReturning([]);
        }
        if (data.status === "bounced") {
          if (message.status !== "bounced") {
            message.status = "bounced";
            return withReturning([{ id: message.id }]);
          }
          return withReturning([]);
        }
        if (data.status === "complained") {
          if (message.status !== "complained") {
            message.status = "complained";
            return withReturning([{ id: message.id }]);
          }
          return withReturning([]);
        }
        if (data.status === "suppressed") {
          if (message.status !== "suppressed") {
            message.status = "suppressed";
            return withReturning([{ id: message.id }]);
          }
          return withReturning([]);
        }
        // batchSend counter updates (raw sql`col + 1` fragments) — count
        // invocations rather than evaluating the SQL fragment.
        if (Object.hasOwn(data, "delivered")) {
          counters.delivered++;
          if (Object.hasOwn(data, "failed")) {
            counters.failedDecrements++;
          }
          return withReturning([]);
        }
        if (Object.hasOwn(data, "bounced")) {
          counters.bounced++;
          return withReturning([]);
        }
        if (Object.hasOwn(data, "complained")) {
          counters.complained++;
          return withReturning([]);
        }
        if (Object.hasOwn(data, "suppressed")) {
          counters.suppressed++;
          return withReturning([]);
        }
        // contact updates etc. — no-op success, not under test here.
        return withReturning([]);
      },
    }),
  }));

  mockDbInsert.mockImplementation(() => ({
    values: () => ({
      onConflictDoUpdate: () => {
        usage.messageCount++;
        return Promise.resolve(undefined);
      },
      onConflictDoNothing: () => withReturning([]),
    }),
  }));

  /** Queue the account + message selects for exactly one HTTP request. */
  function queueRequest() {
    mockDbSelect.mockReturnValueOnce(selectChain([mockAwsAccount]));
    mockDbSelect.mockReturnValueOnce(selectChain([{ ...message }]));
  }

  return { message, counters, usage, queueRequest };
}

describe("Webhook: lifecycle counter idempotency", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("duplicate Delivery bumps batchSend.delivered exactly once", async () => {
    const harness = createHarness({
      id: "msg-1",
      status: "sent",
      batchSendId: "batch-1",
      contactId: null,
      openedAt: null,
      clickedAt: null,
    });

    const event = buildDeliveryEvent();

    harness.queueRequest();
    const res1 = await sendWebhookEvent(app, event);
    expect(res1.status).toBe(200);
    expect((await res1.json()).status).toBe("processed");

    harness.queueRequest();
    const res2 = await sendWebhookEvent(app, event);
    expect(res2.status).toBe(200);

    expect(harness.counters.delivered).toBe(1);
    expect(harness.message.status).toBe("delivered");
  });

  it("duplicate Delivery bumps messageUsageMonthly exactly once (matched path)", async () => {
    const harness = createHarness({
      id: "msg-1",
      status: "sent",
      batchSendId: null,
      contactId: null,
      openedAt: null,
      clickedAt: null,
    });

    const event = buildDeliveryEvent();

    harness.queueRequest();
    await sendWebhookEvent(app, event);
    harness.queueRequest();
    await sendWebhookEvent(app, event);

    expect(harness.usage.messageCount).toBe(1);
  });

  it("duplicate Bounce bumps batchSend.bounced exactly once", async () => {
    const harness = createHarness({
      id: "msg-1",
      status: "sent",
      batchSendId: "batch-1",
      contactId: null,
      openedAt: null,
      clickedAt: null,
    });

    const event = buildBounceEvent({
      bounceType: "Permanent",
      bounceSubType: "General",
    });

    harness.queueRequest();
    await sendWebhookEvent(app, event);
    harness.queueRequest();
    await sendWebhookEvent(app, event);

    expect(harness.counters.bounced).toBe(1);
  });

  it("duplicate Complaint bumps batchSend.complained exactly once", async () => {
    const harness = createHarness({
      id: "msg-1",
      status: "sent",
      batchSendId: "batch-1",
      contactId: null,
      openedAt: null,
      clickedAt: null,
    });

    const event = buildComplaintEvent();

    harness.queueRequest();
    await sendWebhookEvent(app, event);
    harness.queueRequest();
    await sendWebhookEvent(app, event);

    expect(harness.counters.complained).toBe(1);
  });

  it("duplicate Suppressed bumps batchSend.suppressed exactly once", async () => {
    const harness = createHarness({
      id: "msg-1",
      status: "sent",
      batchSendId: "batch-1",
      contactId: null,
      openedAt: null,
      clickedAt: null,
    });

    const event = buildSuppressionEvent();

    harness.queueRequest();
    await sendWebhookEvent(app, event);
    harness.queueRequest();
    await sendWebhookEvent(app, event);

    expect(harness.counters.suppressed).toBe(1);
  });

  it("first delivery still counts (regression)", async () => {
    const harness = createHarness({
      id: "msg-1",
      status: "sent",
      batchSendId: "batch-1",
      contactId: null,
      openedAt: null,
      clickedAt: null,
    });

    const event = buildDeliveryEvent();
    harness.queueRequest();
    const res = await sendWebhookEvent(app, event);

    expect(res.status).toBe(200);
    expect(harness.counters.delivered).toBe(1);
    expect(harness.usage.messageCount).toBe(1);
  });

  it("failed->delivered heal still counts once; a duplicate leaves counters unchanged", async () => {
    const harness = createHarness({
      id: "msg-1",
      status: "failed",
      batchSendId: "batch-1",
      contactId: null,
      openedAt: null,
      clickedAt: null,
    });

    const event = buildDeliveryEvent();

    harness.queueRequest();
    const res1 = await sendWebhookEvent(app, event);
    expect(res1.status).toBe(200);
    expect(harness.counters.delivered).toBe(1);
    expect(harness.counters.failedDecrements).toBe(1);
    expect(harness.message.status).toBe("delivered");

    harness.queueRequest();
    const res2 = await sendWebhookEvent(app, event);
    expect(res2.status).toBe(200);

    // Duplicate delivery for an already-delivered row must not re-count.
    expect(harness.counters.delivered).toBe(1);
    expect(harness.counters.failedDecrements).toBe(1);
  });
});
