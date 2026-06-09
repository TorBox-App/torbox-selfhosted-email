/**
 * Workflow Scheduler — real-DB reconciler staleness tests (Step 6 / Unit 29)
 *
 * Replaces the serialized-WHERE assertion in workflow-scheduler.test.ts with a
 * behavioral test against the real Neon test branch. We seed two enabled,
 * schedule-trigger workflows with different `updatedAt` timestamps (one stale,
 * one fresh), run `reconcileScheduleChains()`, and assert WHICH workflows the
 * reconciler actually processed by inspecting which schedule names
 * `GetScheduleCommand` was constructed for.
 *
 * Why this catches an `lt`→`gt` reversal: the reconciler selects only STALE
 * workflows (`updatedAt < NOW() - INTERVAL '5 minutes'`). With `lt`, only the
 * stale workflow's `GetScheduleCommand` is built. If someone flips it to `gt`,
 * only the FRESH workflow would be selected — the asserted schedule name would
 * change, and this test fails. The serialized-WHERE test cannot tell `lt` from
 * `gt` once the column name is present.
 *
 * Boundary mock: ONLY `@aws-sdk/client-scheduler` (the AWS boundary). The DB is
 * real. `GetScheduleCommand` resolves healthy (no repair) so the run is
 * deterministic.
 */

import { db, eq, workflow } from "@wraps/db";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mockSend = vi.hoisted(() => vi.fn());
// Names that GetScheduleCommand was constructed for — the reconciler builds one
// per workflow the staleness filter selected.
const getScheduleNames = vi.hoisted(() => [] as string[]);

vi.mock("@aws-sdk/client-scheduler", () => ({
  SchedulerClient: class MockSchedulerClient {
    send = mockSend;
  },
  CreateScheduleCommand: class MockCreateScheduleCommand {
    params: unknown;
    constructor(params: { Name?: string }) {
      this.params = params;
    }
  },
  DeleteScheduleCommand: class MockDeleteScheduleCommand {
    params: unknown;
    constructor(params: { Name?: string }) {
      this.params = params;
    }
  },
  GetScheduleCommand: class MockGetScheduleCommand {
    params: unknown;
    constructor(params: { Name?: string }) {
      this.params = params;
      if (params?.Name) {
        getScheduleNames.push(params.Name);
      }
    }
  },
  UpdateScheduleCommand: class MockUpdateScheduleCommand {
    params: unknown;
    constructor(params: { Name?: string }) {
      this.params = params;
    }
  },
}));

import {
  baseOrgIds,
  cleanupBaseOrg,
  clearWorkflowState,
  seedBaseOrg,
  workflowRow,
} from "./fixtures/real-db";

const TEST_PREFIX = "wf-sched-db";
const ids = baseOrgIds(TEST_PREFIX);

// getScheduleName() keys on id.slice(0,8), so the FIRST 8 chars must differ
// between the two workflows for their schedule names to differ. We lead with a
// distinct 8-char token, then namespace with TEST_PREFIX for traceability.
// (clearWorkflowState deletes by org id, so the id text doesn't affect cleanup.)
const STALE_WF_ID = `stale001-${TEST_PREFIX}-workflow`;
const FRESH_WF_ID = `fresh001-${TEST_PREFIX}-workflow`;
const STALE_SCHEDULE_NAME = `wraps-wf-sched-${STALE_WF_ID.slice(0, 8)}`;
const FRESH_SCHEDULE_NAME = `wraps-wf-sched-${FRESH_WF_ID.slice(0, 8)}`;

const TRIGGER_CONFIG = { schedule: "0 9 * * *", timezone: "UTC" };

describe("reconcileScheduleChains — staleness filter direction (real DB, Unit 29)", () => {
  const originalEnv = process.env;

  beforeAll(async () => {
    await seedBaseOrg(TEST_PREFIX);
  });

  beforeEach(async () => {
    await clearWorkflowState(ids.org, ids.otherOrg);
    vi.clearAllMocks();
    getScheduleNames.length = 0;
    process.env = { ...originalEnv };
    // Env-gate the reconciler so the real code path runs (mirrors existing test).
    process.env.SCHEDULER_ROLE_ARN = "arn:aws:iam::role/scheduler";
    process.env.WORKFLOW_QUEUE_ARN = "arn:aws:sqs:us-east-1:queue";
    process.env.SCHEDULER_GROUP_NAME = "wraps-workflows";
    process.env.NODE_ENV = "development";
    // Healthy schedule → no repair, deterministic.
    mockSend.mockResolvedValue({});
  });

  afterAll(async () => {
    process.env = originalEnv;
    await cleanupBaseOrg(TEST_PREFIX);
  });

  it("reconciles only stale schedule-trigger workflows, skipping fresh ones", async () => {
    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60 * 1000);
    const oneMinAgo = new Date(now - 1 * 60 * 1000);

    // STALE: updatedAt = now - 10min → passes lt(updatedAt, NOW() - 5min).
    await db.insert(workflow).values(
      workflowRow(ids, {
        id: STALE_WF_ID,
        name: "Stale Scheduled WF",
        status: "enabled",
        triggerType: "schedule",
        triggerConfig: TRIGGER_CONFIG,
        updatedAt: tenMinAgo,
      })
    );

    // FRESH: updatedAt = now - 1min → fails the staleness filter, must be skipped.
    await db.insert(workflow).values(
      workflowRow(ids, {
        id: FRESH_WF_ID,
        name: "Fresh Scheduled WF",
        status: "enabled",
        triggerType: "schedule",
        triggerConfig: TRIGGER_CONFIG,
        updatedAt: oneMinAgo,
      })
    );

    const { reconcileScheduleChains } = await import(
      "../services/workflow-scheduler"
    );

    const result = await reconcileScheduleChains();

    // Exactly one workflow (the stale one) was checked/healthy.
    expect(result.checked).toBe(1);
    expect(result.repaired).toBe(0);
    expect(result.errors).toBe(0);

    // GetScheduleCommand built ONLY for the stale workflow's schedule name.
    expect(getScheduleNames).toContain(STALE_SCHEDULE_NAME);
    expect(getScheduleNames).not.toContain(FRESH_SCHEDULE_NAME);
    expect(getScheduleNames).toHaveLength(1);
  });

  it("processes a stale workflow that the FRESH-only path would have missed", async () => {
    // Guard against a silent `gt` reversal a different way: with only a stale
    // workflow present, `lt` selects it (checked === 1) while a reversed `gt`
    // would select nothing (checked === 0). The DB row's persisted updatedAt is
    // what the SQL filter evaluates, so this is a true direction check.
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);

    await db.insert(workflow).values(
      workflowRow(ids, {
        id: STALE_WF_ID,
        name: "Stale Only WF",
        status: "enabled",
        triggerType: "schedule",
        triggerConfig: TRIGGER_CONFIG,
        updatedAt: twentyMinAgo,
      })
    );

    const { reconcileScheduleChains } = await import(
      "../services/workflow-scheduler"
    );

    const result = await reconcileScheduleChains();

    expect(result.checked).toBe(1);
    expect(getScheduleNames).toEqual([STALE_SCHEDULE_NAME]);

    // Sanity: the row really persisted with the stale timestamp.
    const [row] = await db
      .select({ updatedAt: workflow.updatedAt })
      .from(workflow)
      .where(eq(workflow.id, STALE_WF_ID));
    expect(row.updatedAt.getTime()).toBeLessThan(Date.now() - 5 * 60 * 1000);
  });
});
