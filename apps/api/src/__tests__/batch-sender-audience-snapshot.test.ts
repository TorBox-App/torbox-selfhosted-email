/**
 * Batch Sender — Audience Snapshot (real DB)
 *
 * `contact.id` is a random UUID and the worker paginates with
 * `WHERE id > cursor ORDER BY id`, so over a multi-day send a contact created
 * after the broadcast started has roughly a 50% chance of sorting after the
 * current cursor and getting swept into a broadcast composed days earlier.
 * Plan 169 freezes the audience on chunk 0: `audience_snapshot_at` is stamped
 * once, `totalRecipients` is recounted against it, and every recipient query
 * (repository + worker) is bounded by `contact.created_at <= snapshot`.
 *
 * Boundary mocks only (SES/SQS/credentials) — no @wraps/db mocking. The
 * audience-snapshot recount (countBroadcastRecipients) and the chunk query
 * (getContactsChunk) both run against the real Neon test branch, which is the
 * only way to prove the sweep-in is actually prevented rather than merely
 * asserting SQL shape.
 *
 * Pattern: beforeAll seedBaseOrg → beforeEach reset contacts/state → afterAll cleanup.
 * TEST_PREFIX: bs-audience-snapshot-db (unique across all *-db.test.ts files)
 */

import { awsAccount, batchSend, contact, db, eq, template } from "@wraps/db";
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

