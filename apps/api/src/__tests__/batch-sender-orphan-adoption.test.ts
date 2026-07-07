/**
 * Batch Sender — Orphan Adoption on messageId Collision (real DB)
 *
 * Plan 118: reproduces the 2026-07-02 incident where SES's Send event
 * reaches POST /webhooks/ses/:acct BEFORE this worker writes the SES
 * messageId onto the recipient's message_send row. The webhook's
 * "message not found" branch (webhooks.ts) materializes a minimal orphan
 * row carrying that messageId — so this worker's per-recipient UPDATE then
 * collides on message_send_message_id_idx.
 *
 * BEHAVIOR under test (survives the eventual fix — asserts outcomes):
 *   1. A genuine collision against an adoptable orphan (batchSendId IS NULL)
 *      merges the orphan's lifecycle facts onto the batch row and deletes
 *      the orphan, inside one transaction.
 *   2. Same, but the orphan only ever reached status 'sent'.
 *   3. A collision against a NON-orphan row (batchSendId already set) warns
 *      and leaves the batch row 'queued' — nothing is adopted or deleted.
 *   4. A non-unique-violation bookkeeping error behaves exactly as before
 *      plan 118: log-and-stay-claimed, no adoption attempted.
 *   5. A null messageId never triggers adoption, even if the (injected)
 *      error text coincidentally matches the constraint name.
 *
 * Boundary mocks only: SES SDK (GetAccount), SQS (no-op), @wraps/email-send
 * (sendEmail — raw-HTML individual-send path), getCredentials,
 * activation-tracking. No internal batch-sender function is mocked. Tests
 * 1-3 trigger a REAL Postgres unique-constraint violation by seeding a
 * colliding row before the run (drizzle wraps it in DrizzleQueryError with
 * the raw pg error on `.cause` — exactly what isMessageIdUniqueViolation
 * walks). Tests 4-5 inject a synthetic db.update failure (same technique as
 * batch-sender-bookkeeping-db.test.ts) because those scenarios need a
 * NON-collision error / a fabricated error text that real Postgres can't be
 * made to produce on demand.
 *
 * Pattern: beforeAll seed → beforeEach reset → afterAll cleanup.
 * TEST_PREFIX: bs-orphan-adopt (unique across all *-db.test.ts files)
 */

import { and, batchSend, db, eq, messageSend, template } from "@wraps/db";
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
  seedBaseOrg,
} from "../(ee)/__tests__/fixtures/real-db";

const TEST_PREFIX = "bs-orphan-adopt";
const BATCH_ID = `${TEST_PREFIX}-batch`;
const RAW_TEMPLATE_ID = `${TEST_PREFIX}-raw-template`;

// ─────────────────────────────────────────────────────────────────────────────
// Controllable per-test send result — the raw-HTML individual-send path
// records whatever messageId sendEmail returns. undefined reproduces SES
// accepting a send without returning a MessageId (values.messageId === null
// in recordAcceptedSend).
// ─────────────────────────────────────────────────────────────────────────────
let currentMessageId: string | undefined;

vi.mock("@aws-sdk/client-sesv2", () => {
  class GetAccountCommand {
    readonly __type = "GetAccount";
  }
  class SESv2Client {
    // biome-ignore lint/suspicious/noExplicitAny: test double
    async send(command: any) {
      if (command?.__type === "GetAccount") {
        return { SendQuota: { MaxSendRate: 14 } };
      }
      return {};
    }
  }
  return { SESv2Client, GetAccountCommand };
});

vi.mock("@aws-sdk/client-sqs", () => {
  class SendMessageCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class SQSClient {
    async send() {
      return {};
    }
  }
  return { SQSClient, SendMessageCommand };
});

// Email-send boundary: the raw-HTML individual-send path calls sendEmail.
vi.mock("@wraps/email-send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wraps/email-send")>();
  return {
    ...actual,
    sendEmail: vi.fn(async () => ({ messageId: currentMessageId })),
  };
});

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn(async () => ({
    accessKeyId: "AKIA-test",
    secretAccessKey: "secret",
    sessionToken: "token",
    expiration: new Date(Date.now() + 3_600_000),
    region: "us-east-1",
  })),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn(async () => {}),
}));

let fixture: BaseOrgFixture;
// biome-ignore lint/suspicious/noExplicitAny: SQSHandler loaded via dynamic import
let handler: any;

async function resetBatch(): Promise<void> {
  await db
    .update(batchSend)
    .set({
      status: "processing",
      totalRecipients: 1,
      processedRecipients: 0,
      sent: 0,
      failed: 0,
      delivered: 0,
      startedAt: null,
      completedAt: null,
      lastChunkIndex: null,
      lastCursor: null,
      errorMessage: null,
      errorDetails: null,
    })
    .where(eq(batchSend.id, BATCH_ID));
}

