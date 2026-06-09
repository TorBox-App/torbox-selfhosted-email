/**
 * Webhook Engagement — Real-DB IDOR & Resume Tests (Unit 23)
 *
 * Replaces the mock-call-structure assertions in webhook-engagement.test.ts
 * with behavioral assertions against the real Neon test branch.
 *
 * What this proves, against persisted DB state (not Drizzle internals):
 *  - The engagement webhook resumes ONLY the authenticated org's waiting
 *    execution. A waiting execution in a DIFFERENT org keyed on the SAME
 *    `email_engagement:<messageId>` is never enqueued and stays `waiting`.
 *    (cross-org IDOR guard — Unit 23 / Issue #17)
 *  - Open → resume with branch "opened"; Click → resume with branch "clicked".
 *  - messageSend engagement fields (openedAt / clickedAt / status) persist.
 *  - A wrong webhook secret returns 401 and resumes nothing.
 *
 * Boundary mocks ONLY:
 *  - ../services/workflow-queue  (SQS — capture resume enqueues)
 *  - ../lib/activation-tracking  (usage/activation side effect)
 * Everything else (including @wraps/db) is REAL.
 *
 * If the org scope on resumeWaitingExecutions were removed, the other org's
 * execution would be eligible for resume — the "no enqueue for other-org exec
 * + it stays waiting" assertions below catch that regression.
 */

import { db, eq, messageSend, workflow, workflowExecution } from "@wraps/db";
import { and } from "drizzle-orm";
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
import { buildClickEvent, buildOpenEvent } from "./fixtures/ses-events";

