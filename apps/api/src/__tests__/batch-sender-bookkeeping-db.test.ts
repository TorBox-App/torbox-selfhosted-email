/**
 * Batch Sender — Post-Send Bookkeeping Failure (real DB)
 *
 * Reproduces the production incident (2026-07-02): SES accepts a chunk, then a
 * transient Postgres error is thrown by the per-recipient success-path UPDATE
 * (message_send → status='sent', message_id, sent_at). Because that bookkeeping
 * write lives INSIDE the same try/catch as the SES call, the chunk-level catch
 * marks EVERY claimed row in the chunk status='failed' (including rows whose SES
 * send already succeeded) and inflates batch_send.failed by the chunk size.
 *
 * BEHAVIOR under test (survives the eventual fix — asserts outcomes, not code):
 *   When SES accepts a message but the post-send bookkeeping UPDATE throws a
 *   transient DB error, the message must NOT end up status='failed' /
 *   re-claimable, and batch_send.failed must NOT count it as a send failure.
 *   An SQS redelivery must NOT re-send to a contact SES already accepted.
 *
 * Boundary mocks only:
 *   - SES SDK client → always returns SUCCESS for every entry (system boundary)
 *   - getCredentials → fake STS creds (system boundary)
 *   - SQS client → no-op (system boundary; enqueue never reaches AWS)
 *   - activation-tracking → no-op (analytics side-effect boundary / PostHog)
 * The transient DB failure is injected at the db boundary by wrapping
 * db.update so the FIRST status='sent' write rejects once, then restoring it.
 * No internal function of batch-sender is mocked.
 *
 * Pattern: beforeAll seed → beforeEach reset → afterAll cleanup.
 * TEST_PREFIX: bs-bookkeeping-db (unique across all *-db.test.ts files)
 */

import {
  and,
  awsAccount,
  batchSend,
  contact,
  db,
  eq,
  messageSend,
  template,
} from "@wraps/db";
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

const TEST_PREFIX = "bs-bookkeeping-db";
const BATCH_ID = `${TEST_PREFIX}-batch`;
const TEMPLATE_ID = `${TEST_PREFIX}-template`;
const RAW_TEMPLATE_ID = `${TEST_PREFIX}-raw-template`;
const CONTACT_IDS = [
  `${TEST_PREFIX}-c1`,
  `${TEST_PREFIX}-c2`,
  `${TEST_PREFIX}-c3`,
];
const TRANSIENT_DB_ERROR =
  "Failed query: update message_send set subject, message_id, status, sent_at ...";

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted SES recorder — shared with the vi.mock factory below.
// bulkSendCalls: one entry per SendBulkEmailCommand = list of recipient emails.
// ─────────────────────────────────────────────────────────────────────────────
const sesState = vi.hoisted(() => ({
  bulkSendCalls: [] as string[][],
  individualSends: [] as string[],
  messageIdCounter: 0,
}));

// SES SDK boundary: accept everything, record recipients per bulk call.
vi.mock("@aws-sdk/client-sesv2", () => {
  class GetAccountCommand {
    input: unknown;
    readonly __type = "GetAccount";
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class SendBulkEmailCommand {
    input: {
      BulkEmailEntries?: Array<{ Destination?: { ToAddresses?: string[] } }>;
    };
    readonly __type = "SendBulkEmail";
    constructor(input: {
      BulkEmailEntries?: Array<{ Destination?: { ToAddresses?: string[] } }>;
    }) {
      this.input = input;
    }
  }
  class SESv2Client {
    // biome-ignore lint/suspicious/noExplicitAny: test double
    async send(command: any) {
      if (command?.__type === "GetAccount") {
        return { SendQuota: { MaxSendRate: 14 } };
      }
      if (command?.__type === "SendBulkEmail") {
        const entries = command.input?.BulkEmailEntries ?? [];
        sesState.bulkSendCalls.push(
          entries.map(
            (e: { Destination?: { ToAddresses?: string[] } }) =>
              e.Destination?.ToAddresses?.[0] ?? ""
          )
        );
        return {
          BulkEmailEntryResults: entries.map(() => ({
            Status: "SUCCESS",
            MessageId: `${TEST_PREFIX}-ses-${sesState.messageIdCounter++}`,
          })),
        };
      }
      return {};
    }
  }
  return { SESv2Client, GetAccountCommand, SendBulkEmailCommand };
});

// SQS boundary: never touch AWS if enqueue is ever reached.
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

// Email-send boundary: the raw-HTML individual-send path calls sendEmail
// instead of SendBulkEmailCommand. Record recipients, return a messageId.
// Everything else in the module (WRAPS_CONFIGURATION_SET_NAME, ...) stays real.
vi.mock("@wraps/email-send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wraps/email-send")>();
  return {
    ...actual,
    sendEmail: vi.fn(async ({ to }: { to: string }) => {
      sesState.individualSends.push(to);
      return {
        messageId: `${TEST_PREFIX}-raw-${sesState.messageIdCounter++}`,
      };
    }),
  };
});

