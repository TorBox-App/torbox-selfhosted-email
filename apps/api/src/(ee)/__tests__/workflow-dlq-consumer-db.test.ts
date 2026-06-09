/**
 * Workflow DLQ Consumer — real-DB behavioral tests
 *
 * Companion to workflow-dlq-consumer.test.ts (which is correctly mocked for the
 * boundary cases: malformed-JSON resilience, scheduler chain repair, and the
 * forced mid-transaction rollback that a real DB can't be made to throw on
 * command). This file seeds real rows on the shared Neon test branch, runs the
 * SQS DLQ handler, and asserts on persisted state — proving the transaction
 * commits atomically, the terminal-status guard makes redelivery idempotent,
 * and `type:"trigger"` fails the most-recent active execution.
 *
 * Boundaries mocked: ../services/workflow-scheduler (EventBridge) — never hit
 * here but imported by the consumer. @wraps/db is NEVER mocked.
 *
 * Pattern: see apps/api/src/__tests__/events-single.test.ts
 *   beforeAll → seedBaseOrg, beforeEach → clearWorkflowState + clearAllMocks,
 *   afterAll → cleanupBaseOrg.
 */

import { db, eq, workflow, workflowExecution } from "@wraps/db";
import type { SQSEvent } from "aws-lambda";
import { and, desc, inArray } from "drizzle-orm";
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
  seedBaseOrg,
  workflowRow,
} from "./fixtures/real-db";

// Boundary: scheduler is EventBridge — never reached by these tests, but the
// consumer imports it. Mocking keeps the module graph free of AWS SDK.
vi.mock("../services/workflow-scheduler", () => ({
  createNextWorkflowSchedule: vi.fn().mockResolvedValue("sched-noop"),
}));

const { handler } = await import("../workers/workflow-dlq-consumer");

const TEST_PREFIX = "wf-dlq-db";

// ─────────────────────────────────────────────────────────────────────────────
// SQS DLQ event shape — mirrors a message that exhausted 3 retries
// (ApproximateReceiveCount "4") and landed in the dead-letter queue.
// ─────────────────────────────────────────────────────────────────────────────
function makeSQSEvent(...bodies: unknown[]): SQSEvent {
  return {
    Records: bodies.map((body, i) => ({
      messageId: `${TEST_PREFIX}-msg-${i}`,
      receiptHandle: `${TEST_PREFIX}-rh-${i}`,
      body: typeof body === "string" ? body : JSON.stringify(body),
      attributes: {
        ApproximateReceiveCount: "4",
        SentTimestamp: "0",
        SenderId: "test",
        ApproximateFirstReceiveTimestamp: "0",
      },
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:000:wraps-workflow-dlq",
      awsRegion: "us-east-1",
    })),
  };
}

async function getWorkflow(workflowId: string) {
  const [row] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1);
  return row;
}

async function getExecution(executionId: string) {
  const [row] = await db
    .select()
    .from(workflowExecution)
    .where(eq(workflowExecution.id, executionId))
    .limit(1);
  return row;
}

