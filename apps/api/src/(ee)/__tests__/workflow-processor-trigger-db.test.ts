/**
 * Workflow Processor — Schedule Trigger Fan-out (REAL DB)
 *
 * Behavioral, real-Neon counterpart to the contact fan-out path of
 * `processScheduleTrigger` (see workflow-processor.ts). Seeds real contacts /
 * segments / workflow rows, drives the SQS handler with a `schedule-trigger`
 * job, and asserts BOTH the persisted workflow state AND the single batch
 * enqueue boundary (SQS — the one legitimately-mocked seam).
 *
 * Mocked seams (true boundaries only):
 *   - ../../services/workflow-queue          (SQS SendMessageBatch)
 *   - ../services/workflow-scheduler         (EventBridge Scheduler chain)
 * @wraps/db is the REAL database. Never mocked here.
 *
 * NOTE — the segment-scoped fan-out sub-case is SKIPPED (not faked): the real
 * DB surfaced a product defect in `contactIdsMatchingCondition`'s `= ANY(array)`
 * binding under node-postgres. See the skipped test for the full diagnosis.
 *
 * NOTE — Unit 9 (the `log.warn` emitted when the contact list is truncated at
 * exactly MAX_CONTACTS_PER_TRIGGER = 1000) STAYS MOCKED by design in
 * `workflow-processor-trigger.test.ts`. Seeding 1000 contacts to assert a log
 * boundary is wasteful; the mocked assertion is the right tool there.
 */

import { contact, db, eq, segment, workflow } from "@wraps/db";
import { inArray } from "drizzle-orm";
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
  workflowRow,
} from "./fixtures/real-db";
import { makeSQSEvent } from "./fixtures/workflow-fixtures";

const TEST_PREFIX = "wf-proc-trig-db";

// ─────────────────────────────────────────────────────────────────────────────
// Boundary mocks (SQS + EventBridge). Real DB everywhere else.
// ─────────────────────────────────────────────────────────────────────────────

const mockEnqueueWorkflowStep = vi.fn().mockResolvedValue(undefined);
const mockEnqueueWorkflowStepBatch = vi.fn().mockResolvedValue(undefined);

vi.mock("../../services/workflow-queue", () => ({
  enqueueWorkflowStep: mockEnqueueWorkflowStep,
  enqueueWorkflowStepBatch: mockEnqueueWorkflowStepBatch,
  scheduleWaitTimeout: vi.fn().mockResolvedValue("sched-wait"),
  scheduleWorkflowStep: vi.fn().mockResolvedValue("sched-step"),
  deleteScheduledStep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/workflow-scheduler", () => ({
  createNextWorkflowSchedule: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  flushLogger: vi.fn().mockResolvedValue(undefined),
}));

// Import the handler AFTER mocks are registered.
const { handler } = await import("../workers/workflow-processor");

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

let fixture: BaseOrgFixture;

const WORKFLOW_ID = `${TEST_PREFIX}-org-schedule-wf`;
const SEGMENT_ID = `${TEST_PREFIX}-segment-1`;

// Three extra contacts seeded directly (beyond the base-org contact). Two carry
// `properties.tier = "gold"` so the segment case can target a known subset.
const extraContactIds = [
  `${TEST_PREFIX}-c-a`,
  `${TEST_PREFIX}-c-b`,
  `${TEST_PREFIX}-c-c`,
];

function scheduleJob() {
  return {
    type: "schedule-trigger" as const,
    workflowId: WORKFLOW_ID,
    organizationId: fixture.ids.org,
  };
}

async function seedScheduleWorkflow(
  overrides: Partial<typeof workflow.$inferInsert> = {}
) {
  await db
    .insert(workflow)
    .values(
      workflowRow(fixture.ids, {
        id: WORKFLOW_ID,
        name: "Scheduled Fan-out",
        status: "enabled",
        triggerType: "schedule",
        triggerConfig: { schedule: "0 9 * * *" },
        lastTriggeredAt: null,
        ...overrides,
      })
    )
    .onConflictDoUpdate({
      target: workflow.id,
      set: { updatedAt: new Date() },
    });
}

async function seedExtraContacts() {
  const now = new Date();
  await db
    .insert(contact)
    .values([
      {
        id: extraContactIds[0],
        organizationId: fixture.ids.org,
        email: `${TEST_PREFIX}-a@example.com`,
        emailHash: `${TEST_PREFIX}-hash-a`,
        emailStatus: "active",
        status: "active",
        properties: { tier: "gold" },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: extraContactIds[1],
        organizationId: fixture.ids.org,
        email: `${TEST_PREFIX}-b@example.com`,
        emailHash: `${TEST_PREFIX}-hash-b`,
        emailStatus: "active",
        status: "active",
        properties: { tier: "gold" },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: extraContactIds[2],
        organizationId: fixture.ids.org,
        email: `${TEST_PREFIX}-c@example.com`,
        emailHash: `${TEST_PREFIX}-hash-c`,
        emailStatus: "active",
        status: "active",
        properties: { tier: "silver" },
        createdAt: now,
        updatedAt: now,
      },
    ] as (typeof contact.$inferInsert)[])
    .onConflictDoNothing();
}