// Credentials boundary: fake STS assume-role result.
vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn(async () => ({
    accessKeyId: "AKIA-test",
    secretAccessKey: "secret",
    sessionToken: "token",
    expiration: new Date(Date.now() + 3_600_000),
    region: "us-east-1",
  })),
}));

// Analytics boundary: PostHog / platform emit — irrelevant to this behavior.
vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn(async () => {}),
}));

let fixture: BaseOrgFixture;
// biome-ignore lint/suspicious/noExplicitAny: SQSHandler loaded via dynamic import
let handler: any;

// ─────────────────────────────────────────────────────────────────────────────
// Inject a one-shot transient failure at the db boundary: the FIRST
// message_send status='sent' UPDATE rejects once, then real db.update resumes.
// Wraps only the public db.update surface — no batch-sender internals touched.
// ─────────────────────────────────────────────────────────────────────────────
function injectOneShotSentUpdateFailure(errorText: string) {
  const realUpdate = db.update.bind(db);
  let injected = false;
  const spy = vi.spyOn(db, "update").mockImplementation(((table: unknown) => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle builder
    const builder: any = realUpdate(table as any);
    const realSet = builder.set.bind(builder);
    // biome-ignore lint/suspicious/noExplicitAny: drizzle builder
    builder.set = (values: any) => {
      if (!injected && values?.status === "sent") {
        injected = true;
        return {
          where: () => Promise.reject(new Error(errorText)),
        };
      }
      return realSet(values);
    };
    return builder;
    // biome-ignore lint/suspicious/noExplicitAny: spy signature
  }) as any);
  return { spy, wasInjected: () => injected };
}

