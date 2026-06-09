/**
 * Webhook Complaint Tests (real DB)
 *
 * Unit 31 — complaint marks status + resumes waiting executions.
 *
 * Behavioral, real-Neon-DB version of `processComplaint` (routes/webhooks.ts).
 * A SES "Complaint" event must:
 *   1. Persist `messageSend.status="complained"` (+ `complainedAt`).
 *   2. Resume any workflow execution `waiting` on
 *      `email_engagement:${messageId}` for that contact/org, enqueuing a
 *      `{type:"resume", branch:"bounced"}` job (complaint is treated like a
 *      bounce — this is the resume call this feature added; the pre-feature
 *      handler flipped status but never resumed).
 *   3. Be idempotent when no execution is waiting (status still flips, no
 *      enqueue, no throw).
 *
 * We seed real `messageSend` / `workflowExecution` rows, POST a real SES
 * Complaint event through the route, then re-query persisted state — no
 * coupling to Drizzle query-builder internals.
 *
 * Only true boundaries are mocked: the SQS queue (`workflow-queue`, where we
 * capture the resume enqueue) and the activation tracker. `@wraps/db` is REAL —
 * the `messageSend` / `workflowExecution` writes run against Neon.
 */

import { db, eq, messageSend, workflow, workflowExecution } from "@wraps/db";
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
  executionRow,
  messageSendRow,
  seedBaseOrg,
  workflowRow,
} from "../(ee)/__tests__/fixtures/real-db";
import { buildComplaintEvent } from "./fixtures/ses-events";

vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn().mockResolvedValue(undefined),
  deleteScheduledStep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/activation-tracking", () => ({
  trackFirstEmailDelivered: vi.fn().mockResolvedValue(undefined),
}));

const { webhooksRoutes } = await import("../routes/webhooks");
const { enqueueWorkflowStep } = await import("../services/workflow-queue");

const TEST_PREFIX = "wh-complaint-db";

let fixture: BaseOrgFixture;

function createApp() {
  return new Elysia().use(webhooksRoutes);
}

function postComplaint(
  accountNumber: string,
  messageId: string,
  secret: string
) {
  const event = buildComplaintEvent({ mail: { messageId } });
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
  overrides: Partial<typeof messageSend.$inferInsert> = {}
) {
  await db.insert(messageSend).values(
    messageSendRow(fixture.ids, {
      id: `${TEST_PREFIX}-msg`,
      messageId,
      status: "delivered",
      ...overrides,
    })
  );
}

async function getMessage(messageId: string) {
  const [row] = await db
    .select({
      status: messageSend.status,
      complainedAt: messageSend.complainedAt,
    })
    .from(messageSend)
    .where(eq(messageSend.messageId, messageId))
    .limit(1);
  return row;
}

async function seedWaitingExecution(messageId: string, execId: string) {
  await db.insert(workflow).values(workflowRow(fixture.ids));
  await db.insert(workflowExecution).values(
    executionRow(fixture.ids, {
      id: execId,
      status: "waiting",
      waitingForEvent: `email_engagement:${messageId}`,
      currentStepId: "step-1",
    })
  );
}

describe("webhook complaint (real DB)", () => {
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

  it("persists messageSend.status='complained' (+ complainedAt)", async () => {
    const messageId = `${TEST_PREFIX}-mid-status`;
    await seedMessage(messageId);

    const res = await postComplaint(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("processed");
    expect(body.eventType).toBe("Complaint");

    const row = await getMessage(messageId);
    expect(row.status).toBe("complained");
    expect(row.complainedAt).not.toBeNull();
  });

  it("resumes a waiting execution with branch='bounced'", async () => {
    const messageId = `${TEST_PREFIX}-mid-resume`;
    const execId = `${TEST_PREFIX}-exec-resume`;
    await seedMessage(messageId);
    await seedWaitingExecution(messageId, execId);

    const res = await postComplaint(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res.status).toBe(200);

    // Status still flips.
    const row = await getMessage(messageId);
    expect(row.status).toBe("complained");

    // The resume job was enqueued for the waiting execution.
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resume",
        executionId: execId,
        branch: "bounced",
        organizationId: fixture.ids.org,
      })
    );
  });

  it("flips status but enqueues nothing when no execution is waiting (idempotent)", async () => {
    const messageId = `${TEST_PREFIX}-mid-noexec`;
    await seedMessage(messageId);

    const res = await postComplaint(
      fixture.accountNumber,
      messageId,
      fixture.secret
    );
    expect(res.status).toBe(200);

    const row = await getMessage(messageId);
    expect(row.status).toBe("complained");
    expect(enqueueWorkflowStep).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret with 401 and does not mutate status", async () => {
    const messageId = `${TEST_PREFIX}-mid-auth`;
    await seedMessage(messageId);

    const res = await postComplaint(
      fixture.accountNumber,
      messageId,
      "wrong-secret"
    );
    expect(res.status).toBe(401);

    const row = await getMessage(messageId);
    expect(row.status).toBe("delivered");
    expect(row.complainedAt).toBeNull();
    expect(enqueueWorkflowStep).not.toHaveBeenCalled();
  });
});
