/**
 * Workflow Events Service — REAL DB behavioral tests (Step 7)
 *
 * Real-DB counterpart to the mocked `workflow-events.test.ts`. Seeds N matching
 * enabled workflows on the shared Neon test branch, calls the emitter, and
 * asserts the collect-then-batch boundary: `enqueueWorkflowStepBatch` is called
 * EXACTLY ONCE with N jobs (never a per-workflow `enqueueWorkflowStep` loop).
 *
 * The real value over the mocked version: the matching-workflows set comes from
 * the real DB query (org scope + status + triggerType + topicId JSON match), not
 * a hand-fed array. A reversion to a per-workflow enqueue loop, a broken
 * triggerType filter, or a dropped org/topic scope fails these naturally.
 *
 * Boundary mock: ONLY `../workflow-queue` (the SQS boundary). `@wraps/db` is the
 * real client — never mocked.
 *
 * Covers Units 5–8: emitContactCreated, emitContactUpdated, emitTopicSubscribed,
 * emitTopicUnsubscribed, plus a negative control proving the DB filter selects.
 */

import { db, eq, workflow } from "@wraps/db";
import { and, inArray } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../workflow-queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../workflow-queue")>();
  return {
    ...actual,
    enqueueWorkflowStep: vi.fn().mockResolvedValue(undefined),
    enqueueWorkflowStepBatch: vi.fn().mockResolvedValue(undefined),
    deleteScheduledStep: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  type BaseOrgFixture,
  cleanupBaseOrg,
  seedBaseOrg,
  workflowRow,
} from "../../(ee)/__tests__/fixtures/real-db";
import {
  emitContactCreated,
  emitContactUpdated,
  emitTopicSubscribed,
  emitTopicUnsubscribed,
} from "../workflow-events";
import {
  enqueueWorkflowStep,
  enqueueWorkflowStepBatch,
} from "../workflow-queue";

const TEST_PREFIX = "wf-events-db";
const TOPIC_ID = `${TEST_PREFIX}-topic-1`;

let fixture: BaseOrgFixture;

type TriggerType = NonNullable<(typeof workflow.$inferInsert)["triggerType"]>;

/** Seed `count` enabled workflows of a given triggerType, namespaced. */
async function seedWorkflows(
  triggerType: TriggerType,
  count: number,
  triggerConfig: Record<string, unknown> = {}
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `${fixture.ids.org}-wf-${triggerType}-${i}`;
    ids.push(id);
    await db.insert(workflow).values(
      workflowRow(fixture.ids, {
        id,
        name: `${triggerType} wf ${i}`,
        triggerType,
        triggerConfig,
      })
    );
  }
  return ids;
}

/** Remove all workflows for the primary org (between tests). */
async function clearWorkflows(): Promise<void> {
  await db.delete(workflow).where(eq(workflow.organizationId, fixture.ids.org));
}

const mockedBatch = vi.mocked(enqueueWorkflowStepBatch);
const mockedSingle = vi.mocked(enqueueWorkflowStep);

