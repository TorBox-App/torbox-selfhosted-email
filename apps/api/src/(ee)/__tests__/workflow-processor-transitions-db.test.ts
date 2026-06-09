/**
 * Workflow Processor — processStep atomic-claim / terminal-exclusion (REAL DB)
 *
 * Real-Neon behavioral tests for the atomic execution claim in `processStep`
 * (apps/api/src/(ee)/workers/workflow-processor.ts, ~L596-634). The claim is an
 *   UPDATE workflow_execution
 *     SET status='active', current_step_id=?
 *     WHERE id=? AND status NOT IN ('cancelled','completed','failed')
 *     RETURNING *
 * If nothing returns, processStep bails with NO side effects (no enqueue, no
 * step execution). A claimable (non-terminal) execution proceeds to run its
 * current step.
 *
 * These seed real rows → drive `processStep` via the SQS `handler` → assert the
 * PERSISTED execution row, not Drizzle query-builder internals. A wrong-direction
 * claim (e.g. dropping the `NOT IN terminal` guard, or claiming terminal rows)
 * fails here naturally.
 *
 * Boundary mocks ONLY:
 *   - ../../services/workflow-queue (SQS) — assert enqueue called / not called.
 *   - global fetch (the webhook step's HTTP egress) — observe step execution.
 *   - node:dns/promises — validateWebhookUrl()'s SSRF DNS lookup (external I/O).
 * @wraps/db is the REAL database.
 */

import {
  db,
  eq,
  workflow,
  workflowExecution,
  workflowStepExecution,
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
  executionRow,
  seedBaseOrg,
  workflowRow,
} from "./fixtures/real-db";
import { makeSQSEvent } from "./fixtures/workflow-fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// Boundary mocks (SQS + DNS). @wraps/db is REAL.
// ─────────────────────────────────────────────────────────────────────────────

const mockEnqueueWorkflowStep = vi.fn().mockResolvedValue(undefined);
const mockEnqueueWorkflowStepBatch = vi.fn().mockResolvedValue(undefined);
const mockDeleteScheduledStep = vi.fn().mockResolvedValue(undefined);

vi.mock("../../services/workflow-queue", () => ({
  enqueueWorkflowStep: mockEnqueueWorkflowStep,
  enqueueWorkflowStepBatch: mockEnqueueWorkflowStepBatch,
  deleteScheduledStep: mockDeleteScheduledStep,
  scheduleWaitTimeout: vi.fn().mockResolvedValue("sched-wait"),
  scheduleWorkflowStep: vi.fn().mockResolvedValue("sched-step"),
}));

// validateWebhookUrl() does a real DNS lookup for SSRF defense. Stub it to a
// public address so the webhook step proceeds to the (stubbed) fetch.
const mockDnsLookup = vi
  .fn()
  .mockResolvedValue({ address: "93.184.216.34", family: 4 });
