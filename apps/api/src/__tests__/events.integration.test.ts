/**
 * Events API Integration Tests
 *
 * Runs against REAL SST dev resources:
 * - Real database (apps/web/.env.local)
 * - Real SQS workflow queue
 * - Real workflow-processor Lambda
 * - Real API Gateway (SST dev-deployed)
 *
 * Prerequisites:
 * 1. Run `pnpm sst:dev` in another terminal
 * 2. Run `pnpm --filter @wraps/api test:integration`
 *
 * Validates the complete ingestion flow:
 * POST /v1/events (HTTP)
 *   -> API Lambda (auth + contact resolution + workflow match)
 *   -> SQS workflow queue (enqueueWorkflowStep)
 *   -> Workflow processor Lambda (runs steps)
 *   -> DB (workflowExecution reaches "completed")
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { fromEnv, fromIni } from "@aws-sdk/credential-providers";
import {
  apiKey,
  contact,
  contactEvent,
  db,
  member,
  organization,
  user,
  type WorkflowStep,
  type WorkflowTransition,
  workflow,
  workflowExecution,
  workflowStepExecution,
} from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { WorkflowJob } from "../services/workflow-queue";

// -----------------------------------------------------------------------------
// SST Output Loading (inlined copy — helpers in workflow.integration.test.ts
// are not exported)
// -----------------------------------------------------------------------------

type SstOutputs = {
  workflowQueueUrl: string;
  workflowDlqUrl: string;
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

  if (!outputs.workflowQueueUrl) {
    throw new Error(
      "workflowQueueUrl not found in SST outputs. Is SST dev running?"
    );
  }
  if (!outputs.apiUrl) {
    throw new Error("apiUrl not found in SST outputs. Is SST dev running?");
  }

  return outputs as SstOutputs;
}

// -----------------------------------------------------------------------------
// SQS client (inlined copy — see comment above)
// -----------------------------------------------------------------------------

const awsProfile = process.env.AWS_PROFILE || "default";
const sqs = new SQSClient({
  region: "us-east-1",
  credentials: async () => {
    try {
      return await fromEnv()();
    } catch {
      return await fromIni({ profile: awsProfile })();
    }
  },
});

async function sendWorkflowJob(
  queueUrl: string,
  job: WorkflowJob
): Promise<void> {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job),
    })
  );
}

/**
 * Poll workflowExecution row by (workflowId, contactId) for a target status.
 * Inlined copy — the helper in workflow.integration.test.ts keys on
 * executionId, but here we don't know the executionId up front since the API
 * is what creates the execution via SQS trigger.
 */