const TEST_PREFIX = "bs-audience-snapshot-db";
const BATCH_ID = `${TEST_PREFIX}-batch`;
const TEMPLATE_ID = `${TEST_PREFIX}-template`;

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted SES recorder — shared with the vi.mock factory below.
// ─────────────────────────────────────────────────────────────────────────────
const sesState = vi.hoisted(() => ({
  bulkSendCalls: [] as string[][],
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

// SQS boundary: never touch AWS.
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
let getContactsChunk: typeof import("../workers/batch-sender")["getContactsChunk"];

async function insertContact(
  id: string,
  createdAt: Date,
  orgId: string
): Promise<void> {
  await db
    .insert(contact)
    .values({
      id,
      organizationId: orgId,
      email: `${id}@example.com`,
      emailHash: `${id}-hash`,
      firstName: "Recipient",
      emailStatus: "active",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    } as typeof contact.$inferInsert)
    .onConflictDoNothing();
}

async function resetBatch(
  overrides: Partial<typeof batchSend.$inferInsert>
): Promise<void> {
  await db
    .update(batchSend)
    .set({
      status: "processing",
      totalRecipients: 0,
      processedRecipients: 0,
      sent: 0,
      failed: 0,
      delivered: 0,
      startedAt: null,
      completedAt: null,
      audienceSnapshotAt: null,
      lastChunkIndex: null,
      lastChunkAt: null,
      lastCursor: null,
      pausedReason: null,
      errorMessage: null,
      errorDetails: null,
      ...overrides,
    })
    .where(eq(batchSend.id, BATCH_ID));
}

async function runWorker(
  chunkIndex: number,
  cursor?: { id: string }
): Promise<void> {
  const job = {
    batchId: BATCH_ID,
    organizationId: fixture.ids.org,
    awsAccountId: fixture.ids.awsAccount,
    channel: "email",
    chunkIndex,
    cursor,
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
  // biome-ignore lint/suspicious/noExplicitAny: SQSHandler loaded via dynamic import
  await handler(event as any, context as any, () => {
    // noop callback
  });
}

async function loadBatch() {
  const [row] = await db
    .select()
    .from(batchSend)
    .where(eq(batchSend.id, BATCH_ID));
  return row;
}

beforeAll(async () => {
  process.env.BATCH_QUEUE_URL = "https://sqs.test.local/queue";
  // Recipient-facing link bases have no platform fallback — the worker throws
  // unless the deployment configures its own URLs.
  process.env.API_BASE_URL = "https://api.test.local";
  process.env.APP_BASE_URL = "https://app.test.local";

  fixture = await seedBaseOrg(TEST_PREFIX);
  const orgId = fixture.ids.org;
  const now = new Date();

  // Remove the fixture's default contact so getContactsChunk / the recount
  // return ONLY the contacts each test seeds.
  await db.delete(contact).where(eq(contact.organizationId, orgId));

  // Transactional avoids the unsubscribe-token generation path — irrelevant
  // to this behavior and requires no extra mock.
  await db
    .insert(template)
    .values({
      id: TEMPLATE_ID,
      organizationId: orgId,
      name: "Audience Snapshot Test Template",
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

  await db
    .insert(batchSend)
    .values({
      id: BATCH_ID,
      organizationId: orgId,
      awsAccountId: fixture.ids.awsAccount,
      channel: "email",
      status: "processing",
      subject: "Audience Snapshot Test",
      from: `${TEST_PREFIX}-sender@example.com`,
      fromName: "Audience Snapshot Test",
      emailTemplateId: TEMPLATE_ID,
      audienceType: "all",
      totalRecipients: 0,
    } as typeof batchSend.$inferInsert)
    .onConflictDoNothing();

  const mod = await import("../workers/batch-sender");
  handler = mod.handler;
  getContactsChunk = mod.getContactsChunk;
});

beforeEach(async () => {
  await clearWorkflowState(fixture.ids.org);
  await db.delete(contact).where(eq(contact.organizationId, fixture.ids.org));
  sesState.bulkSendCalls = [];
  sesState.messageIdCounter = 0;
});

afterAll(async () => {
  await db.delete(batchSend).where(eq(batchSend.id, BATCH_ID));
  await db.delete(template).where(eq(template.id, TEMPLATE_ID));
  await db
    .delete(awsAccount)
    .where(eq(awsAccount.id, fixture.ids.awsAccount))
    .catch(() => {
      // cleanupBaseOrg below removes it too; ignore if already gone
    });
  await cleanupBaseOrg(TEST_PREFIX);
});

describe("audience snapshot (chunk 0 stamp + recount)", () => {
  it("stamps a non-null audienceSnapshotAt and rewrites totalRecipients from the bounded count", async () => {
    const orgId = fixture.ids.org;
    const now = new Date();
    await insertContact(`${TEST_PREFIX}-c0`, now, orgId);
    await insertContact(`${TEST_PREFIX}-c1`, now, orgId);
    await insertContact(`${TEST_PREFIX}-c2`, now, orgId);

    // Stale preflight count (999) must be overwritten by the real recount (3).
    await resetBatch({ totalRecipients: 999, processedRecipients: 0 });

    await runWorker(0);

    const batch = await loadBatch();
    expect(batch.audienceSnapshotAt).not.toBeNull();
    expect(batch.totalRecipients).toBe(3);
  });

  it("does not re-stamp or change audienceSnapshotAt on a later chunk", async () => {
    const orgId = fixture.ids.org;
    const now = new Date();
    await insertContact(`${TEST_PREFIX}-c0`, now, orgId);
    const fixedSnapshot = new Date("2026-01-01T00:00:00Z");

    await resetBatch({
      totalRecipients: 1,
      processedRecipients: 1,
      audienceSnapshotAt: fixedSnapshot,
    });

    // remainingRecipients = max(1 - 1, 0) = 0 → completes immediately,
    // never touching chunk-0 logic (chunkIndex is 5, not 0, anyway).
    await runWorker(5, { id: `${TEST_PREFIX}-c0` });

    const batch = await loadBatch();
    expect(batch.audienceSnapshotAt?.toISOString()).toBe(
      fixedSnapshot.toISOString()
    );
  });
});

describe("getContactsChunk bound by createdBefore", () => {
  it("excludes a contact created after the snapshot", async () => {
    const orgId = fixture.ids.org;
    const snapshot = new Date();
    await insertContact(
      `${TEST_PREFIX}-before`,
      new Date(snapshot.getTime() - 60_000),
      orgId
    );
    await insertContact(
      `${TEST_PREFIX}-after`,
      new Date(snapshot.getTime() + 60_000),
      orgId
    );

    const result = await getContactsChunk(
      orgId,
      "email",
      50,
      { audienceType: "all", createdBefore: snapshot },
      undefined
    );

    const ids = result.map((c) => c.id);
    expect(ids).toContain(`${TEST_PREFIX}-before`);
    expect(ids).not.toContain(`${TEST_PREFIX}-after`);
  });

  it("BEHAVIORAL: a contact created after chunk 0's snapshot is never returned by a later chunk, even when its id sorts after the cursor", async () => {
    const orgId = fixture.ids.org;
    const t0 = new Date();
    // Explicit ids (not the default random UUID) so ordering is deterministic:
    // "-a" and "-b" sort before "-z-late" under plain text comparison.
    const idA = `${TEST_PREFIX}-a`;
    const idB = `${TEST_PREFIX}-b`;
    const idLate = `${TEST_PREFIX}-z-late`;

    await insertContact(idA, t0, orgId);
    await insertContact(idB, t0, orgId);

    // "Chunk 0": snapshot the audience now, fetch a small page (limit 1).
    const snapshot = new Date();
    const chunk0 = await getContactsChunk(
      orgId,
      "email",
      1,
      { audienceType: "all", createdBefore: snapshot },
      undefined
    );
    expect(chunk0).toHaveLength(1);
    const cursor = { id: chunk0[0].id };

    // A new contact arrives mid-send, created AFTER the snapshot, with an id
    // that sorts AFTER the cursor — the exact condition that would sweep it
    // into the running broadcast without the createdBefore bound.
    await insertContact(idLate, new Date(snapshot.getTime() + 60_000), orgId);

    // "Next chunk": same snapshot, paginate from the cursor.
    const chunk1 = await getContactsChunk(
      orgId,
      "email",
      50,
      { audienceType: "all", createdBefore: snapshot },
      cursor
    );

    const chunk1Ids = chunk1.map((c) => c.id);
    expect(chunk1Ids).not.toContain(idLate);
    // Sanity: the pre-existing second contact IS still reachable, so the
    // bound isn't accidentally excluding everything.
    expect(chunk1Ids).toContain(idA === cursor.id ? idB : idA);
  });
});

describe("legacy batches (NULL audienceSnapshotAt)", () => {
  it("a batch with NULL snapshot and chunkIndex > 0 still sends unbounded — no crash, no empty result", async () => {
    const orgId = fixture.ids.org;
    const now = new Date();
    await insertContact(`${TEST_PREFIX}-legacy-0`, now, orgId);
    await insertContact(`${TEST_PREFIX}-legacy-1`, now, orgId);

    await resetBatch({
      totalRecipients: 2,
      processedRecipients: 1,
      audienceSnapshotAt: null,
    });

    await expect(
      runWorker(1, { id: `${TEST_PREFIX}-legacy-0` })
    ).resolves.not.toThrow();

    // The remaining contact was actually reached (unbounded — no snapshot to
    // exclude it), proving this legacy path isn't silently empty.
    expect(sesState.bulkSendCalls.flat()).toContain(
      `${TEST_PREFIX}-legacy-1@example.com`
    );
  });
});
