/**
 * Webhook Delivery Precedence Tests (real DB)
 *
 * Unit 24 — delivery does not overwrite a terminal status.
 *
 * Behavioral, real-Neon-DB version of the precedence guard in
 * `processDelivery` (routes/webhooks.ts): a Delivery event must NOT overwrite a
 * `bounced`/`complained` status with `delivered` (a delayed delivery
 * notification arriving after a bounce/complaint). We seed a real `messageSend`
 * row, POST a real SES Delivery event through the route, then re-query the
 * persisted row to assert its status — no coupling to query-builder internals.
 *
 * Only true boundaries are mocked: the SQS queue (`workflow-queue`) and the
 * activation tracker (`activation-tracking`). `@wraps/db` is REAL — the
 * `messageSend.status` write under test runs against Neon. The usage-counter
 * insert (`message_usage_monthly`) is allowed to run against the real DB.
 */

import { batchSend, db, eq, messageSend } from "@wraps/db";
import { Elysia } from "elysia";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  type BaseOrgFixture,
  cleanupBaseOrg,
  clearWorkflowState,
  messageSendRow,
  seedBaseOrg,
} from "../(ee)/__tests__/fixtures/real-db";
import { buildDeliveryEvent } from "./fixtures/ses-events";

vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn().mockResolvedValue(undefined),
  deleteScheduledStep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailDelivered: vi.fn().mockResolvedValue(undefined),
}));

const { webhooksRoutes } = await import("../routes/webhooks");

const TEST_PREFIX = "wh-deliv-db";

let fixture: BaseOrgFixture;

function createApp() {
  return new Elysia().use(webhooksRoutes);
}

function postDelivery(
  accountNumber: string,
  messageId: string,
  secret: string
) {
  const event = buildDeliveryEvent({ mail: { messageId } });
  return createApp().handle(
    new Request(`http://localhost/webhooks/ses/${accountNumber}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wraps-api-key": secret,
      },
      body: JSON.stringify(event),
    })
  );
}

async function seedMessage(
  messageId: string,
  status: "sent" | "bounced" | "complained"
) {
  await db.insert(messageSend).values(
    messageSendRow(fixture.ids, {
      id: `${TEST_PREFIX}-msg-${status}`,
      messageId,
      status,
    })
  );
}

async function getStatus(messageId: string) {
  const [row] = await db
    .select({
      status: messageSend.status,
      deliveredAt: messageSend.deliveredAt,
    })
    .from(messageSend)
    .where(eq(messageSend.messageId, messageId))
    .limit(1);
  return row;
}

describe("webhook delivery precedence (real DB)", () => {
  beforeAll(async () => {
    fixture = await seedBaseOrg(TEST_PREFIX);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearWorkflowState(fixture.ids.org, fixture.ids.otherOrg);
  });

  afterAll(async () => {
    await cleanupBaseOrg(TEST_PREFIX);
  });

  it("does NOT overwrite a 'bounced' status with 'delivered'", async () => {
    const messageId = `${TEST_PREFIX}-mid-bounced`;
    await seedMessage(messageId, "bounced");

    const res = await postDelivery(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res.status).toBe(200);

    const row = await getStatus(messageId);
    expect(row.status).toBe("bounced");
    expect(row.deliveredAt).toBeNull();
  });

  it("does NOT overwrite a 'complained' status with 'delivered'", async () => {
    const messageId = `${TEST_PREFIX}-mid-complained`;
    await seedMessage(messageId, "complained");

    const res = await postDelivery(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res.status).toBe(200);

    const row = await getStatus(messageId);
    expect(row.status).toBe("complained");
    expect(row.deliveredAt).toBeNull();
  });

  it("DOES progress a 'sent' status to 'delivered' (positive control)", async () => {
    const messageId = `${TEST_PREFIX}-mid-sent`;
    await seedMessage(messageId, "sent");

    const res = await postDelivery(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res.status).toBe(200);

    const row = await getStatus(messageId);
    expect(row.status).toBe("delivered");
    expect(row.deliveredAt).not.toBeNull();
  });

  it("heals a wrongly-'failed' row exactly once under duplicate delivery events", async () => {
    // A row marked 'failed' by a bookkeeping error (send actually succeeded)
    // must be flipped to delivered, its stale error cleared, and the batch
    // failed counter decremented exactly once — even when EventBridge
    // delivers the same event twice (at-least-once delivery).
    const messageId = `${TEST_PREFIX}-mid-healed`;
    const batchId = `${TEST_PREFIX}-batch-heal`;

    await db.insert(batchSend).values({
      id: batchId,
      organizationId: fixture.ids.org,
      awsAccountId: fixture.ids.awsAccount,
      channel: "email",
      status: "completed",
      audienceType: "all",
      totalRecipients: 1,
      processedRecipients: 1,
      sent: 0,
      failed: 1,
      delivered: 0,
    } as typeof batchSend.$inferInsert);

    await db.insert(messageSend).values(
      messageSendRow(fixture.ids, {
        id: `${TEST_PREFIX}-msg-healed`,
        messageId,
        status: "failed",
        sourceType: "batch",
        batchSendId: batchId,
        error: 'Failed query: update "message_send" set ...',
      })
    );

    const res1 = await postDelivery(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res1.status).toBe(200);
    const res2 = await postDelivery(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res2.status).toBe(200);

    const [row] = await db
      .select({
        status: messageSend.status,
        error: messageSend.error,
        deliveredAt: messageSend.deliveredAt,
      })
      .from(messageSend)
      .where(eq(messageSend.messageId, messageId))
      .limit(1);
    expect(row.status).toBe("delivered");
    expect(row.error).toBeNull();
    expect(row.deliveredAt).not.toBeNull();

    const [batch] = await db
      .select({ failed: batchSend.failed })
      .from(batchSend)
      .where(eq(batchSend.id, batchId))
      .limit(1);
    // Decremented exactly once — the duplicate event must not decrement again.
    expect(batch.failed).toBe(0);

    await db.delete(batchSend).where(eq(batchSend.id, batchId));
  });

  it("rejects a wrong secret with 401 and does not change status", async () => {
    const messageId = `${TEST_PREFIX}-mid-auth`;
    await seedMessage(messageId, "sent");

    const res = await postDelivery(
      fixture.accountNumber,
      messageId,
      "wrong-secret"
    );
    expect(res.status).toBe(401);

    const row = await getStatus(messageId);
    expect(row.status).toBe("sent");
    expect(row.deliveredAt).toBeNull();
  });
});
