/**
 * Workflow Schedules Integration Tests
 *
 * Runs against REAL SST dev resources:
 * - Real EventBridge Scheduler (create/update/delete real schedules)
 * - Real database
 * - Real API HTTP endpoint from SST outputs
 *
 * Prerequisites:
 * 1. Run `pnpm sst:dev` in another terminal
 * 2. Run `pnpm --filter @wraps/api test:integration`
 */

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DeleteScheduleCommand,
  GetScheduleCommand,
  ResourceNotFoundException,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { fromEnv, fromIni } from "@aws-sdk/credential-providers";
import {
  apiKey,
  db,
  eq,
  member,
  organization,
  user,
  workflow,
} from "@wraps/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// -----------------------------------------------------------------------------
// SST Output Loading
// -----------------------------------------------------------------------------

type SstOutputs = {
  apiUrl: string;
  schedulerGroupName: string;
  schedulerRoleArn: string;
};

function loadSstOutputs(): SstOutputs {
  const outputsPath = resolve(process.cwd(), "../../.sst/outputs.json");

  if (!existsSync(outputsPath)) {
    throw new Error(
      `SST outputs not found at ${outputsPath}. Run "pnpm sst:dev" first.`
    );
  }

  const outputs = JSON.parse(readFileSync(outputsPath, "utf-8"));

  if (!(outputs.apiUrl && outputs.schedulerGroupName)) {
    throw new Error(
      "apiUrl or schedulerGroupName missing from SST outputs. Is SST dev running?"
    );
  }

  return outputs as SstOutputs;
}

const outputs = loadSstOutputs();
const { apiUrl, schedulerGroupName } = outputs;

// -----------------------------------------------------------------------------
// AWS Clients
// -----------------------------------------------------------------------------

const awsProfile = process.env.AWS_PROFILE || "default";
const scheduler = new SchedulerClient({
  region: "us-east-1",
  credentials: async () => {
    try {
      return await fromEnv()();
    } catch {
      return await fromIni({ profile: awsProfile })();
    }
  },
});

// -----------------------------------------------------------------------------
// Test Data
// -----------------------------------------------------------------------------

const TEST_PREFIX = "int-wf-schedules-test";

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Workflow Schedules Integration Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Workflow Schedules Integration Test Org",
  slug: `${TEST_PREFIX}-org`,
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
  name: "Scheduled Integration Workflow",
  status: "enabled" as const,
  triggerType: "schedule" as const,
  triggerConfig: { cronExpression: "0 9 * * *" },
  steps: [],
  transitions: [],
  allowReentry: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
};

// Deterministic schedule name — matches workflow-scheduler.ts `getScheduleName`.
// Used for cleanup; tests assert using the value returned from the API.
const expectedScheduleName = `wraps-wf-sched-${testWorkflow.id.slice(0, 8)}`;

// -----------------------------------------------------------------------------
// API Key Setup
// -----------------------------------------------------------------------------

const rawApiKey = `wraps_${randomBytes(24).toString("hex")}`;
const apiKeyHash = createHash("sha256").update(rawApiKey).digest("hex");
const testApiKey = {
  id: `${TEST_PREFIX}-key-1`,
  organizationId: testOrg.id,
  name: "Integration Test Key",
  keyHash: apiKeyHash,
  prefix: rawApiKey.slice(0, 10),
  permissions: [],
  createdBy: testUser.id,
  createdAt: new Date(),
};

// -----------------------------------------------------------------------------
// HTTP Helpers
// -----------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${rawApiKey}`,
  };
}

