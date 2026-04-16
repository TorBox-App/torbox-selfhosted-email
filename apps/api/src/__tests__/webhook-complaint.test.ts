/**
 * Webhook Complaint Tests
 *
 * Tests that SES "Complaint" events correctly:
 * - Update messageSend status to "complained"
 * - Mark contact emailStatus as "complained"
 * - Do NOT call resumeWaitingExecutions (documents current behavior gap —
 *   see hardening backlog; complaints should probably resume waiting execs
 *   similar to bounces, but today they don't).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildComplaintEvent } from "./fixtures/ses-events";

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn(),
  deleteScheduledStep: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailDelivered: vi.fn(),
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
const { enqueueWorkflowStep } = await import("../services/workflow-queue");

const TEST_AWS_ACCOUNT_NUMBER = "123456789012";
const TEST_WEBHOOK_SECRET = "test-secret-key";

function createTestApp() {
  return new Elysia().use(webhooksRoutes);
}

function selectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function updateChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.set = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  return chain;
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
  organizationId: "org-1",
};

const mockMessageSend = {
  id: "msg-send-1",
  status: "sent",
  batchSendId: null as string | null,
  contactId: "contact-1" as string | null,
  openedAt: null,
  clickedAt: null,
};

function setupWebhookMocks(overrides: Partial<typeof mockMessageSend> = {}) {
  const message = { ...mockMessageSend, ...overrides };

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) return selectChain([mockAwsAccount]);
    if (selectCallCount === 2) return selectChain([message]);
    return selectChain([]);
  });

  const updateCalls: ReturnType<typeof updateChain>[] = [];
  mockDbUpdate.mockImplementation(() => {
    const chain = updateChain();
    updateCalls.push(chain);
    return chain;
  });

  return { updateCalls };
}

describe("Webhook: Complaint", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("sets messageSend status to 'complained'", async () => {
    const { updateCalls } = setupWebhookMocks();

    const event = buildComplaintEvent();
    const response = await sendWebhookEvent(app, event);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("processed");
    expect(body.eventType).toBe("Complaint");

    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complained",
        complainedAt: expect.any(Date),
      })
    );
  });

  it("marks contact emailStatus as 'complained'", async () => {
    const { updateCalls } = setupWebhookMocks();

    const event = buildComplaintEvent();
    await sendWebhookEvent(app, event);

    const contactUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.emailStatus ===
        "complained"
    );
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate!.set).toHaveBeenCalledWith(
      expect.objectContaining({
        emailStatus: "complained",
        emailComplainedAt: expect.any(Date),
      })
    );
  });

  // documents gap: complaint does not resume waiting executions — see hardening #27
  it("does NOT call resumeWaitingExecutions (documents current behavior)", async () => {
    setupWebhookMocks();

    const event = buildComplaintEvent();
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).not.toHaveBeenCalled();
  });
});