vi.mock("node:dns/promises", () => ({
  default: { lookup: mockDnsLookup },
  lookup: mockDnsLookup,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { handler } = await import("../workers/workflow-processor");

// ─────────────────────────────────────────────────────────────────────────────

const TEST_PREFIX = "wf-proc-trans-db";
const WEBHOOK_URL = "https://hook.transitions-db.example.com/ingest";

let fixture: BaseOrgFixture;

/** Webhook-step workflow: trigger-1 → step-hook (terminal after). */
function webhookWorkflow(ids: BaseOrgFixture["ids"]) {
  return workflowRow(ids, {
    steps: [
      {
        id: "trigger-1",
        type: "trigger",
        name: "Trigger",
        position: { x: 0, y: 0 },
        config: { type: "trigger", triggerType: "event" },
      },
      {
        id: "step-hook",
        type: "webhook",
        name: "Webhook",
        position: { x: 0, y: 100 },
        config: { type: "webhook", url: WEBHOOK_URL, method: "POST" },
      },
    ],
    transitions: [
      {
        id: "t1",
        fromStepId: "trigger-1",
        toStepId: "step-hook",
      },
    ],
  } as Partial<typeof workflow.$inferInsert>);
}

function executeJob(executionId: string, stepId: string, orgId: string) {
  return {
    type: "execute" as const,
    executionId,
    stepId,
    organizationId: orgId,
  };
}

async function getExecution(id: string) {
  return await db.query.workflowExecution.findFirst({
    where: eq(workflowExecution.id, id),
  });
}

describe("processStep atomic claim / terminal exclusion (real DB)", () => {
  beforeAll(async () => {
    fixture = await seedBaseOrg(TEST_PREFIX);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDnsLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    await clearWorkflowState(fixture.ids.org, fixture.ids.otherOrg);
  });

  afterAll(async () => {
    await cleanupBaseOrg(TEST_PREFIX);
  });

  // Unit 10 — a cancelled execution must not be resurrected.
  it("Unit 10: cancelled execution exits cleanly, no side effects", async () => {
    const { ids } = fixture;
    await db.insert(workflow).values(webhookWorkflow(ids));
    await db.insert(workflowExecution).values(
      executionRow(ids, {
        id: `${ids.org}-exec-cancelled`,
        status: "cancelled",
        currentStepId: "step-hook",
      })
    );

    await handler(
      makeSQSEvent(
        executeJob(`${ids.org}-exec-cancelled`, "step-hook", ids.org)
      )
    );

    // Execution row is UNCHANGED — still cancelled (no flip to active).
    const after = await getExecution(`${ids.org}-exec-cancelled`);
    expect(after?.status).toBe("cancelled");

    // No claim → no next step enqueued.
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();

    // No step execution side effect — the webhook never fired.
    expect(mockFetch).not.toHaveBeenCalled();

    // And no step-execution row was written for this execution.
    const stepExecs = await db
      .select()
      .from(workflowStepExecution)
      .where(
        eq(workflowStepExecution.executionId, `${ids.org}-exec-cancelled`)
      );
    expect(stepExecs).toHaveLength(0);
  });

  // Unit 11 — a claimable (active) execution proceeds and runs its step.
  it("Unit 11: claimable active execution is claimed and its webhook step fires", async () => {
    const { ids } = fixture;
    await db.insert(workflow).values(webhookWorkflow(ids));
    await db.insert(workflowExecution).values(
      executionRow(ids, {
        id: `${ids.org}-exec-active`,
        status: "active",
        currentStepId: "step-hook",
      })
    );

    await handler(
      makeSQSEvent(executeJob(`${ids.org}-exec-active`, "step-hook", ids.org))
    );

    // The webhook step actually ran against the configured URL.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      WEBHOOK_URL,
      expect.objectContaining({ method: "POST" })
    );

    // The step execution was claimed + completed in the DB.
    const [stepExec] = await db
      .select()
      .from(workflowStepExecution)
      .where(eq(workflowStepExecution.executionId, `${ids.org}-exec-active`));
    expect(stepExec).toBeDefined();
    expect(stepExec.stepId).toBe("step-hook");
    expect(stepExec.status).toBe("completed");

    // step-hook is terminal (no outgoing transition) → execution completes,
    // never enqueues a follow-on execute job.
    const after = await getExecution(`${ids.org}-exec-active`);
    expect(after?.status).toBe("completed");
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
  });

  // Unit 11 (paused variant) — paused is NOT terminal, so it is claimable too.
  it("Unit 11: paused execution is claimable (paused not in terminal set)", async () => {
    const { ids } = fixture;
    await db.insert(workflow).values(webhookWorkflow(ids));
    await db.insert(workflowExecution).values(
      executionRow(ids, {
        id: `${ids.org}-exec-paused`,
        status: "paused",
        currentStepId: "step-hook",
      })
    );

    await handler(
      makeSQSEvent(executeJob(`${ids.org}-exec-paused`, "step-hook", ids.org))
    );

    // Claimed → webhook fired → completed.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const after = await getExecution(`${ids.org}-exec-paused`);
    expect(after?.status).toBe("completed");
  });

  // Terminal exclusion — completed and failed rows are never claimed/mutated.
  it("terminal exclusion: completed execution is left unchanged", async () => {
    const { ids } = fixture;
    await db.insert(workflow).values(webhookWorkflow(ids));
    const completedAt = new Date("2020-01-01T00:00:00.000Z");
    await db.insert(workflowExecution).values(
      executionRow(ids, {
        id: `${ids.org}-exec-completed`,
        status: "completed",
        currentStepId: "step-hook",
        completedAt,
      })
    );

    await handler(
      makeSQSEvent(
        executeJob(`${ids.org}-exec-completed`, "step-hook", ids.org)
      )
    );

    const after = await getExecution(`${ids.org}-exec-completed`);
    expect(after?.status).toBe("completed");
    // completedAt untouched — proves no UPDATE ran on the row.
    expect(after?.completedAt?.getTime()).toBe(completedAt.getTime());
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();

    const stepExecs = await db
      .select()
      .from(workflowStepExecution)
      .where(
        eq(workflowStepExecution.executionId, `${ids.org}-exec-completed`)
      );
    expect(stepExecs).toHaveLength(0);
  });

  it("terminal exclusion: failed execution is left unchanged", async () => {
    const { ids } = fixture;
    await db.insert(workflow).values(webhookWorkflow(ids));
    await db.insert(workflowExecution).values(
      executionRow(ids, {
        id: `${ids.org}-exec-failed`,
        status: "failed",
        currentStepId: "step-hook",
        error: "prior failure",
        errorStepId: "step-hook",
      })
    );

    await handler(
      makeSQSEvent(executeJob(`${ids.org}-exec-failed`, "step-hook", ids.org))
    );

    const after = await getExecution(`${ids.org}-exec-failed`);
    expect(after?.status).toBe("failed");
    // Original error preserved — no mutation.
    expect(after?.error).toBe("prior failure");
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