async function runWorker(): Promise<void> {
  const job = {
    batchId: BATCH_ID,
    organizationId: fixture.ids.org,
    awsAccountId: fixture.ids.awsAccount,
    channel: "email",
    chunkIndex: 0,
  };
  const event = {
    Records: [
      {
        body: JSON.stringify(job),
        attributes: { ApproximateReceiveCount: "1" },
      },
    ],
  };
  const context = { getRemainingTimeInMillis: () => 300_000 };
  await handler(event, context, () => {
    // noop callback
  });
}

async function loadClaimedRow() {
  const [row] = await db
    .select()
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, fixture.ids.org),
        eq(messageSend.batchSendId, BATCH_ID),
        eq(messageSend.contactId, fixture.ids.contact)
      )
    );
  return row;
}

async function loadById(id: string) {
  const [row] = await db
    .select()
    .from(messageSend)
    .where(eq(messageSend.id, id));
  return row;
}

// Injects a synthetic failure on the worker's per-recipient status='sent'
// UPDATE for EVERY call (persistent, not one-shot). Used only for tests 4-5,
// which need a NON-collision error / a fabricated error text — real
// Postgres can't be made to produce either on demand. Wraps only the public
// db.update surface, matching batch-sender-bookkeeping-db.test.ts's
// injectOneShotSentUpdateFailure.
function injectPersistentSentUpdateFailure(errorText: string) {
  const realUpdate = db.update.bind(db);
  const spy = vi.spyOn(db, "update").mockImplementation(((table: unknown) => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle builder
    const builder: any = realUpdate(table as any);
    const realSet = builder.set.bind(builder);
    // biome-ignore lint/suspicious/noExplicitAny: drizzle builder
    builder.set = (values: any) => {
      if (values?.status === "sent") {
        return {
          where: () => Promise.reject(new Error(errorText)),
        };
      }
      return realSet(values);
    };
    return builder;
    // biome-ignore lint/suspicious/noExplicitAny: spy signature
  }) as any);
  return spy;
}

beforeAll(async () => {
  // Point the worker's module-scoped QUEUE_URL at a dummy before importing it.
  process.env.BATCH_QUEUE_URL = "https://sqs.test.local/queue";

  fixture = await seedBaseOrg(TEST_PREFIX);
  const orgId = fixture.ids.org;
  const now = new Date();

  // No sesTemplateName → worker takes the raw-HTML individual-send path,
  // which lets us control the exact messageId returned per recipient.
  await db
    .insert(template)
    .values({
      id: RAW_TEMPLATE_ID,
      organizationId: orgId,
      name: "Orphan Adoption Test Template",
      content: {},
      channel: "email",
      emailType: "transactional",
      compiledHtml: "<p>Hello</p>",
      sesTemplateName: null,
      status: "PUBLISHED",
      createdAt: now,
      updatedAt: now,
    } as typeof template.$inferInsert)
    .onConflictDoNothing();

  await db
    .insert(batchSend)
    .values({
      id: BATCH_ID,
      organizationId: orgId,
      awsAccountId: fixture.ids.awsAccount,
      channel: "email",
      status: "processing",
      subject: "Orphan adoption test",
      from: `${TEST_PREFIX}-sender@example.com`,
      fromName: "Orphan Adoption Test",
      emailTemplateId: RAW_TEMPLATE_ID,
      audienceType: "all",
      totalRecipients: 1,
    } as typeof batchSend.$inferInsert)
    .onConflictDoNothing();

  const mod = await import("../workers/batch-sender");
  handler = mod.handler;
});

beforeEach(async () => {
  await clearWorkflowState(fixture.ids.org);
  currentMessageId = undefined;
});

afterAll(async () => {
  await db.delete(batchSend).where(eq(batchSend.id, BATCH_ID));
  await db.delete(template).where(eq(template.id, RAW_TEMPLATE_ID));
  await cleanupBaseOrg(TEST_PREFIX);
});

