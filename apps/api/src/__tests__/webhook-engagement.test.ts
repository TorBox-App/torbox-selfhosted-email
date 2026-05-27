/**
 * Webhook Engagement Tests
 *
 * Tests that SES "Delivery", "Open", and "Click" events correctly:
 * - Update messageSend status
 * - Update contact engagement counters and timestamps
 * - Call resumeWaitingExecutions with appropriate branch ("opened" / "clicked")
 * - Cancel waitTimeoutSchedulerName when present
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildClickEvent,
  buildDeliveryEvent,
  buildOpenEvent,
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
  trackFirstEmailDelivered: vi.fn(),
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
const { deleteScheduledStep, enqueueWorkflowStep } = await import(
  "../services/workflow-queue"
);

const TEST_AWS_ACCOUNT_NUMBER = "123456789012";
const TEST_WEBHOOK_SECRET = "test-secret-key";

function createTestApp() {
  return new Elysia().use(webhooksRoutes);
}

function selectChainLimited(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function selectChainUnlimited(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function updateChain(result: unknown = undefined) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.set = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(result ?? { rowCount: 1 }),
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
  openedAt: null as Date | null,
  clickedAt: null as Date | null,
};

type SetupOpts = {
  message?: Partial<typeof mockMessageSend>;
  waitingExecutions?: Array<Record<string, unknown>>;
};

function setupWebhookMocks(opts: SetupOpts = {}) {
  const message = { ...mockMessageSend, ...opts.message };
  const waitingExecutions = opts.waitingExecutions ?? [];

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) return selectChainLimited([mockAwsAccount]);
    if (selectCallCount === 2) return selectChainLimited([message]);
    // resumeWaitingExecutions select: no .limit()
    return selectChainUnlimited(waitingExecutions);
  });

  const updateCalls: ReturnType<typeof updateChain>[] = [];
  mockDbUpdate.mockImplementation(() => {
    const chain = updateChain();
    updateCalls.push(chain);
    return chain;
  });

  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    }),
  });

  return { updateCalls };
}

describe("Webhook: Engagement", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("delivery updates messageSend status to 'delivered'", async () => {
    const { updateCalls } = setupWebhookMocks();

    const event = buildDeliveryEvent();
    const response = await sendWebhookEvent(app, event);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("processed");
    expect(body.eventType).toBe("Delivery");

    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "delivered",
        deliveredAt: expect.any(Date),
      })
    );
  });

  it("open updates messageSend + contact engagement, calls resumeWaitingExecutions('opened')", async () => {
    const { updateCalls } = setupWebhookMocks({
      waitingExecutions: [
        {
          id: "exec-1",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: "wraps-wf-to-timeout-1",
        },
      ],
    });

    const event = buildOpenEvent();
    const response = await sendWebhookEvent(app, event);

    expect(response.status).toBe(200);

    // messageSend update
    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "opened",
        openedAt: expect.any(Date),
      })
    );

    // contact update
    const contactUpdate = updateCalls.find((c) => {
      const arg = c.set.mock.calls[0]?.[0] as Record<string, unknown>;
      return arg?.lastEmailOpenedAt !== undefined;
    });
    expect(contactUpdate).toBeDefined();

    // Timeout scheduler cancelled
    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-to-timeout-1");

    // Resume with "opened" branch
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resume",
        executionId: "exec-1",
        branch: "opened",
        organizationId: "org-1",
      })
    );
  });

  it("click updates messageSend + contact engagement, calls resumeWaitingExecutions('clicked')", async () => {
    const { updateCalls } = setupWebhookMocks({
      waitingExecutions: [
        {
          id: "exec-2",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    const event = buildClickEvent({ link: "https://example.com/cta" });
    const response = await sendWebhookEvent(app, event);

    expect(response.status).toBe(200);

    // messageSend update
    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "clicked",
        clickedAt: expect.any(Date),
        clickedUrl: "https://example.com/cta",
      })
    );

    // contact engagement update
    const contactUpdate = updateCalls.find((c) => {
      const arg = c.set.mock.calls[0]?.[0] as Record<string, unknown>;
      return arg?.lastEmailClickedAt !== undefined;
    });
    expect(contactUpdate).toBeDefined();

    // Resume with "clicked" branch
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resume",
        executionId: "exec-2",
        branch: "clicked",
      })
    );
  });

  it("cancels timeout scheduler for click when waitTimeoutSchedulerName is set", async () => {
    setupWebhookMocks({
      waitingExecutions: [
        {
          id: "exec-click",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: "wraps-wf-to-timeout-click",
        },
      ],
    });

    const event = buildClickEvent();
    await sendWebhookEvent(app, event);

    expect(deleteScheduledStep).toHaveBeenCalledWith(
      "wraps-wf-to-timeout-click"
    );
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "exec-click", branch: "clicked" })
    );
  });

  it("does not call enqueueWorkflowStep when no waiting executions (open)", async () => {
    setupWebhookMocks({ waitingExecutions: [] });

    const event = buildOpenEvent();
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("does not call enqueueWorkflowStep when no waiting executions (click)", async () => {
    setupWebhookMocks({ waitingExecutions: [] });

    const event = buildClickEvent();
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("resumes all waiting executions when multiple are present (open)", async () => {
    setupWebhookMocks({
      waitingExecutions: [
        {
          id: "exec-a",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: "wraps-wf-to-timeout-a",
        },
        {
          id: "exec-b",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    const event = buildOpenEvent();
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).toHaveBeenCalledTimes(2);
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "exec-a", branch: "opened" })
    );
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "exec-b", branch: "opened" })
    );
    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-to-timeout-a");
    expect(deleteScheduledStep).toHaveBeenCalledTimes(1);
  });

  it("does NOT call deleteScheduledStep when waitTimeoutSchedulerName is null (open event)", async () => {
    setupWebhookMocks({
      waitingExecutions: [
        {
          id: "exec-3",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    const event = buildOpenEvent();
    await sendWebhookEvent(app, event);

    // No deletion call since scheduler name is null
    expect(deleteScheduledStep).not.toHaveBeenCalled();

    // But resume was still enqueued
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resume",
        executionId: "exec-3",
        branch: "opened",
      })
    );
  });
});