describe("Workflow DLQ consumer (real DB)", () => {
  let fixture: BaseOrgFixture;

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

  // ───────────────────────────────────────────────────────────────────────────
  // Unit 27 — transaction atomicity (positive): both writes commit as a unit.
  // ───────────────────────────────────────────────────────────────────────────
  describe("Unit 27 — transaction atomicity", () => {
    it("commits execution status=failed AND counter updates together", async () => {
      const { ids } = fixture;
      await db.insert(workflow).values(
        workflowRow(ids, {
          id: `${ids.org}-wf-27`,
          activeExecutions: 1,
          failedExecutions: 0,
        })
      );
      await db.insert(workflowExecution).values(
        executionRow(ids, {
          id: `${ids.org}-exec-27`,
          workflowId: `${ids.org}-wf-27`,
          status: "active",
        })
      );

      await handler(
        makeSQSEvent({
          type: "execute",
          executionId: `${ids.org}-exec-27`,
          stepId: "step-1",
          organizationId: ids.org,
        }),
        {} as never,
        () => {}
      );

      const exec = await getExecution(`${ids.org}-exec-27`);
      const wf = await getWorkflow(`${ids.org}-wf-27`);

      // Execution write landed.
      expect(exec.status).toBe("failed");
      expect(exec.error).toBe("Step step-1 failed after SQS retries exhausted");
      expect(exec.errorStepId).toBe("step-1");
      expect(exec.completedAt).not.toBeNull();

      // Counter write landed in the SAME transaction.
      expect(wf.activeExecutions).toBe(0);
      expect(wf.failedExecutions).toBe(1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Idempotency: re-running the same DLQ message must NOT double-decrement.
    // The terminal-status guard (notInArray) blocks the second counter mutation.
    // ─────────────────────────────────────────────────────────────────────────
    it("is idempotent on SQS redelivery — counters unchanged on second run", async () => {
      const { ids } = fixture;
      await db.insert(workflow).values(
        workflowRow(ids, {
          id: `${ids.org}-wf-idem`,
          activeExecutions: 1,
          failedExecutions: 0,
        })
      );
      await db.insert(workflowExecution).values(
        executionRow(ids, {
          id: `${ids.org}-exec-idem`,
          workflowId: `${ids.org}-wf-idem`,
          status: "active",
        })
      );

      const event = makeSQSEvent({
        type: "execute",
        executionId: `${ids.org}-exec-idem`,
        stepId: "step-1",
        organizationId: ids.org,
      });

      await handler(event, {} as never, () => {}); // initial delivery
      await handler(event, {} as never, () => {}); // SQS at-least-once redelivery

      const wf = await getWorkflow(`${ids.org}-wf-idem`);

      // Exactly one decrement / one increment despite two deliveries.
      expect(wf.activeExecutions).toBe(0);
      expect(wf.failedExecutions).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Unit 22 — trigger ordering: fail the MOST-RECENT active execution.
  // ───────────────────────────────────────────────────────────────────────────
  describe("Unit 22 — trigger fails the most-recent execution", () => {
    it("orders by desc(createdAt) and fails the newest, leaving the older active", async () => {
      const { ids } = fixture;
      await db.insert(workflow).values(
        workflowRow(ids, {
          id: `${ids.org}-wf-22`,
          allowReentry: true,
          activeExecutions: 2,
          failedExecutions: 0,
        })
      );

      const older = new Date("2024-01-01T00:00:00.000Z");
      const newer = new Date("2024-06-01T00:00:00.000Z");

      await db.insert(workflowExecution).values([
        executionRow(ids, {
          id: `${ids.org}-exec-older`,
          workflowId: `${ids.org}-wf-22`,
          status: "active",
          allowReentry: true,
          createdAt: older,
          updatedAt: older,
        }),
        executionRow(ids, {
          id: `${ids.org}-exec-newer`,
          workflowId: `${ids.org}-wf-22`,
          status: "active",
          allowReentry: true,
          createdAt: newer,
          updatedAt: newer,
        }),
      ]);

      await handler(
        makeSQSEvent({
          type: "trigger",
          workflowId: `${ids.org}-wf-22`,
          contactId: ids.contact,
          organizationId: ids.org,
        }),
        {} as never,
        () => {}
      );

      const olderExec = await getExecution(`${ids.org}-exec-older`);
      const newerExec = await getExecution(`${ids.org}-exec-newer`);

      // The newest active execution is the one failed.
      expect(newerExec.status).toBe("failed");
      expect(newerExec.error).toBe(
        "Trigger failed after SQS retries exhausted"
      );
      // The older one is untouched.
      expect(olderExec.status).toBe("active");

      // Exactly one counter decrement / increment.
      const wf = await getWorkflow(`${ids.org}-wf-22`);
      expect(wf.activeExecutions).toBe(1);
      expect(wf.failedExecutions).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DLQ-never-throws invariant: malformed / missing-record input is a no-op.
  // ───────────────────────────────────────────────────────────────────────────
  describe("never throws on bad input", () => {
    it("resolves successfully on malformed JSON and makes no mutations", async () => {
      const { ids } = fixture;
      await db.insert(workflow).values(
        workflowRow(ids, {
          id: `${ids.org}-wf-bad`,
          activeExecutions: 3,
          failedExecutions: 0,
        })
      );

      await expect(
        handler(makeSQSEvent("not valid json {{{"), {} as never, () => {})
      ).resolves.toBeUndefined();

      // Workflow counters untouched — nothing was processed.
      const wf = await getWorkflow(`${ids.org}-wf-bad`);
      expect(wf.activeExecutions).toBe(3);
      expect(wf.failedExecutions).toBe(0);
    });

    it("resolves successfully when the referenced execution does not exist", async () => {
      const { ids } = fixture;
      await db.insert(workflow).values(
        workflowRow(ids, {
          id: `${ids.org}-wf-missing`,
          activeExecutions: 1,
          failedExecutions: 0,
        })
      );

      // No execution with this id exists — failExecution claims 0 rows, so the
      // counter update is skipped entirely.
      await expect(
        handler(
          makeSQSEvent({
            type: "execute",
            executionId: `${ids.org}-exec-does-not-exist`,
            stepId: "step-1",
            organizationId: ids.org,
          }),
          {} as never,
          () => {}
        )
      ).resolves.toBeUndefined();

      const wf = await getWorkflow(`${ids.org}-wf-missing`);
      expect(wf.activeExecutions).toBe(1);
      expect(wf.failedExecutions).toBe(0);

      // And no spurious execution rows for this org beyond what we seeded (none).
      const execs = await db
        .select({ id: workflowExecution.id })
        .from(workflowExecution)
        .where(
          and(
            eq(workflowExecution.organizationId, ids.org),
            inArray(workflowExecution.status, ["failed"])
          )
        )
        .orderBy(desc(workflowExecution.createdAt));
      expect(execs).toHaveLength(0);
    });
  });
});
