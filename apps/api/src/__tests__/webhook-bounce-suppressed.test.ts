/**
 * Webhook Bounce — bounceSubType="Suppressed" Tests
 *
 * SES sends Bounce events with bounceSubType="Suppressed" for suppression list hits.
 * These should be treated as suppressions, not standard bounces.
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
};

function setupMocks(opts: MockOpts = {}) {
  const message = { ...mockMessageSend, ...opts.message };

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) return selectChain([mockAwsAccount]);
    if (selectCallCount === 2) return selectChain([message]);
    return selectChainNoLimit([]);
  });

  const updateCalls: ReturnType<typeof updateChain>[] = [];
  mockDbUpdate.mockImplementation(() => {
    const chain = updateChain();
    updateCalls.push(chain);
    return chain;
  });

  return { updateCalls };
}

describe("Webhook: Bounce with bounceSubType=Suppressed", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("sets messageSend status to 'suppressed' (not 'bounced')", async () => {
    const { updateCalls } = setupMocks();

    const event = buildBounceEvent({
      bounceType: "Permanent",
      bounceSubType: "Suppressed",
    });
    const response = await sendWebhookEvent(app, event);

    expect(response.status).toBe(200);

    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "suppressed",
      })
    );
    expect(updateCalls[0].set).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "bounced" })
    );
  });

  it("sets contact emailStatus to 'suppressed' (not 'bounced')", async () => {
    const { updateCalls } = setupMocks();

    const event = buildBounceEvent({
      bounceType: "Permanent",
      bounceSubType: "Suppressed",
    });
    await sendWebhookEvent(app, event);

    const contactUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.emailStatus !==
        undefined
    );
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate!.set).toHaveBeenCalledWith(
      expect.objectContaining({
        emailStatus: "suppressed",
      })
    );
    expect(contactUpdate!.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ emailStatus: "bounced" })
    );
  });

  it("increments batchSend.suppressed (not .bounced) when batchSendId present", async () => {
    const { updateCalls } = setupMocks({
      message: { batchSendId: "batch-1" },
    });

    const event = buildBounceEvent({
      bounceType: "Permanent",
      bounceSubType: "Suppressed",
    });
    await sendWebhookEvent(app, event);

    const suppressedCounterUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.suppressed !==
        undefined
    );
    expect(suppressedCounterUpdate).toBeDefined();
    const suppressedArg = (
      suppressedCounterUpdate!.set.mock.calls[0]?.[0] as Record<string, unknown>
    ).suppressed as { queryChunks?: Array<{ value?: string[] }> };
    const chunkText = suppressedArg.queryChunks
      ?.flatMap((c) => c.value ?? [])
      .join(" ");
    expect(chunkText).toContain("+ 1");

    const bouncedCounterUpdate = updateCalls.find(
      (c) =>
        (c.set.mock.calls[0]?.[0] as Record<string, unknown>)?.bounced !==
        undefined
    );
    expect(bouncedCounterUpdate).toBeUndefined();
  });

  it("still sets status='bounced' for non-Suppressed permanent bounces", async () => {
    const { updateCalls } = setupMocks();

    const event = buildBounceEvent({
      bounceType: "Permanent",
      bounceSubType: "NoEmail",
    });
    await sendWebhookEvent(app, event);

    expect(updateCalls[0].set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "bounced",
        bounceType: "Permanent",
        bounceSubType: "NoEmail",
      })
    );
  });
});