async function resetBatch(total: number): Promise<void> {
  await db
    .update(batchSend)
    .set({
      status: "processing",
      totalRecipients: total,
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

async function runWorker(chunkIndex = 0): Promise<void> {
  const job = {
    batchId: BATCH_ID,
    organizationId: fixture.ids.org,
    awsAccountId: fixture.ids.awsAccount,
    channel: "email",
    chunkIndex,
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

async function loadRows() {
  return db
    .select({
      contactId: messageSend.contactId,
      status: messageSend.status,
      error: messageSend.error,
      messageId: messageSend.messageId,
    })
    .from(messageSend)
    .where(
      and(
        eq(messageSend.organizationId, fixture.ids.org),
        eq(messageSend.batchSendId, BATCH_ID)
      )
    );
}

beforeAll(async () => {
  // Point the worker's module-scoped QUEUE_URL at a dummy before importing it.
  process.env.BATCH_QUEUE_URL = "https://sqs.test.local/queue";

  fixture = await seedBaseOrg(TEST_PREFIX);
  const orgId = fixture.ids.org;
  const now = new Date();

  // Remove the fixture's base contact so getContactsChunk returns ONLY our
  // three deterministic recipients for this org.
  await db.delete(contact).where(eq(contact.organizationId, orgId));

  await db
    .insert(contact)
    .values(
      CONTACT_IDS.map((id, i) => ({
        id,
        organizationId: orgId,
        email: `${id}@example.com`,
        emailHash: `${TEST_PREFIX}-hash-${i}`,
        firstName: `Recipient${i}`,
        emailStatus: "active",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })) as (typeof contact.$inferInsert)[]
    )
    .onConflictDoNothing();

  // SES-template path is selected when the template has a sesTemplateName.
  // Transactional avoids unsubscribe-token generation for a lean test.
  await db
    .insert(template)
    .values({
      id: TEMPLATE_ID,
      organizationId: orgId,
      name: "Bookkeeping Test Template",
      content: {},
      channel: "email",
      emailType: "transactional",
      compiledHtml: "<p>Hello</p>",
      sesTemplateName: `${TEST_PREFIX}-ses-template`,
      status: "PUBLISHED",
      createdAt: now,
      updatedAt: now,
    } as typeof template.$inferInsert)
    .onConflictDoNothing();

  // No sesTemplateName → worker takes the raw-HTML individual-send path.
  await db
    .insert(template)
    .values({
      id: RAW_TEMPLATE_ID,
      organizationId: orgId,
      name: "Bookkeeping Raw Template",
      content: {},
      channel: "email",
      emailType: "transactional",
      compiledHtml: "<p>Hello raw</p>",
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
      subject: "Bookkeeping test",
      from: `${TEST_PREFIX}-sender@example.com`,
      fromName: "Bookkeeping Test",
      emailTemplateId: TEMPLATE_ID,
      audienceType: "all",
      totalRecipients: CONTACT_IDS.length,
    } as typeof batchSend.$inferInsert)
    .onConflictDoNothing();

  const mod = await import("../workers/batch-sender");
  handler = mod.handler;
});

beforeEach(async () => {
  await clearWorkflowState(fixture.ids.org);
  sesState.bulkSendCalls = [];
  sesState.individualSends = [];
  sesState.messageIdCounter = 0;
});

afterAll(async () => {
  await db.delete(batchSend).where(eq(batchSend.id, BATCH_ID));
  await db.delete(template).where(eq(template.id, TEMPLATE_ID));
  await db.delete(template).where(eq(template.id, RAW_TEMPLATE_ID));
  await cleanupBaseOrg(TEST_PREFIX);
});

describe("Batch sender post-send bookkeeping failure (real DB)", () => {
  it("SES-accepted messages are never recorded failed when the post-send UPDATE throws", async () => {
    // Single chunk of 3; SES will accept all 3.
    await resetBatch(CONTACT_IDS.length);

    const inj = injectOneShotSentUpdateFailure(TRANSIENT_DB_ERROR);
    try {
      await runWorker(0);
    } finally {
      inj.spy.mockRestore();
    }

    // The transient bookkeeping failure must have actually fired, and SES must
    // have accepted every recipient — otherwise the test proves nothing.
    expect(inj.wasInjected()).toBe(true);
    expect(new Set(sesState.bulkSendCalls.flat()).size).toBe(
      CONTACT_IDS.length
    );

    const rows = await loadRows();
    const [batch] = await db
      .select({ sent: batchSend.sent, failed: batchSend.failed })
      .from(batchSend)
      .where(eq(batchSend.id, BATCH_ID));

    // BEHAVIOR: SES accepted all 3 → none may be recorded 'failed' or left
    // re-claimable ('failed' or 'queued'), and batch_send.failed must be 0.
    const wronglyFailed = rows
      .filter((r) => r.status === "failed")
      .map((r) => r.contactId);
    const reclaimable = rows
      .filter((r) => r.status === "failed" || r.status === "queued")
      .map((r) => r.contactId);

    expect(wronglyFailed).toEqual([]);
    expect(reclaimable).toEqual([]);
    expect(batch.failed).toBe(0);

    // And they land in the successful terminal state.
    expect(rows).toHaveLength(CONTACT_IDS.length);
    expect(rows.map((r) => r.status)).toEqual(CONTACT_IDS.map(() => "sent"));
    expect(batch.sent).toBe(CONTACT_IDS.length);
  });

  it("SQS redelivery does not re-send to contacts SES already accepted", async () => {
    // totalRecipients > available contacts so a redelivery of the same chunk
    // still sees remaining work and re-queries the same recipients — exposing
    // the re-claim double-send path when run 1 wrongly marked rows 'failed'.
    await resetBatch(10);

    // Run 1: SES accepts all, transient bookkeeping failure on first 'sent' write.
    const inj = injectOneShotSentUpdateFailure(TRANSIENT_DB_ERROR);
    try {
      await runWorker(0);
    } finally {
      inj.spy.mockRestore();
    }
    expect(inj.wasInjected()).toBe(true);

    const acceptedRun1 = new Set(sesState.bulkSendCalls.flat());
    expect(acceptedRun1.size).toBe(CONTACT_IDS.length);

    // Run 2: SQS redelivers the same chunk (no injected failure this time).
    await runWorker(0);

    // BEHAVIOR: no contact SES already accepted may be handed to SES again.
    const counts = new Map<string, number>();
    for (const email of sesState.bulkSendCalls.flat()) {
      counts.set(email, (counts.get(email) ?? 0) + 1);
    }
    const doubleSent = [...counts.entries()]
      .filter(([, n]) => n > 1)
      .map(([email]) => email);

    expect(doubleSent).toEqual([]);
  });

  it("raw-HTML path: SES-accepted messages are never recorded failed when the post-send UPDATE throws", async () => {
    // Point the batch at the template with no sesTemplateName so the worker
    // takes the individual-send (sendEmail) path. Last test in the file — the
    // batch row is deleted in afterAll, so no restore needed.
    await db
      .update(batchSend)
      .set({ emailTemplateId: RAW_TEMPLATE_ID })
      .where(eq(batchSend.id, BATCH_ID));
    await resetBatch(CONTACT_IDS.length);

    const inj = injectOneShotSentUpdateFailure(TRANSIENT_DB_ERROR);
    try {
      await runWorker(0);
    } finally {
      inj.spy.mockRestore();
    }

    expect(inj.wasInjected()).toBe(true);
    expect(new Set(sesState.individualSends).size).toBe(CONTACT_IDS.length);

    const rows = await loadRows();
    const [batch] = await db
      .select({ sent: batchSend.sent, failed: batchSend.failed })
      .from(batchSend)
      .where(eq(batchSend.id, BATCH_ID));

    const wronglyFailed = rows
      .filter((r) => r.status === "failed")
      .map((r) => r.contactId);
    const reclaimable = rows
      .filter((r) => r.status === "failed" || r.status === "queued")
      .map((r) => r.contactId);

    expect(wronglyFailed).toEqual([]);
    expect(reclaimable).toEqual([]);
    expect(batch.failed).toBe(0);

    expect(rows).toHaveLength(CONTACT_IDS.length);
    expect(rows.map((r) => r.status)).toEqual(CONTACT_IDS.map(() => "sent"));
    expect(batch.sent).toBe(CONTACT_IDS.length);
  });
});