/** Remove the base-org contact so fan-out counts are deterministic (3 extras). */
async function removeBaseContact() {
  await db.delete(contact).where(eq(contact.id, fixture.ids.contact));
}

describe("processScheduleTrigger — contact fan-out (real DB)", () => {
  beforeAll(async () => {
    fixture = await seedBaseOrg(TEST_PREFIX);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearWorkflowState(fixture.ids.org);
    await db.delete(segment).where(eq(segment.id, SEGMENT_ID));
    await db.delete(contact).where(inArray(contact.id, extraContactIds));
  });

  afterAll(async () => {
    await db.delete(segment).where(eq(segment.id, SEGMENT_ID));
    await db.delete(contact).where(inArray(contact.id, extraContactIds));
    await cleanupBaseOrg(TEST_PREFIX);
  });

  it("fans out one trigger job per org contact in a SINGLE batch call", async () => {
    await removeBaseContact();
    await seedExtraContacts();
    await seedScheduleWorkflow();

    await handler(makeSQSEvent(scheduleJob()));

    // Exactly ONE batch call — collect-then-batch, not per-contact loop.
    expect(mockEnqueueWorkflowStepBatch).toHaveBeenCalledTimes(1);
    // The singular enqueue must NOT be used to fan out contacts.
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();

    const jobs = mockEnqueueWorkflowStepBatch.mock.calls[0][0] as Array<{
      type: string;
      workflowId: string;
      organizationId: string;
      contactId: string;
    }>;

    expect(jobs).toHaveLength(3);
    for (const job of jobs) {
      expect(job.type).toBe("trigger");
      expect(job.workflowId).toBe(WORKFLOW_ID);
      expect(job.organizationId).toBe(fixture.ids.org);
    }

    expect(jobs.map((j) => j.contactId).sort()).toEqual(
      [...extraContactIds].sort()
    );
  });

  // Exercises the real segment path: `processScheduleTrigger` →
  // `getSegmentContacts` → `contactIdsMatchingCondition`
  // (packages/db/segment-evaluator.ts). This previously failed against a real DB
  // because the evaluator built `sql\`${contact.id} = ANY(${contactIds})\``,
  // which node-postgres expands to `ANY(($1, $2))` → Postgres SQLSTATE 42809.
  // Fixed by switching to Drizzle `inArray(contact.id, contactIds)`.
  it("scopes fan-out to a segment when triggerConfig.segmentId is set", async () => {
    await removeBaseContact();
    await seedExtraContacts();

    // Segment matching contacts with properties.tier = "gold" (2 of the 3).
    await db.insert(segment).values({
      id: SEGMENT_ID,
      organizationId: fixture.ids.org,
      name: "Gold tier",
      condition: {
        logic: "AND",
        groups: [
          {
            filters: [
              {
                field: "properties.tier",
                operator: "equals",
                value: "gold",
              },
            ],
          },
        ],
      },
      createdBy: fixture.ids.user,
    } as typeof segment.$inferInsert);

    await seedScheduleWorkflow({
      triggerConfig: { schedule: "0 9 * * *", segmentId: SEGMENT_ID },
    });

    await handler(makeSQSEvent(scheduleJob()));

    expect(mockEnqueueWorkflowStepBatch).toHaveBeenCalledTimes(1);
    expect(mockEnqueueWorkflowStep).not.toHaveBeenCalled();

    const jobs = mockEnqueueWorkflowStepBatch.mock.calls[0][0] as Array<{
      contactId: string;
    }>;

    // Only the two gold-tier contacts fan out — not the silver one.
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.contactId).sort()).toEqual(
      [extraContactIds[0], extraContactIds[1]].sort()
    );
  });

  it("persists lastTriggeredAt after the trigger fans out", async () => {
    await removeBaseContact();
    await seedExtraContacts();
    await seedScheduleWorkflow({ lastTriggeredAt: null });

    const before = await db
      .select({ lastTriggeredAt: workflow.lastTriggeredAt })
      .from(workflow)
      .where(eq(workflow.id, WORKFLOW_ID));
    expect(before[0].lastTriggeredAt).toBeNull();

    await handler(makeSQSEvent(scheduleJob()));

    const after = await db
      .select({ lastTriggeredAt: workflow.lastTriggeredAt })
      .from(workflow)
      .where(eq(workflow.id, WORKFLOW_ID));
    expect(after[0].lastTriggeredAt).not.toBeNull();
    expect(after[0].lastTriggeredAt).toBeInstanceOf(Date);
  });
});
