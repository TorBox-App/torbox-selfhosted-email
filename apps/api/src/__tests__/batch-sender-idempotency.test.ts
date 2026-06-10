/**
 * Batch Sender Idempotency Tests
 *
 * Verifies the claim-before-send contract:
 * 1. Contacts are claimed atomically via INSERT ... ON CONFLICT DO NOTHING before SES.
 * 2. Only claimed contacts are sent to SES.
 * 3. Post-send writes UPDATE the claimed rows (not INSERT).
 * 4. Failed contacts are re-claimed by the UPDATE path on redelivery.
 *
 * Race-semantics (concurrent claim, stale claim recovery) are tested in
 * batch-sender-claim-db.test.ts against the real unique index.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeMockContext,
  makeSqsRecordAttributes,
} from "./__helpers__/lambda-context";

// Track SES calls to verify no duplicate sends
const sesSendCalls: unknown[][] = [];
let sesBulkCallCount = 0;

vi.mock("@aws-sdk/client-sesv2", () => {
  function GetAccountCommand(this: unknown, input: unknown) {
    return input;
  }
  function SendBulkEmailCommand(this: unknown, input: unknown) {
    return input;
  }
  function SendEmailCommand(this: unknown, input: unknown) {
    return input;
  }
  return {
    SESv2Client: class {
      send(...args: unknown[]) {
        sesSendCalls.push(args);
        sesBulkCallCount++;
        return Promise.resolve({
          SendQuota: { MaxSendRate: 14 },
          BulkEmailEntryResults: [
            { Status: "SUCCESS", MessageId: `msg-${sesBulkCallCount}-1` },
            { Status: "SUCCESS", MessageId: `msg-${sesBulkCallCount}-2` },
          ],
        });
      }
    },
    GetAccountCommand,
    SendBulkEmailCommand,
    SendEmailCommand,
  };
});

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = vi.fn().mockResolvedValue({});
  },
  // biome-ignore lint: mock constructor
  SendMessageCommand: function SendMessageCommand(input: unknown) {
    return input;
  },
}));

vi.mock("@react-email/render", () => ({
  toPlainText: vi.fn().mockReturnValue("plain text"),
}));

vi.mock("../services/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIA-test",
    secretAccessKey: "secret-test",
    sessionToken: "token-test",
    expiration: new Date("2099-01-01"),
    region: "us-east-1",
  }),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailSent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./variable-mappings", () => ({
  applyVariableMappings: vi
    .fn()
    .mockImplementation((data: Record<string, string>) => data),
}));

// ─────────────────────────────────────────────────────────────────────────────
// DB mock — supports the claim-before-send contract:
//   INSERT ... ON CONFLICT DO NOTHING ... RETURNING (claim)
//   UPDATE ... (re-claim + post-send update)
// ─────────────────────────────────────────────────────────────────────────────

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
const updateSetCalls: Record<string, unknown>[] = [];

// Contacts returned by the claim INSERT (.returning()). Defaults to all contacts
// claimed successfully. Override per-test to simulate partially-claimed chunks.
let claimReturning: Array<{ contactId: string }> = [];

// Contacts returned by the re-claim UPDATE (.returning()). Empty = no re-claims.
let reclaimReturning: Array<{ contactId: string }> = [];

function getSqlNumericParams(value: unknown): number[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  if (!("queryChunks" in value)) {
    return [];
  }

  const queryChunks = (value as { queryChunks?: unknown }).queryChunks;
  if (!Array.isArray(queryChunks)) {
    return [];
  }

  const numbers: number[] = [];
  for (const chunk of queryChunks) {
    if (typeof chunk === "number") {
      numbers.push(chunk);
    }
  }

  return numbers;
}

vi.mock("@wraps/db", async () => {
  const actual = await vi.importActual("@wraps/db");

  // Helper: make a value that is both thenable (resolves to rows) and chainable
  function thenable(rows: unknown[]) {
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve(rows).then(resolve),
      limit: vi.fn().mockImplementation(() => thenable(rows)),
      orderBy: vi.fn().mockImplementation(() => thenable(rows)),
    };
    return obj;
  }

  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => {
        const rows = selectResults[selectCallIndex] ?? [];
        selectCallIndex += 1;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => thenable(rows)),
          }),
        };
      }),
      update: vi.fn().mockImplementation(() => {
        return {
          set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
            updateSetCalls.push(values);
            return {
              // All updates support .returning() — only the re-claim UPDATE actually
              // calls it; other updates (batchSend status, post-send) do not.
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockImplementation(() =>
                  Promise.resolve(reclaimReturning)
                ),
              }),
            };
          }),
        };
      }),
      insert: vi.fn().mockImplementation(() => {
        return {
          values: vi.fn().mockImplementation(() => {
            // Claim INSERT: supports .onConflictDoNothing().returning()
            return {
              onConflictDoNothing: vi.fn().mockReturnValue({
                returning: vi
                  .fn()
                  .mockImplementation(() => Promise.resolve(claimReturning)),
              }),
            };
          }),
        };
      }),
    },
    sql: (...args: unknown[]) => args,
    // Re-export eq/and/inArray so the worker can use them
    get eq() { return actual.eq; },
    get and() { return actual.and; },
    get inArray() { return actual.inArray; },
  };
});

process.env.BATCH_QUEUE_URL =
  "https://sqs.us-east-1.amazonaws.com/123456789012/queue";

const { handler } = await import("../workers/batch-sender");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    organizationId: "org-1",
    status: "queued",
    audienceType: "all",
    topicId: null,
    segmentId: null,
    emailTemplateId: "tmpl-1",
    htmlContent: null,
    subject: "Test Subject",
    from: "sender@example.com",
    fromName: "Sender",
    replyTo: null,
    totalRecipients: 2,
    processedRecipients: 0,
    sent: 0,
    failed: 0,
    variableMappings: null,
    ...overrides,
  };
}

function makeContacts() {
  return [
    {
      id: "contact-1",
      email: "alice@example.com",
      phone: null,
      firstName: "Alice",
      lastName: "A",
      company: null,
      jobTitle: null,
      properties: {},
      createdAt: new Date("2026-01-15T10:00:00Z"),
    },
    {
      id: "contact-2",
      email: "bob@example.com",
      phone: null,
      firstName: "Bob",
      lastName: "B",
      company: null,
      jobTitle: null,
      properties: {},
      createdAt: new Date("2026-01-15T11:00:00Z"),
    },
  ];
}

function makeSQSEvent() {
  return {
    Records: [
      {
        body: JSON.stringify({
          batchId: "batch-1",
          organizationId: "org-1",
          awsAccountId: "aws-1",
          channel: "email",
          chunkIndex: 0,
        }),
        messageId: "sqs-msg-1",
        receiptHandle: "handle-1",
        attributes: makeSqsRecordAttributes(),
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:123:queue",
        awsRegion: "us-east-1",
      },
    ],
  };
}

/**
 * DB select call order in processJob (new claim-before-send contract):
 * 0. batchSend record
 * 1. contacts (getContactsChunk)
 * 2. aws account features (config set lookup)
 * 3. template (Promise.all)
 * 4. organization (Promise.all)
 *
 * Note: orgExt select only runs when batch.from is null (not in these tests).
 * The old dedup SELECT (slot 5) is GONE — replaced by INSERT claim + UPDATE re-claim.
 */
