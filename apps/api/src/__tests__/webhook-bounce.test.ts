/**
 * Webhook Bounce Tests
 *
 * Tests that SES "Bounce" events correctly:
 * - Update messageSend status to "bounced" with type/subtype
 * - Increment batchSend.bounced counter
 * - Mark contact emailStatus "bounced" for Permanent bounces only
 * - Call resumeWaitingExecutions with "bounced" branch
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBounceEvent } from "./fixtures/ses-events";

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
const { enqueueWorkflowStep, deleteScheduledStep } = await import(
  "../services/workflow-queue"
);

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

function selectChainNoLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
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

type MockOpts = {
  message?: Partial<typeof mockMessageSend>;
  waitingExecutions?: Array<Record<string, unknown>>;
};

function setupWebhookMocks(opts: MockOpts = {}) {
  const message = { ...mockMessageSend, ...opts.message };
  const waitingExecutions = opts.waitingExecutions ?? [];

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) return selectChain([mockAwsAccount]);
    if (selectCallCount === 2) return selectChain([message]);
    // 3rd select inside resumeWaitingExecutions: .from().where() (no .limit())
    return selectChainNoLimit(waitingExecutions);
  });

  const updateCalls: ReturnType<typeof updateChain>[] = [];
  mockDbUpdate.mockImplementation(() => {
    const chain = updateChain();
    updateCalls.push(chain);
    return chain;
  });

  return { updateCalls };
}

describe("Webhook: Bounce", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("sets messageSend status to 'bounced' with bounceType/bounceSubType", async () => {
    const { updateCalls } = setupWebhookMocks();

    const event = buildBounceEvent({
      bounceType: "Permanent",
      bounceSubType: "NoEmail",
    });
    const response = await sendWebhookEvent(app, event);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("processed");
    expect(body.eventType).toBe("Bounce");

    // First update = messageSend
    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "bounced",
        bounceType: "Permanent",
        bounceSubType: "NoEmail",
      })
    );
  });

  it("marks contact emailStatus as 'bounced' for Permanent bounces", async () => {
    const { updateCalls } = setupWebhookMocks();

    const event = buildBounceEvent({ bounceType: "Permanent" });
    await sendWebhookEvent(app, event);

    // Expect at least 2 updates: messageSend, contact
    // (no batchSend update because batchSendId is null)
    expect(updateCalls.length).toBeGreaterThanOrEqual(2);

    const contactUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.emailStatus ===
        "bounced"
    );
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate!.set).toHaveBeenCalledWith(
      expect.objectContaining({
        emailStatus: "bounced",
        emailBouncedAt: expect.any(Date),
      })
    );
  });

  it("does NOT update contact emailStatus for Transient bounces", async () => {
    const { updateCalls } = setupWebhookMocks();

    const event = buildBounceEvent({ bounceType: "Transient" });
    await sendWebhookEvent(app, event);

    // messageSend should still be updated
    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "bounced" })
    );

    // No update should carry emailStatus="bounced"
    const contactBouncedUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.emailStatus ===
        "bounced"
    );
    expect(contactBouncedUpdate).toBeUndefined();
  });

  it("calls resumeWaitingExecutions with 'bounced' branch when waiting execution present", async () => {
    setupWebhookMocks({
      waitingExecutions: [
        {
          id: "exec-1",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: null,
        },
      ],
    });

    const event = buildBounceEvent();
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resume",
        executionId: "exec-1",
        branch: "bounced",
        organizationId: "org-1",
      })
    );
  });

  it("cancels timeout scheduler when waitTimeoutSchedulerName is set", async () => {
    setupWebhookMocks({
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

    const event = buildBounceEvent({ bounceType: "Permanent" });
    await sendWebhookEvent(app, event);

    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-to-timeout-1");
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "exec-1", branch: "bounced" })
    );
  });

  it("does not call enqueueWorkflowStep when no waiting executions", async () => {
    setupWebhookMocks({ waitingExecutions: [] });

    const event = buildBounceEvent({ bounceType: "Permanent" });
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("does not call resumeWaitingExecutions when contactId is null", async () => {
    setupWebhookMocks({ message: { contactId: null } });

    const event = buildBounceEvent({ bounceType: "Permanent" });
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("resumes all waiting executions when multiple are present", async () => {
    setupWebhookMocks({
      waitingExecutions: [
        {
          id: "exec-1",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: null,
        },
        {
          id: "exec-2",
          organizationId: "org-1",
          contactId: "contact-1",
          status: "waiting",
          waitingForEvent: "email_engagement:ses-msg-001",
          waitTimeoutSchedulerName: "wraps-wf-to-timeout-2",
        },
      ],
    });

    const event = buildBounceEvent({ bounceType: "Permanent" });
    await sendWebhookEvent(app, event);

    expect(enqueueWorkflowStep).toHaveBeenCalledTimes(2);
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "exec-1", branch: "bounced" })
    );
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: "exec-2", branch: "bounced" })
    );
    expect(deleteScheduledStep).toHaveBeenCalledWith("wraps-wf-to-timeout-2");
    expect(deleteScheduledStep).toHaveBeenCalledTimes(1);
  });

  it("increments batchSend.bounced counter when batchSendId present", async () => {
    const { updateCalls } = setupWebhookMocks({
      message: { batchSendId: "batch-1" },
    });

    const event = buildBounceEvent();
    await sendWebhookEvent(app, event);

    const batchUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.bounced !==
        undefined
    );
    expect(batchUpdate).toBeDefined();
    // Drizzle sql`${batchSend.bounced} + 1` is an opaque object; guard against
    // accidental decrement/zero by stringifying the fragment.
    expect(batchUpdate!.set).toHaveBeenCalledWith(
      expect.objectContaining({
        bounced: expect.anything(),
      })
    );
    const bouncedArg = (
      batchUpdate!.set.mock.calls[0]?.[0] as Record<string, unknown>
    ).bounced as { queryChunks?: Array<{ value?: string[] }> };
    const chunkText = bouncedArg.queryChunks
      ?.flatMap((c) => c.value ?? [])
      .join(" ");
    expect(chunkText).toContain("+ 1");
  });
});