describe("Workflow Events — real DB collect-then-batch", () => {
  beforeAll(async () => {
    fixture = await seedBaseOrg(TEST_PREFIX);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearWorkflows();
  });

  afterAll(async () => {
    await cleanupBaseOrg(TEST_PREFIX);
  });

  // ── Unit 5 ───────────────────────────────────────────────────────────────
  it("emitContactCreated batches one enqueue call with 3 jobs (one per matching workflow)", async () => {
    const wfIds = await seedWorkflows("contact_created", 3);

    const result = await emitContactCreated({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
      contactData: { email: `${TEST_PREFIX}-c1@example.com` },
    });

    expect(result.workflowsTriggered).toBe(3);

    // Batch called exactly once (collect-then-batch), NOT a per-workflow loop.
    expect(mockedBatch).toHaveBeenCalledTimes(1);
    expect(mockedSingle).not.toHaveBeenCalled();

    const jobs = mockedBatch.mock.calls[0][0];
    expect(jobs).toHaveLength(3);
    for (const job of jobs) {
      expect(job).toMatchObject({
        type: "trigger",
        contactId: fixture.ids.contact,
        organizationId: fixture.ids.org,
      });
    }
    // The workflowIds come from the real DB query, not a hand-fed array.
    expect(
      jobs
        .map((j) => (j as unknown as { workflowId: string }).workflowId)
        .sort()
    ).toEqual([...wfIds].sort());
  });

  // ── Unit 6 ───────────────────────────────────────────────────────────────
  it("emitContactUpdated batches one enqueue call with 3 jobs", async () => {
    const wfIds = await seedWorkflows("contact_updated", 3);

    const result = await emitContactUpdated({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
      updatedFields: ["email"],
    });

    expect(result.workflowsTriggered).toBe(3);
    expect(mockedBatch).toHaveBeenCalledTimes(1);
    expect(mockedSingle).not.toHaveBeenCalled();

    const jobs = mockedBatch.mock.calls[0][0];
    expect(jobs).toHaveLength(3);
    expect(
      jobs
        .map((j) => (j as unknown as { workflowId: string }).workflowId)
        .sort()
    ).toEqual([...wfIds].sort());
  });

  // ── Unit 7 ───────────────────────────────────────────────────────────────
  it("emitTopicSubscribed batches one enqueue call with 3 topic-bound jobs", async () => {
    const wfIds = await seedWorkflows("topic_subscribed", 3, {
      topicId: TOPIC_ID,
    });

    const result = await emitTopicSubscribed({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
      topicId: TOPIC_ID,
      topicName: "Newsletter",
    });

    expect(result.workflowsTriggered).toBe(3);
    expect(mockedBatch).toHaveBeenCalledTimes(1);
    expect(mockedSingle).not.toHaveBeenCalled();

    const jobs = mockedBatch.mock.calls[0][0];
    expect(jobs).toHaveLength(3);
    for (const job of jobs) {
      expect(job).toMatchObject({ type: "trigger" });
      expect(
        (job as unknown as { eventData: { topicId: string } }).eventData.topicId
      ).toBe(TOPIC_ID);
    }
    expect(
      jobs
        .map((j) => (j as unknown as { workflowId: string }).workflowId)
        .sort()
    ).toEqual([...wfIds].sort());
  });

  it("emitTopicSubscribed ignores workflows bound to a DIFFERENT topicId", async () => {
    await seedWorkflows("topic_subscribed", 3, { topicId: TOPIC_ID });

    const result = await emitTopicSubscribed({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
      topicId: `${TEST_PREFIX}-other-topic`,
    });

    // Real JSON topicId filter excludes all of them.
    expect(result.workflowsTriggered).toBe(0);
    expect(mockedBatch).not.toHaveBeenCalled();
    expect(mockedSingle).not.toHaveBeenCalled();
  });

  // ── Unit 8 ───────────────────────────────────────────────────────────────
  it("emitTopicUnsubscribed batches one enqueue call with 3 topic-bound jobs", async () => {
    const wfIds = await seedWorkflows("topic_unsubscribed", 3, {
      topicId: TOPIC_ID,
    });

    const result = await emitTopicUnsubscribed({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
      topicId: TOPIC_ID,
      topicName: "Promotions",
    });

    expect(result.workflowsTriggered).toBe(3);
    expect(mockedBatch).toHaveBeenCalledTimes(1);
    expect(mockedSingle).not.toHaveBeenCalled();

    const jobs = mockedBatch.mock.calls[0][0];
    expect(jobs).toHaveLength(3);
    expect(
      jobs
        .map((j) => (j as unknown as { workflowId: string }).workflowId)
        .sort()
    ).toEqual([...wfIds].sort());
  });

  // ── Negative control ───────────────────────────────────────────────────────
  it("does not enqueue when only DIFFERENT-triggerType workflows exist (real filter selects)", async () => {
    // Seed enabled workflows of unrelated trigger types.
    await seedWorkflows("contact_updated", 2);
    await seedWorkflows("topic_subscribed", 2, { topicId: TOPIC_ID });

    const result = await emitContactCreated({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
    });

    expect(result.workflowsTriggered).toBe(0);
    expect(mockedBatch).not.toHaveBeenCalled();
    expect(mockedSingle).not.toHaveBeenCalled();
  });

  it("does not match a non-enabled (draft) workflow of the right triggerType (status filter)", async () => {
    await db.insert(workflow).values(
      workflowRow(fixture.ids, {
        id: `${fixture.ids.org}-wf-disabled`,
        triggerType: "contact_created",
        status: "draft",
      })
    );

    const result = await emitContactCreated({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
    });

    expect(result.workflowsTriggered).toBe(0);
    expect(mockedBatch).not.toHaveBeenCalled();
  });

  it("does not match a workflow in a DIFFERENT org (org scope)", async () => {
    // Seed a matching workflow under the OTHER org.
    await db.insert(workflow).values(
      workflowRow(
        { ...fixture.ids, org: fixture.ids.otherOrg },
        {
          id: `${fixture.ids.otherOrg}-wf-cross`,
          organizationId: fixture.ids.otherOrg,
          triggerType: "contact_created",
        }
      )
    );

    const result = await emitContactCreated({
      contactId: fixture.ids.contact,
      organizationId: fixture.ids.org,
    });

    expect(result.workflowsTriggered).toBe(0);
    expect(mockedBatch).not.toHaveBeenCalled();

    // Cleanup the cross-org workflow (clearWorkflows only targets primary org).
    await db
      .delete(workflow)
      .where(
        and(
          eq(workflow.organizationId, fixture.ids.otherOrg),
          inArray(workflow.id, [`${fixture.ids.otherOrg}-wf-cross`])
        )
      );
  });
});