describe("Batch sender orphan adoption on messageId collision (real DB)", () => {
  it("adopts an orphan further along than 'sent' (status delivered, deliveredAt set)", async () => {
    await resetBatch();
    const messageId = `${TEST_PREFIX}-msg-1`;
    const deliveredAt = new Date("2026-07-02T15:15:36.000Z");
    const orphanId = `${TEST_PREFIX}-orphan-1`;

    await db.insert(messageSend).values({
      id: orphanId,
      organizationId: fixture.ids.org,
      awsAccountId: fixture.ids.awsAccount,
      channel: "email",
      sourceType: "transactional",
      batchSendId: null,
      contactId: null,
      recipient: "orphan1@example.com",
      messageId,
      status: "delivered",
      sentAt: new Date("2026-07-02T15:15:30.000Z"),
      deliveredAt,
    } as typeof messageSend.$inferInsert);

    currentMessageId = messageId;
    const transactionSpy = vi.spyOn(db, "transaction");
    let callCount: number;
    try {
      await runWorker();
    } finally {
      // mockRestore() also clears recorded calls, so snapshot the count
      // before restoring.
      callCount = transactionSpy.mock.calls.length;
      transactionSpy.mockRestore();
    }

    expect(callCount).toBe(1);

    const orphanAfter = await loadById(orphanId);
    expect(orphanAfter).toBeUndefined();

    const claimed = await loadClaimedRow();
    expect(claimed).toBeDefined();
    expect(claimed?.messageId).toBe(messageId);
    expect(claimed?.status).toBe("delivered");
    expect(claimed?.deliveredAt?.getTime()).toBe(deliveredAt.getTime());
  });

  it("adopts an orphan only at status 'sent' (Send event materialized it)", async () => {
    await resetBatch();
    const messageId = `${TEST_PREFIX}-msg-2`;
    const orphanId = `${TEST_PREFIX}-orphan-2`;

    await db.insert(messageSend).values({
      id: orphanId,
      organizationId: fixture.ids.org,
      awsAccountId: fixture.ids.awsAccount,
      channel: "email",
      sourceType: "transactional",
      batchSendId: null,
      contactId: null,
      recipient: "orphan2@example.com",
      messageId,
      status: "sent",
      sentAt: new Date("2026-07-02T15:15:30.000Z"),
    } as typeof messageSend.$inferInsert);

    currentMessageId = messageId;
    await runWorker();

    const orphanAfter = await loadById(orphanId);
    expect(orphanAfter).toBeUndefined();

    const claimed = await loadClaimedRow();
    expect(claimed).toBeDefined();
    expect(claimed?.messageId).toBe(messageId);
    expect(claimed?.status).toBe("sent");
    expect(claimed?.deliveredAt).toBeNull();
  });

  it("collision against a NON-orphan row (batchSendId already set): warns, leaves row claimed, nothing adopted", async () => {
    await resetBatch();
    const messageId = `${TEST_PREFIX}-msg-3`;
    const nonOrphanId = `${TEST_PREFIX}-nonorphan-3`;

    await db.insert(messageSend).values({
      id: nonOrphanId,
      organizationId: fixture.ids.org,
      awsAccountId: fixture.ids.awsAccount,
      channel: "email",
      sourceType: "batch",
      batchSendId: BATCH_ID,
      contactId: fixture.ids.otherContact,
      recipient: "nonorphan3@example.com",
      messageId,
      status: "sent",
      sentAt: new Date("2026-07-02T15:15:30.000Z"),
    } as typeof messageSend.$inferInsert);

    currentMessageId = messageId;
    const transactionSpy = vi.spyOn(db, "transaction");
    let callCount: number;
    try {
      await runWorker();
    } finally {
      // mockRestore() also clears recorded calls, so snapshot the count
      // before restoring.
      callCount = transactionSpy.mock.calls.length;
      transactionSpy.mockRestore();
    }

    // The collision was detected and adoption was attempted (transaction ran
    // the FOR UPDATE select) — it just found nothing adoptable.
    expect(callCount).toBe(1);

    // The pre-existing colliding row is untouched.
    const nonOrphanAfter = await loadById(nonOrphanId);
    expect(nonOrphanAfter).toBeDefined();
    expect(nonOrphanAfter?.messageId).toBe(messageId);

    // The claimed row never transitioned — it stays 'queued' and
    // stale-reclaimable, same as a persistent bookkeeping failure.
    const claimed = await loadClaimedRow();
    expect(claimed).toBeDefined();
    expect(claimed?.status).toBe("queued");
    expect(claimed?.messageId).toBeNull();
  });

  it("non-unique-violation bookkeeping error: identical to pre-118 behavior (log-and-stay-claimed, no adoption)", async () => {
    await resetBatch();
    currentMessageId = `${TEST_PREFIX}-msg-4`;

    const transactionSpy = vi.spyOn(db, "transaction");
    const updateSpy = injectPersistentSentUpdateFailure(
      "Failed query: update message_send set subject, message_id, status, sent_at ..."
    );
    try {
      await runWorker();
    } finally {
      updateSpy.mockRestore();
      transactionSpy.mockRestore();
    }

    // No collision detected → adoption's transaction never runs.
    expect(transactionSpy).not.toHaveBeenCalled();

    const claimed = await loadClaimedRow();
    expect(claimed).toBeDefined();
    expect(claimed?.status).toBe("queued");
    expect(claimed?.messageId).toBeNull();
  });

  it("values.messageId === null: adoption never attempted even if the error text matches the constraint name", async () => {
    await resetBatch();
    currentMessageId = undefined; // SES accepted but returned no MessageId

    const transactionSpy = vi.spyOn(db, "transaction");
    const updateSpy = injectPersistentSentUpdateFailure(
      'duplicate key value violates unique constraint "message_send_message_id_idx"'
    );
    try {
      await runWorker();
    } finally {
      updateSpy.mockRestore();
      transactionSpy.mockRestore();
    }

    // values.messageId is null, so the `values.messageId && ...` guard must
    // short-circuit before adoptOrphanRow (and its db.transaction) ever runs.
    expect(transactionSpy).not.toHaveBeenCalled();

    const claimed = await loadClaimedRow();
    expect(claimed).toBeDefined();
    expect(claimed?.status).toBe("queued");
    expect(claimed?.messageId).toBeNull();
  });
});