vi.mock("../services/workflow-queue", async () => {
  const actual = await vi.importActual("../services/workflow-queue");
  return {
    ...actual,
    enqueueWorkflowStep: vi.fn().mockResolvedValue(undefined),
    enqueueWorkflowStepBatch: vi.fn().mockResolvedValue(undefined),
    deleteScheduledStep: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../lib/activation-tracking", async () => {
  const actual = await vi.importActual("../lib/activation-tracking");
  return {
    ...actual,
    trackFirstEmailDelivered: vi.fn().mockResolvedValue(undefined),
  };
});

const { Elysia } = await import("elysia");
const { webhooksRoutes } = await import("../routes/webhooks");
const { enqueueWorkflowStep } = await import("../services/workflow-queue");

const TEST_PREFIX = "wh-engage-db";

// The SES messageId shared by the primary messageSend and BOTH orgs' executions.
const MESSAGE_ID = `${TEST_PREFIX}-ses-X`;
const WAITING_EVENT = `email_engagement:${MESSAGE_ID}`;

let fixture: BaseOrgFixture;

function createTestApp() {
  return new Elysia().use(webhooksRoutes);
}

function postWebhook(
  accountNumber: string,
  secret: string,
  event: Record<string, unknown>
) {
  return createTestApp().handle(
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

/** Seed a workflow row in the given org so executions satisfy their FK. */
async function seedWorkflow(orgId: string, createdBy: string, id: string) {
  await db
    .insert(workflow)
    .values({
      id,
      organizationId: orgId,
      name: "Engagement Wait Flow",
      status: "enabled",
      triggerType: "event",
      triggerConfig: {},
      steps: [],
      transitions: [],
      allowReentry: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof workflow.$inferInsert)
    .onConflictDoUpdate({
      target: workflow.id,
      set: { updatedAt: new Date() },
    });
}

describe("Webhook: Engagement (real DB) — Unit 23 cross-org IDOR", () => {
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

  it("resumes ONLY the authenticated org's waiting execution (no cross-org IDOR)", async () => {
    const { ids } = fixture;

    // 1. messageSend in PRIMARY org, messageId X, delivered, primary contact.
    await db.insert(messageSend).values(
      messageSendRow(ids, {
        id: `${ids.org}-msg-X`,
        messageId: MESSAGE_ID,
        contactId: ids.contact,
        status: "delivered",
      })
    );

    // 2. Workflow + waiting execution in PRIMARY org keyed on email_engagement:X.
    const primaryWfId = `${ids.org}-engage-wf`;
    await seedWorkflow(ids.org, ids.user, primaryWfId);
    const primaryExecId = `${ids.org}-engage-exec`;
    await db.insert(workflowExecution).values({
      id: primaryExecId,
      workflowId: primaryWfId,
      contactId: ids.contact,
      organizationId: ids.org,
      status: "waiting",
      waitingForEvent: WAITING_EVENT,
      allowReentry: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof workflowExecution.$inferInsert);

    // 3. Workflow + waiting execution in OTHER org, SAME waitingForEvent key.
    const otherWfId = `${ids.otherOrg}-engage-wf`;
    await seedWorkflow(ids.otherOrg, ids.user, otherWfId);
    const otherExecId = `${ids.otherOrg}-engage-exec`;
    await db.insert(workflowExecution).values({
      id: otherExecId,
      workflowId: otherWfId,
      contactId: ids.otherContact,
      organizationId: ids.otherOrg,
      status: "waiting",
      waitingForEvent: WAITING_EVENT,
      allowReentry: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof workflowExecution.$inferInsert);

    // 4. POST an Open event for messageId X to the PRIMARY org's account.
    const res = await postWebhook(
      fixture.accountNumber,
      fixture.secret,
      buildOpenEvent({ mail: { messageId: MESSAGE_ID } })
    );
    expect(res.status).toBe(200);

    // 5a. Exactly one resume enqueued, for the PRIMARY execution, branch "opened".
    expect(enqueueWorkflowStep).toHaveBeenCalledTimes(1);
    expect(enqueueWorkflowStep).toHaveBeenCalledWith({
      type: "resume",
      executionId: primaryExecId,
      branch: "opened",
      organizationId: ids.org,
    });

    // 5b. The other org's execution was NEVER enqueued.
    expect(enqueueWorkflowStep).not.toHaveBeenCalledWith(
      expect.objectContaining({ executionId: otherExecId })
    );

    // 5c. The other org's execution row is STILL `waiting` in the DB.
    const [otherExec] = await db
      .select()
      .from(workflowExecution)
      .where(eq(workflowExecution.id, otherExecId));
    expect(otherExec?.status).toBe("waiting");
  });

  it("positive control: Click resumes with branch 'clicked' and persists clickedAt", async () => {
    const { ids } = fixture;

    await db.insert(messageSend).values(
      messageSendRow(ids, {
        id: `${ids.org}-msg-X`,
        messageId: MESSAGE_ID,
        contactId: ids.contact,
        status: "delivered",
      })
    );

    const wfId = `${ids.org}-engage-wf`;
    await seedWorkflow(ids.org, ids.user, wfId);
    const execId = `${ids.org}-engage-exec-click`;
    await db.insert(workflowExecution).values({
      id: execId,
      workflowId: wfId,
      contactId: ids.contact,
      organizationId: ids.org,
      status: "waiting",
      waitingForEvent: WAITING_EVENT,
      allowReentry: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof workflowExecution.$inferInsert);

    const res = await postWebhook(
      fixture.accountNumber,
      fixture.secret,
      buildClickEvent({
        mail: { messageId: MESSAGE_ID },
        link: "https://example.com/cta",
      })
    );
    expect(res.status).toBe(200);

    expect(enqueueWorkflowStep).toHaveBeenCalledTimes(1);
    expect(enqueueWorkflowStep).toHaveBeenCalledWith({
      type: "resume",
      executionId: execId,
      branch: "clicked",
      organizationId: ids.org,
    });

    // messageSend engagement fields persisted on the primary message.
    const [msg] = await db
      .select()
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, ids.org),
          eq(messageSend.messageId, MESSAGE_ID)
        )
      );
    expect(msg?.status).toBe("clicked");
    expect(msg?.clickedAt).toBeInstanceOf(Date);
    expect(msg?.clickedUrl).toBe("https://example.com/cta");
  });

  it("Open persists status='opened' and openedAt on the messageSend", async () => {
    const { ids } = fixture;

    await db.insert(messageSend).values(
      messageSendRow(ids, {
        id: `${ids.org}-msg-X`,
        messageId: MESSAGE_ID,
        contactId: ids.contact,
        status: "delivered",
      })
    );

    const res = await postWebhook(
      fixture.accountNumber,
      fixture.secret,
      buildOpenEvent({ mail: { messageId: MESSAGE_ID } })
    );
    expect(res.status).toBe(200);

    const [msg] = await db
      .select()
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, ids.org),
          eq(messageSend.messageId, MESSAGE_ID)
        )
      );
    expect(msg?.status).toBe("opened");
    expect(msg?.openedAt).toBeInstanceOf(Date);
  });

  it("negative: wrong webhook secret returns 401 and resumes nothing", async () => {
    const { ids } = fixture;

    await db.insert(messageSend).values(
      messageSendRow(ids, {
        id: `${ids.org}-msg-X`,
        messageId: MESSAGE_ID,
        contactId: ids.contact,
        status: "delivered",
      })
    );

    const wfId = `${ids.org}-engage-wf`;
    await seedWorkflow(ids.org, ids.user, wfId);
    const execId = `${ids.org}-engage-exec-401`;
    await db.insert(workflowExecution).values({
      id: execId,
      workflowId: wfId,
      contactId: ids.contact,
      organizationId: ids.org,
      status: "waiting",
      waitingForEvent: WAITING_EVENT,
      allowReentry: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof workflowExecution.$inferInsert);

    const res = await postWebhook(
      fixture.accountNumber,
      "totally-wrong-secret",
      buildOpenEvent({ mail: { messageId: MESSAGE_ID } })
    );
    expect(res.status).toBe(401);

    // Nothing resumed.
    expect(enqueueWorkflowStep).not.toHaveBeenCalled();

    // The waiting execution is untouched.
    const [exec] = await db
      .select()
      .from(workflowExecution)
      .where(eq(workflowExecution.id, execId));
    expect(exec?.status).toBe("waiting");

    // The messageSend was not transitioned to opened.
    const [msg] = await db
      .select()
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, ids.org),
          eq(messageSend.messageId, MESSAGE_ID)
        )
      );
    expect(msg?.status).toBe("delivered");
  });
});
