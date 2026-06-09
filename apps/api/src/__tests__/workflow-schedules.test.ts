/**
 * Workflow Schedule Route Tests
 *
 * Integration tests for /v1/workflow-schedules endpoints.
 * Tests workflow ownership verification against real DB and
 * interaction with the mocked workflow-scheduler service.
 */

import { db, eq, member, organization, user, workflow } from "@wraps/db";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mockUpdateWorkflowSchedule = vi.hoisted(() => vi.fn());

vi.mock("../(ee)/services/workflow-scheduler", () => ({
  createNextWorkflowSchedule: vi.fn(),
  deleteWorkflowSchedule: vi.fn(),
  updateWorkflowSchedule: mockUpdateWorkflowSchedule,
}));

vi.mock("../lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { Elysia } from "elysia";
import { workflowScheduleRoutes } from "../(ee)/routes/workflow-schedules";
import {
  createNextWorkflowSchedule,
  deleteWorkflowSchedule,
  updateWorkflowSchedule,
} from "../(ee)/services/workflow-scheduler";
import type { AuthContext } from "../middleware/auth";

const TEST_PREFIX = "wf-schedules-test";

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Schedule Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Schedule Test Org",
  slug: `${TEST_PREFIX}-org`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const otherOrg = {
  id: `${TEST_PREFIX}-org-2`,
  name: "Other Schedule Test Org",
  slug: `${TEST_PREFIX}-org-2`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: `${TEST_PREFIX}-member-1`,
  organizationId: testOrg.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

const testWorkflow = {
  id: `${TEST_PREFIX}-workflow-1`,
  organizationId: testOrg.id,
  name: "Scheduled Workflow",
  status: "enabled",
  triggerType: "schedule",
  triggerConfig: { cronExpression: "0 9 * * *" },
  steps: [],
  transitions: [],
  allowReentry: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
};

const otherOrgWorkflow = {
  id: `${TEST_PREFIX}-workflow-other`,
  organizationId: otherOrg.id,
  name: "Other Org Workflow",
  status: "enabled",
  triggerType: "schedule",
  triggerConfig: { cronExpression: "0 9 * * *" },
  steps: [],
  transitions: [],
  allowReentry: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
};

const mockAuth: AuthContext = {
  apiKeyId: null,
  organizationId: testOrg.id,
  userId: testUser.id,
  planId: "growth",
};

function createTestApp() {
  return new Elysia()
    .derive(() => ({ auth: mockAuth }))
    .use(workflowScheduleRoutes);
}

function postEnable(
  app: ReturnType<typeof createTestApp>,
  workflowId: string,
  body: Record<string, unknown>
) {
  return app.handle(
    new Request(`http://localhost/v1/workflow-schedules/${workflowId}/enable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function postDisable(
  app: ReturnType<typeof createTestApp>,
  workflowId: string
) {
  return app.handle(
    new Request(
      `http://localhost/v1/workflow-schedules/${workflowId}/disable`,
      {
        method: "POST",
      }
    )
  );
}

function putUpdate(
  app: ReturnType<typeof createTestApp>,
  workflowId: string,
  body: Record<string, unknown>
) {
  return app.handle(
    new Request(`http://localhost/v1/workflow-schedules/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("Workflow schedule routes", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    await db
      .insert(user)
      .values(testUser)
      .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
    await db
      .insert(organization)
      .values(testOrg)
      .onConflictDoUpdate({
        target: organization.id,
        set: { name: testOrg.name },
      });
    await db
      .insert(organization)
      .values(otherOrg)
      .onConflictDoUpdate({
        target: organization.id,
        set: { name: otherOrg.name },
      });
    await db
      .insert(member)
      .values(testMember)
      .onConflictDoUpdate({
        target: member.id,
        set: { role: testMember.role },
      });
    await db
      .insert(workflow)
      .values(testWorkflow as typeof workflow.$inferInsert)
      .onConflictDoUpdate({
        target: workflow.id,
        set: { updatedAt: new Date() },
      });
    await db
      .insert(workflow)
      .values(otherOrgWorkflow as typeof workflow.$inferInsert)
      .onConflictDoUpdate({
        target: workflow.id,
        set: { updatedAt: new Date() },
      });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  afterAll(async () => {
    await db.delete(workflow).where(eq(workflow.id, testWorkflow.id));
    await db.delete(workflow).where(eq(workflow.id, otherOrgWorkflow.id));
    await db.delete(member).where(eq(member.id, testMember.id));
    await db.delete(organization).where(eq(organization.id, testOrg.id));
    await db.delete(organization).where(eq(organization.id, otherOrg.id));
    await db.delete(user).where(eq(user.id, testUser.id));
  });

  it("enable creates next schedule and returns scheduleName", async () => {
    (createNextWorkflowSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(
      "wraps-wf-schedule-abc"
    );

    const res = await postEnable(app, testWorkflow.id, {
      cronExpression: "0 9 * * *",
      timezone: "America/New_York",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.scheduleName).toBe("wraps-wf-schedule-abc");

    expect(createNextWorkflowSchedule).toHaveBeenCalledWith({
      workflowId: testWorkflow.id,
      organizationId: testOrg.id,
      cronExpression: "0 9 * * *",
      timezone: "America/New_York",
    });
  });

  it("disable deletes the workflow schedule", async () => {
    (deleteWorkflowSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );

    const res = await postDisable(app, testWorkflow.id);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(deleteWorkflowSchedule).toHaveBeenCalledWith(testWorkflow.id);
  });

  it("update atomically replaces the schedule via updateWorkflowSchedule", async () => {
    mockUpdateWorkflowSchedule.mockResolvedValue("wraps-wf-schedule-new");

    const res = await putUpdate(app, testWorkflow.id, {
      cronExpression: "0 12 * * *",
      timezone: "UTC",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.scheduleName).toBe("wraps-wf-schedule-new");

    expect(updateWorkflowSchedule).toHaveBeenCalledWith({
      workflowId: testWorkflow.id,
      organizationId: testOrg.id,
      cronExpression: "0 12 * * *",
      timezone: "UTC",
    });
    // Must NOT use delete+create (no gap)
    expect(deleteWorkflowSchedule).not.toHaveBeenCalled();
    expect(createNextWorkflowSchedule).not.toHaveBeenCalled();
  });

  // Unit 28: schedule update uses UpdateScheduleCommand — no delete+create gap
  it("update sends UpdateScheduleCommand with new cron — no DeleteScheduleCommand emitted (Unit 28)", async () => {
    mockUpdateWorkflowSchedule.mockResolvedValue("wraps-wf-schedule-updated");

    const res = await putUpdate(app, testWorkflow.id, {
      cronExpression: "0 15 * * *",
      timezone: "Europe/London",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.scheduleName).toBe("wraps-wf-schedule-updated");

    // Must use atomic update — not delete+create
    expect(updateWorkflowSchedule).toHaveBeenCalledWith({
      workflowId: testWorkflow.id,
      organizationId: testOrg.id,
      cronExpression: "0 15 * * *",
      timezone: "Europe/London",
    });

    // Must NOT call deleteWorkflowSchedule (no gap window)
    expect(deleteWorkflowSchedule).not.toHaveBeenCalled();
    // Must NOT call createNextWorkflowSchedule
    expect(createNextWorkflowSchedule).not.toHaveBeenCalled();
  });

  it("returns 404 when workflow belongs to a different org", async () => {
    const res = await postEnable(app, otherOrgWorkflow.id, {
      cronExpression: "0 9 * * *",
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("not found");

    // Scheduler should not be called since ownership check failed
    expect(createNextWorkflowSchedule).not.toHaveBeenCalled();
  });

  it("returns 500 with error message when scheduler service throws", async () => {
    (createNextWorkflowSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("EventBridge limit exceeded")
    );

    const res = await postEnable(app, testWorkflow.id, {
      cronExpression: "0 9 * * *",
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("EventBridge limit exceeded");
  });
});