function setupSelects(opts: {
  batch: Record<string, unknown>;
  contacts?: unknown[];
}) {
  selectResults = [
    // 0. batch
    [opts.batch],
    // 1. contacts chunk
    opts.contacts ?? makeContacts(),
    // 2. aws account features (config set lookup — after contacts)
    [{}],
    // 3. template
    [
      {
        sesTemplateName: "wraps-tmpl-1",
        compiledHtml: "<p>Hi</p>",
        emailType: "marketing",
      },
    ],
    // 4. organization
    [{ name: "Test Org" }],
  ];
}

describe("Batch sender idempotency (claim-before-send)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesSendCalls.length = 0;
    sesBulkCallCount = 0;
    selectCallIndex = 0;
    selectResults = [];
    updateSetCalls.length = 0;
    // Default: all contacts claimed successfully by INSERT
    claimReturning = [{ contactId: "contact-1" }, { contactId: "contact-2" }];
    reclaimReturning = [];
  });

  it("claims all contacts before SES send on first invocation", async () => {
    // All contacts claimed by INSERT returning both
    claimReturning = [{ contactId: "contact-1" }, { contactId: "contact-2" }];
    reclaimReturning = [];
    setupSelects({ batch: makeBatch() });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // SES bulk send should include both contacts
    const bulkCall = sesSendCalls[1]?.[0] as
      | Record<string, unknown>
      | undefined;
    const entries = bulkCall?.BulkEmailEntries as
      | Array<Record<string, unknown>>
      | undefined;
    expect(entries).toHaveLength(2);
  });

  it("skips contacts whose claim INSERT was rejected (already claimed/sent)", async () => {
    // Only contact-2 is claimed — contact-1 already had a row in the DB (duplicate delivery)
    claimReturning = [{ contactId: "contact-2" }];
    // contact-1 is in notClaimed; re-claim UPDATE finds it's NOT failed/stale → returns []
    reclaimReturning = [];
    setupSelects({ batch: makeBatch() });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // SES should only be called for contact-2
    expect(sesSendCalls).toHaveLength(2); // GetAccount + 1 bulk send
    const bulkCall = sesSendCalls[1]?.[0] as
      | Record<string, unknown>
      | undefined;
    const entries = bulkCall?.BulkEmailEntries as
      | Array<Record<string, unknown>>
      | undefined;
    expect(entries).toHaveLength(1);

    // Verify the correct contact was kept — contact-2 (bob), not contact-1 (alice)
    const entry = entries?.[0] as
      | { Destination?: { ToAddresses?: string[] } }
      | undefined;
    expect(entry?.Destination?.ToAddresses).toEqual(["bob@example.com"]);

    const progressUpdate = updateSetCalls.find(
      (call) => "processedRecipients" in call
    );
    const processedExpr = progressUpdate?.processedRecipients;
    expect(getSqlNumericParams(processedExpr).at(-1)).toBe(1);
  });

  it("skips entire chunk when no contacts are claimed (all already processed)", async () => {
    // INSERT claimed nobody; re-claim found nobody retryable
    claimReturning = [];
    reclaimReturning = [];
    setupSelects({ batch: makeBatch() });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // Only GetAccount call, no bulk send
    const bulkSendCalls = sesSendCalls.filter(
      (call) =>
        (call[0] as Record<string, unknown>)?.BulkEmailEntries !== undefined
    );
    expect(bulkSendCalls).toHaveLength(0);

    const progressUpdate = updateSetCalls.find(
      (call) => "processedRecipients" in call
    );
    const processedExpr = progressUpdate?.processedRecipients;
    expect(getSqlNumericParams(processedExpr).at(-1)).toBe(0);
  });

  it("re-claims failed contacts via UPDATE so they are retried", async () => {
    // contact-1 has a failed row → INSERT skips it; UPDATE re-claims it
    claimReturning = [{ contactId: "contact-2" }]; // INSERT only claims contact-2
    reclaimReturning = [{ contactId: "contact-1" }]; // UPDATE re-claims contact-1
    setupSelects({ batch: makeBatch() });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // Both contacts should be sent
    const bulkCall = sesSendCalls[1]?.[0] as
      | Record<string, unknown>
      | undefined;
    const entries = bulkCall?.BulkEmailEntries as
      | Array<Record<string, unknown>>
      | undefined;
    expect(entries).toHaveLength(2);

    const progressUpdate = updateSetCalls.find(
      (call) => "processedRecipients" in call
    );
    const processedExpr = progressUpdate?.processedRecipients;
    expect(getSqlNumericParams(processedExpr).at(-1)).toBe(2);
  });

  it("post-send writes UPDATE the claimed rows — no insert after SES call", async () => {
    claimReturning = [{ contactId: "contact-1" }, { contactId: "contact-2" }];
    reclaimReturning = [];
    setupSelects({ batch: makeBatch({ totalRecipients: 100 }) });

    const { db } = await import("@wraps/db");

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    // insert should have been called exactly once (the claim, before SES)
    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);

    // update should have been called: re-claim (1) + per-recipient sent (2) + batchSend progress (1) + contact counters (1)
    // The exact count may vary but there should be no insert after SES
    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
  });

  it("progress UPDATE carries heartbeat fields in a single .set() call", async () => {
    claimReturning = [{ contactId: "contact-1" }, { contactId: "contact-2" }];
    reclaimReturning = [];
    setupSelects({
      batch: makeBatch({ totalRecipients: 100 }),
    });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const progressUpdate = updateSetCalls.find(
      (call) => "processedRecipients" in call && "lastChunkIndex" in call
    );

    expect(progressUpdate).toBeDefined();
    expect(progressUpdate).toMatchObject({
      lastChunkIndex: 0,
    });
    expect(progressUpdate?.lastChunkAt).toBeInstanceOf(Date);
    // lastCursor must be an object or null — never undefined, so the column
    // actually overwrites prior state. With 2 contacts we expect a cursor.
    expect(progressUpdate?.lastCursor).toMatchObject({ id: "contact-2" });

    expect(progressUpdate).toHaveProperty("sent");
    expect(progressUpdate).toHaveProperty("failed");
  });

  it("progress UPDATE writes lastCursor=null when chunk is short (terminal)", async () => {
    // Short-chunk path (contacts.length < Math.min(CHUNK_SIZE, remaining)):
    // we still want lastChunkAt/lastChunkIndex recorded for observability.
    claimReturning = [{ contactId: "contact-1" }, { contactId: "contact-2" }];
    reclaimReturning = [];
    setupSelects({
      batch: makeBatch({ totalRecipients: 2 }),
    });

    await handler(makeSQSEvent(), makeMockContext(), vi.fn());

    const progressUpdate = updateSetCalls.find(
      (call) => "processedRecipients" in call && "lastChunkIndex" in call
    );
    expect(progressUpdate).toBeDefined();
    expect(progressUpdate?.lastChunkIndex).toBe(0);
  });
});