async function waitForExecutionStatus(
  workflowId: string,
  contactId: string,
  expectedStatus: string | string[],
  timeoutMs = 45_000,
  pollIntervalMs = 500
): Promise<typeof workflowExecution.$inferSelect | null> {
  const statuses = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const [execution] = await db
      .select()
      .from(workflowExecution)
      .where(
        and(
          eq(workflowExecution.workflowId, workflowId),
          eq(workflowExecution.contactId, contactId)
        )
      )
      .orderBy(workflowExecution.createdAt)
      .limit(1);

    if (execution && statuses.includes(execution.status)) {
      return execution;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const [finalExecution] = await db
    .select()
    .from(workflowExecution)
    .where(
      and(
        eq(workflowExecution.workflowId, workflowId),
        eq(workflowExecution.contactId, contactId)
      )
    )
    .orderBy(workflowExecution.createdAt)
    .limit(1);
  return finalExecution ?? null;
}

// -----------------------------------------------------------------------------
// Auth — seed a real api_key row; authenticate HTTP calls via
// `Authorization: Bearer wraps_<key>` (see apps/api/src/middleware/auth.ts).
// -----------------------------------------------------------------------------

const TEST_PREFIX = "int-events-test";
const RAW_API_KEY = `wraps_live_${TEST_PREFIX}_key`;

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Events Integration Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Events Integration Test Org",
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

const testApiKey = {
  id: `${TEST_PREFIX}-apikey-1`,
  organizationId: testOrg.id,
  name: "Events Integration Test Key",
  keyHash: hashKey(RAW_API_KEY),
  prefix: "wraps_live",
  permissions: [],
  expiresAt: null,
  createdBy: testUser.id,
  createdAt: new Date(),
};

const testContact = {
  id: `${TEST_PREFIX}-contact-1`,
  organizationId: testOrg.id,
  email: `${TEST_PREFIX}-contact@example.com`,
  emailHash: `${TEST_PREFIX}-hash-1`,
  firstName: "Integration",
  lastName: "Test",
  emailStatus: "active" as const,
  status: "active" as const,
  properties: { plan: "pro" as string | number, score: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Workflows: created per-test via helpers below with unique IDs
function createEventTriggerUpdateWorkflow(eventName: string) {
  const triggerId = "trigger-1";
  const updateId = "update-1";
  const exitId = "exit-1";

  const steps: WorkflowStep[] = [
    {
      id: triggerId,
      type: "trigger",
      name: "Trigger",
      position: { x: 0, y: 0 },
      config: { type: "trigger", triggerType: "event", eventName },
    },
    {
      id: updateId,
      type: "update_contact",
      name: "Update Contact",
      position: { x: 0, y: 100 },
      config: {
        type: "update_contact",
        updates: [
          { field: "workflow_ran", operation: "set", value: "true" },
          { field: "score", operation: "increment", value: 10 },
        ],
      },
    },
    {
      id: exitId,
      type: "exit",
      name: "Exit",
      position: { x: 0, y: 200 },
      config: { type: "exit" },
    },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: updateId },
    { id: "t2", fromStepId: updateId, toStepId: exitId },
  ];

  return {
    id: `${TEST_PREFIX}-wf-trigger-${eventName}-${Date.now()}`,
    organizationId: testOrg.id,
    name: `Event Trigger Flow (${eventName})`,
    status: "enabled" as const,
    triggerType: "event" as const,
    triggerConfig: { eventName },
    steps,
    transitions,
    allowReentry: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: testUser.id,
  };
}

function createWaitForEventWorkflow(eventName: string) {
  const triggerId = "trigger-1";
  const waitId = "wait-1";
  const exitYesId = "exit-yes";
  const exitTimeoutId = "exit-timeout";

  const steps: WorkflowStep[] = [
    {
      id: triggerId,
      type: "trigger",
      name: "Trigger",
      position: { x: 0, y: 0 },
      config: { type: "trigger", triggerType: "api" },
    },
    {
      id: waitId,
      type: "wait_for_event",
      name: "Wait for Event",
      position: { x: 0, y: 100 },
      config: {
        type: "wait_for_event",
        eventName,
        timeoutSeconds: 86_400,
      },
    },
    {
      id: exitYesId,
      type: "exit",
      name: "Event Received",
      position: { x: -100, y: 200 },
      config: { type: "exit" },
    },
    {
      id: exitTimeoutId,
      type: "exit",
      name: "Timeout",
      position: { x: 100, y: 200 },
      config: { type: "exit" },
    },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: waitId },
    {
      id: "t2",
      fromStepId: waitId,
      toStepId: exitYesId,
      condition: { branch: "yes" },
    },
    {
      id: "t3",
      fromStepId: waitId,
      toStepId: exitTimeoutId,
      condition: { branch: "timeout" },
    },
  ];

  return {
    id: `${TEST_PREFIX}-wf-wait-${eventName}-${Date.now()}`,
    organizationId: testOrg.id,
    name: `Wait-for-event Flow (${eventName})`,
    status: "enabled" as const,
    triggerType: "api" as const,
    triggerConfig: {},
    steps,
    transitions,
    allowReentry: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: testUser.id,
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe.skipIf(!existsSync(resolve(process.cwd(), "../../.sst/outputs.json")))(
  "Events API Integration",
  () => {
    let sstOutputs: SstOutputs;
    const createdWorkflowIds: string[] = [];

    async function postEvent(body: Record<string, unknown>): Promise<Response> {
      return fetch(`${sstOutputs.apiUrl}/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RAW_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
    }

    beforeAll(async () => {
      sstOutputs = loadSstOutputs();

      await db
        .insert(user)
        .values(testUser)
        .onConflictDoUpdate({
          target: user.id,
          set: { updatedAt: new Date() },
        });
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
        .onConflictDoUpdate({
          target: member.id,
          set: { role: testMember.role },
        });
      await db
        .insert(apiKey)
        .values(testApiKey)
        .onConflictDoUpdate({
          target: apiKey.id,
          set: { keyHash: testApiKey.keyHash, expiresAt: null },
        });
      await db
        .insert(contact)
        .values(testContact)
        .onConflictDoUpdate({
          target: contact.id,
          set: {
            updatedAt: new Date(),
            properties: testContact.properties,
          },
        });
    });

    beforeEach(async () => {
      // Reset per-test state: remove events, executions, auto-created contacts.
      await db
        .delete(contactEvent)
        .where(eq(contactEvent.organizationId, testOrg.id));

      const executions = await db
        .select({ id: workflowExecution.id })
        .from(workflowExecution)
        .where(eq(workflowExecution.organizationId, testOrg.id));
      for (const exec of executions) {
        await db
          .delete(workflowStepExecution)
          .where(eq(workflowStepExecution.executionId, exec.id));
      }
      await db
        .delete(workflowExecution)
        .where(eq(workflowExecution.organizationId, testOrg.id));

      // Reset seeded contact properties
      await db
        .update(contact)
        .set({
          properties: testContact.properties,
          updatedAt: new Date(),
        })
        .where(eq(contact.id, testContact.id));
    });

    afterAll(async () => {
      // FK-safe cleanup order:
      // contactEvent -> workflowStepExecution -> workflowExecution ->
      // workflow -> contact -> apiKey -> member -> organization -> user

      await db
        .delete(contactEvent)
        .where(eq(contactEvent.organizationId, testOrg.id));

      const executions = await db
        .select({ id: workflowExecution.id })
        .from(workflowExecution)
        .where(eq(workflowExecution.organizationId, testOrg.id));
      for (const exec of executions) {
        await db
          .delete(workflowStepExecution)
          .where(eq(workflowStepExecution.executionId, exec.id));
      }
      await db
        .delete(workflowExecution)
        .where(eq(workflowExecution.organizationId, testOrg.id));

      for (const workflowId of createdWorkflowIds) {
        await db.delete(workflow).where(eq(workflow.id, workflowId));
      }

      await db.delete(contact).where(eq(contact.organizationId, testOrg.id));
      await db.delete(apiKey).where(eq(apiKey.id, testApiKey.id));
      await db.delete(member).where(eq(member.id, testMember.id));
      await db.delete(organization).where(eq(organization.id, testOrg.id));
      await db.delete(user).where(eq(user.id, testUser.id));
    });

    describe("POST /v1/events", () => {
      it(
        "triggers workflow and runs it to completion via real SQS + Lambda",
        { timeout: 60_000 },
        async () => {
          const eventName = "purchase.completed";
          const wf = createEventTriggerUpdateWorkflow(eventName);
          await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
          createdWorkflowIds.push(wf.id);

          const res = await postEvent({
            name: eventName,
            contactId: testContact.id,
            properties: { amount: 49 },
          });

          expect(res.status).toBe(200);
          const body = await res.json();
          expect(body.success).toBe(true);
          expect(body.workflowsTriggered).toBe(1);

          // Event should be persisted synchronously
          const events = await db
            .select()
            .from(contactEvent)
            .where(eq(contactEvent.organizationId, testOrg.id));
          expect(events).toHaveLength(1);
          expect(events[0].eventName).toBe(eventName);
          expect(events[0].eventData).toEqual({ amount: 49 });

          // Wait for the real workflow-processor Lambda to pick up the SQS
          // message and run trigger -> update_contact -> exit.
          const execution = await waitForExecutionStatus(
            wf.id,
            testContact.id,
            ["completed", "failed"],
            45_000
          );

          if (execution?.status === "failed") {
            // Surface the real error from the Lambda for easier debugging.
            // biome-ignore lint/suspicious/noConsole: test diagnostic
            console.error("Workflow execution failed:", {
              error: execution.error,
              errorStepId: execution.errorStepId,
            });
          }

          expect(execution?.status).toBe("completed");
          expect(execution?.completedAt).not.toBeNull();

          // update_contact step should have run against the real DB
          const [updatedContact] = await db
            .select()
            .from(contact)
            .where(eq(contact.id, testContact.id));
          const props = updatedContact.properties as Record<string, unknown>;
          expect(props.workflow_ran).toBe("true");
          expect(props.score).toBe(10);
        }
      );

      it(
        "createIfMissing=true creates contact and triggers workflow",
        { timeout: 60_000 },
        async () => {
          const eventName = "signup.completed";
          const newEmail = `${TEST_PREFIX}-created@example.com`;

          const wf = createEventTriggerUpdateWorkflow(eventName);
          await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
          createdWorkflowIds.push(wf.id);

          // Precondition: contact doesn't exist yet
          const [preexisting] = await db
            .select()
            .from(contact)
            .where(
              and(
                eq(contact.organizationId, testOrg.id),
                eq(contact.email, newEmail)
              )
            );
          expect(preexisting).toBeUndefined();

          const res = await postEvent({
            name: eventName,
            contactEmail: newEmail,
            contactName: "New Person",
            createIfMissing: true,
          });

          expect(res.status).toBe(200);
          const body = await res.json();
          expect(body.success).toBe(true);
          expect(body.contactCreated).toBe(true);
          expect(body.workflowsTriggered).toBe(1);

          // Contact should exist in the real DB
          const [created] = await db
            .select()
            .from(contact)
            .where(
              and(
                eq(contact.organizationId, testOrg.id),
                eq(contact.email, newEmail)
              )
            );
          expect(created).toBeDefined();
          expect(created.firstName).toBe("New Person");

          // Real workflow-processor Lambda should run trigger -> update -> exit
          const execution = await waitForExecutionStatus(
            wf.id,
            created.id,
            ["completed", "failed"],
            45_000
          );

          if (execution?.status === "failed") {
            // biome-ignore lint/suspicious/noConsole: test diagnostic
            console.error("Workflow execution failed:", {
              error: execution.error,
              errorStepId: execution.errorStepId,
            });
          }

          expect(execution?.status).toBe("completed");

          // Clean up auto-created contact so the next test's beforeEach stays
          // focused on testContact.
          await db.delete(contact).where(eq(contact.id, created.id));
        }
      );

      it(
        "resumes waiting execution when event matches waitingForEvent",
        { timeout: 60_000 },
        async () => {
          const eventName = "special.event";
          const wf = createWaitForEventWorkflow(eventName);
          await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
          createdWorkflowIds.push(wf.id);

          // Kick off the workflow via the real SQS queue so the real
          // workflow-processor Lambda advances it to wait_for_event.
          await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
            type: "trigger",
            workflowId: wf.id,
            contactId: testContact.id,
            organizationId: testOrg.id,
          });

          // Wait for the execution to park at "waiting"
          const waitingExecution = await waitForExecutionStatus(
            wf.id,
            testContact.id,
            "waiting",
            30_000
          );
          expect(waitingExecution).not.toBeNull();
          expect(waitingExecution?.status).toBe("waiting");
          expect(waitingExecution?.waitingForEvent).toBe(eventName);

          // Now fire the event via POST /v1/events — this should cause the
          // API to enqueue a resume job on the real queue.
          const res = await postEvent({
            name: eventName,
            contactId: testContact.id,
          });

          expect(res.status).toBe(200);
          const body = await res.json();
          expect(body.success).toBe(true);
          expect(body.executionsResumed).toBe(1);

          // Real Lambda processes the resume -> exit_yes -> completed
          const finalExecution = await waitForExecutionStatus(
            wf.id,
            testContact.id,
            ["completed", "failed"],
            45_000
          );

          if (finalExecution?.status === "failed") {
            // biome-ignore lint/suspicious/noConsole: test diagnostic
            console.error("Workflow execution failed:", {
              error: finalExecution.error,
              errorStepId: finalExecution.errorStepId,
            });
          }

          expect(finalExecution?.status).toBe("completed");
          expect(finalExecution?.completedAt).not.toBeNull();
        }
      );
    });
  }
);