async function postEnable(
  workflowId: string,
  body: { cronExpression: string; timezone?: string }
) {
  return fetch(`${apiUrl}/v1/workflow-schedules/${workflowId}/enable`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

async function postDisable(workflowId: string) {
  return fetch(`${apiUrl}/v1/workflow-schedules/${workflowId}/disable`, {
    method: "POST",
    headers: authHeaders(),
  });
}

async function putUpdate(
  workflowId: string,
  body: { cronExpression: string; timezone?: string }
) {
  return fetch(`${apiUrl}/v1/workflow-schedules/${workflowId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

async function getScheduleSafe(name: string) {
  try {
    return await scheduler.send(
      new GetScheduleCommand({ Name: name, GroupName: schedulerGroupName })
    );
  } catch (error) {
    if (
      error instanceof ResourceNotFoundException ||
      (error instanceof Error && error.name === "ResourceNotFoundException")
    ) {
      return null;
    }
    throw error;
  }
}

async function deleteScheduleSafe(name: string) {
  try {
    await scheduler.send(
      new DeleteScheduleCommand({ Name: name, GroupName: schedulerGroupName })
    );
  } catch {
    // ignore — may already be gone
  }
}

// -----------------------------------------------------------------------------
// Setup / Teardown
// -----------------------------------------------------------------------------

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
    .insert(member)
    .values(testMember)
    .onConflictDoUpdate({ target: member.id, set: { role: testMember.role } });
  await db
    .insert(workflow)
    .values(testWorkflow as typeof workflow.$inferInsert)
    .onConflictDoUpdate({
      target: workflow.id,
      set: { updatedAt: new Date() },
    });
  await db
    .insert(apiKey)
    .values(testApiKey)
    .onConflictDoUpdate({
      target: apiKey.id,
      set: { keyHash: testApiKey.keyHash },
    });

  // Defensive: ensure no leftover schedule from a prior failed run.
  await deleteScheduleSafe(expectedScheduleName);
});

// Clean slate after every test: a failed test must not leak a schedule that
// makes the next test's enable hit a "schedule already exists" 500 (cascade).
afterEach(async () => {
  await deleteScheduleSafe(expectedScheduleName);
});

afterAll(async () => {
  await deleteScheduleSafe(expectedScheduleName);

  await db.delete(workflow).where(eq(workflow.id, testWorkflow.id));
  await db.delete(apiKey).where(eq(apiKey.id, testApiKey.id));
  await db.delete(member).where(eq(member.id, testMember.id));
  await db.delete(organization).where(eq(organization.id, testOrg.id));
  await db.delete(user).where(eq(user.id, testUser.id));
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("Workflow Schedules Integration", () => {
  it("enable creates a real EventBridge schedule", async () => {
    const res = await postEnable(testWorkflow.id, {
      cronExpression: "0 9 * * *",
      timezone: "America/New_York",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      scheduleName?: string;
    };
    expect(body.success).toBe(true);
    expect(body.scheduleName).toBeTruthy();

    const scheduleName = body.scheduleName as string;

    const schedule = await getScheduleSafe(scheduleName);
    expect(schedule).not.toBeNull();
    // One-time at() schedule computed from cron — format "at(YYYY-MM-DDTHH:MM:SS)"
    expect(schedule?.ScheduleExpression).toMatch(
      /^at\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\)$/
    );
    // Scheduler service hardcodes ScheduleExpressionTimezone to UTC on the
    // emitted one-time schedule (input timezone only steers nextRun math).
    expect(schedule?.ScheduleExpressionTimezone).toBe("UTC");

    // Cleanup
    await deleteScheduleSafe(scheduleName);
  });

  it("update replaces the schedule with a new expression", async () => {
    // Seed: enable with one cron
    const enableRes = await postEnable(testWorkflow.id, {
      cronExpression: "0 9 * * *",
      timezone: "UTC",
    });
    expect(enableRes.status).toBe(200);
    const enableBody = (await enableRes.json()) as {
      success: boolean;
      scheduleName?: string;
    };
    const oldScheduleName = enableBody.scheduleName as string;
    expect(oldScheduleName).toBeTruthy();

    const oldSchedule = await getScheduleSafe(oldScheduleName);
    expect(oldSchedule).not.toBeNull();
    const oldExpression = oldSchedule?.ScheduleExpression;

    // Update with a different cron — scheduler uses deterministic name per
    // workflow, so the name is reused. Route deletes then re-creates; assert
    // presence of a schedule with a new expression rather than a new name.
    const updateRes = await putUpdate(testWorkflow.id, {
      cronExpression: "0 12 * * *",
      timezone: "UTC",
    });

    expect(updateRes.status).toBe(200);
    const updateBody = (await updateRes.json()) as {
      success: boolean;
      scheduleName?: string;
    };
    expect(updateBody.success).toBe(true);
    expect(updateBody.scheduleName).toBeTruthy();

    const newScheduleName = updateBody.scheduleName as string;
    const newSchedule = await getScheduleSafe(newScheduleName);
    expect(newSchedule).not.toBeNull();
    expect(newSchedule?.ScheduleExpression).toMatch(
      /^at\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\)$/
    );

    // If the scheduler reuses the name, the expression must have changed.
    // If a new name was generated, the old schedule must be gone.
    if (newScheduleName === oldScheduleName) {
      expect(newSchedule?.ScheduleExpression).not.toBe(oldExpression);
    } else {
      const staleOld = await getScheduleSafe(oldScheduleName);
      expect(staleOld).toBeNull();
    }

    await deleteScheduleSafe(newScheduleName);
    if (newScheduleName !== oldScheduleName) {
      await deleteScheduleSafe(oldScheduleName);
    }
  });

  it("disable removes the schedule", async () => {
    // Seed: enable
    const enableRes = await postEnable(testWorkflow.id, {
      cronExpression: "0 9 * * *",
      timezone: "UTC",
    });
    expect(enableRes.status).toBe(200);
    const enableBody = (await enableRes.json()) as {
      success: boolean;
      scheduleName?: string;
    };
    const scheduleName = enableBody.scheduleName as string;
    expect(scheduleName).toBeTruthy();

    const created = await getScheduleSafe(scheduleName);
    expect(created).not.toBeNull();

    const disableRes = await postDisable(testWorkflow.id);
    expect(disableRes.status).toBe(200);
    const disableBody = (await disableRes.json()) as { success: boolean };
    expect(disableBody.success).toBe(true);

    const afterDisable = await getScheduleSafe(scheduleName);
    expect(afterDisable).toBeNull();
  });
});
