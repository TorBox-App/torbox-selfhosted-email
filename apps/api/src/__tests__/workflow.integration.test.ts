/**
 * Workflow Integration Tests
 *
 * These tests run against REAL SST dev resources:
 * - Real SQS queues
 * - Real Lambda processors
 * - Real database
 *
 * Prerequisites:
 * 1. Run `pnpm sst:dev` in another terminal
 * 2. Run these tests with `pnpm --filter @wraps/api test:integration`
 *
 * These tests validate the complete workflow execution flow:
 * - Triggering workflows
 * - Processing steps sequentially
 * - Condition branching
 * - Delay scheduling
 * - State management
 */

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { fromEnv, fromIni } from "@aws-sdk/credential-providers";
import {
  contact,
  contactTopic,
  db,
  member,
  organization,
  template,
  topic,
  user,
  workflow,
  workflowExecution,
  workflowStepExecution,
  type WorkflowStep,
  type WorkflowTransition,
} from "@wraps/db";
import { and, eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type { WorkflowJob } from "../services/workflow-queue";

// -----------------------------------------------------------------------------
// SST Output Loading
// -----------------------------------------------------------------------------

interface SstOutputs {
  workflowQueueUrl: string;
  workflowDlqUrl: string;
  apiUrl: string;
  schedulerGroupName: string;
  schedulerRoleArn: string;
}

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

  return outputs as SstOutputs;
}

// -----------------------------------------------------------------------------
// Test Harness
// -----------------------------------------------------------------------------

// Create SQS client with credentials from environment or AWS profile
const awsProfile = process.env.AWS_PROFILE || "default";
const sqs = new SQSClient({
  region: "us-east-1",
  credentials: async () => {
    try {
      // Try environment variables first (set by SST dev)
      return await fromEnv()();
    } catch {
      // Fall back to AWS profile
      return await fromIni({ profile: awsProfile })();
    }
  },
});

/**
 * Send a workflow job to the SQS queue
 */
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
 * Poll for workflow execution to reach expected status
 */
async function waitForExecutionStatus(
  executionId: string,
  expectedStatus: string | string[],
  timeoutMs = 30000,
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
      .where(eq(workflowExecution.id, executionId));

    if (execution && statuses.includes(execution.status)) {
      return execution;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Return final state even if not expected
  const [finalExecution] = await db
    .select()
    .from(workflowExecution)
    .where(eq(workflowExecution.id, executionId));
  return finalExecution ?? null;
}

/**
 * Poll for a workflow execution to be created for a contact
 */
async function waitForExecutionCreated(
  workflowId: string,
  contactId: string,
  timeoutMs = 30000,
  pollIntervalMs = 500
): Promise<typeof workflowExecution.$inferSelect | null> {
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

    if (execution) {
      return execution;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

/**
 * Get all step executions for a workflow execution
 */
async function getStepExecutions(executionId: string) {
  return db
    .select()
    .from(workflowStepExecution)
    .where(eq(workflowStepExecution.executionId, executionId))
    .orderBy(workflowStepExecution.startedAt);
}

// -----------------------------------------------------------------------------
// Test Data Setup
// -----------------------------------------------------------------------------

const TEST_PREFIX = "int-workflow-test";

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Workflow Integration Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Workflow Integration Test Org",
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

const testContact = {
  id: `${TEST_PREFIX}-contact-1`,
  organizationId: testOrg.id,
  email: `${TEST_PREFIX}-contact@example.com`,
  emailHash: `${TEST_PREFIX}-hash`,
  firstName: "Integration",
  lastName: "Test",
  emailStatus: "active" as const,
  properties: { plan: "pro", score: 100 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testTopic = {
  id: `${TEST_PREFIX}-topic-1`,
  organizationId: testOrg.id,
  name: "Integration Test Topic",
  slug: "integration-test",
  description: "Topic for integration tests",
  public: true,
  doubleOptIn: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: testUser.id,
};

// -----------------------------------------------------------------------------
// Test Fixtures - Workflows
// -----------------------------------------------------------------------------

function createSimpleWorkflow(overrides?: Partial<typeof workflow.$inferInsert>) {
  const triggerId = "trigger-1";
  const exitId = "exit-1";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    { id: exitId, type: "exit", name: "Exit", position: { x: 0, y: 200 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: exitId },
  ];

  return {
    id: `${TEST_PREFIX}-wf-simple-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Simple Test Workflow",
    status: "enabled" as const,
    triggerType: "api" as const,
    triggerConfig: {},
    steps,
    transitions,
    allowReentry: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: testUser.id,
    ...overrides,
  };
}

function createConditionWorkflow() {
  const triggerId = "trigger-1";
  const conditionId = "condition-1";
  const exitYesId = "exit-yes";
  const exitNoId = "exit-no";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: conditionId,
      type: "condition",
      name: "Check Plan",
      position: { x: 0, y: 100 },
      config: {
        type: "condition",
        field: "plan",
        operator: "equals",
        value: "pro",
      },
    },
    { id: exitYesId, type: "exit", name: "Exit Yes", position: { x: -100, y: 200 }, config: { type: "exit" } },
    { id: exitNoId, type: "exit", name: "Exit No", position: { x: 100, y: 200 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: conditionId },
    { id: "t2", fromStepId: conditionId, toStepId: exitYesId, condition: { branch: "yes" } },
    { id: "t3", fromStepId: conditionId, toStepId: exitNoId, condition: { branch: "no" } },
  ];

  return {
    id: `${TEST_PREFIX}-wf-condition-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Condition Test Workflow",
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

function createUpdateContactWorkflow() {
  const triggerId = "trigger-1";
  const updateId = "update-1";
  const exitId = "exit-1";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: updateId,
      type: "update_contact",
      name: "Update Contact",
      position: { x: 0, y: 100 },
      config: {
        type: "update_contact",
        updates: [
          { field: "updated_by_workflow", operation: "set", value: "true" },
          { field: "score", operation: "increment", value: 10 },
        ],
      },
    },
    { id: exitId, type: "exit", name: "Exit", position: { x: 0, y: 200 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: updateId },
    { id: "t2", fromStepId: updateId, toStepId: exitId },
  ];

  return {
    id: `${TEST_PREFIX}-wf-update-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Update Contact Test Workflow",
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

function createDelayWorkflow(delayMinutes: number) {
  const triggerId = "trigger-1";
  const delayId = "delay-1";
  const exitId = "exit-1";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: delayId,
      type: "delay",
      name: "Delay",
      position: { x: 0, y: 100 },
      config: {
        type: "delay",
        amount: delayMinutes,
        unit: "minutes",
      },
    },
    { id: exitId, type: "exit", name: "Exit", position: { x: 0, y: 200 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: delayId },
    { id: "t2", fromStepId: delayId, toStepId: exitId },
  ];

  return {
    id: `${TEST_PREFIX}-wf-delay-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Delay Test Workflow",
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

function createMultiStepWorkflow() {
  const triggerId = "trigger-1";
  const update1Id = "update-1";
  const conditionId = "condition-1";
  const update2Id = "update-2";
  const exitId = "exit-1";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: update1Id,
      type: "update_contact",
      name: "Update Step 1",
      position: { x: 0, y: 100 },
      config: {
        type: "update_contact",
        updates: [
          { field: "step1", operation: "set", value: "done" },
        ],
      },
    },
    {
      id: conditionId,
      type: "condition",
      name: "Check Plan",
      position: { x: 0, y: 200 },
      config: {
        type: "condition",
        field: "plan",
        operator: "equals",
        value: "pro",
      },
    },
    {
      id: update2Id,
      type: "update_contact",
      name: "Update Step 2",
      position: { x: 0, y: 300 },
      config: {
        type: "update_contact",
        updates: [
          { field: "step2", operation: "set", value: "done" },
        ],
      },
    },
    { id: exitId, type: "exit", name: "Exit", position: { x: 0, y: 400 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: update1Id },
    { id: "t2", fromStepId: update1Id, toStepId: conditionId },
    { id: "t3", fromStepId: conditionId, toStepId: update2Id, condition: { branch: "yes" } },
    { id: "t4", fromStepId: conditionId, toStepId: exitId, condition: { branch: "no" } },
    { id: "t5", fromStepId: update2Id, toStepId: exitId },
  ];

  return {
    id: `${TEST_PREFIX}-wf-multi-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Multi-Step Test Workflow",
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

function createWaitForEventWorkflow(eventName: string, timeoutSeconds = 86400) {
  const triggerId = "trigger-1";
  const waitId = "wait-1";
  const exitYesId = "exit-yes";
  const exitTimeoutId = "exit-timeout";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: waitId,
      type: "wait_for_event",
      name: "Wait for Event",
      position: { x: 0, y: 100 },
      config: {
        type: "wait_for_event",
        eventName,
        timeoutSeconds,
      },
    },
    { id: exitYesId, type: "exit", name: "Event Received", position: { x: -100, y: 200 }, config: { type: "exit" } },
    { id: exitTimeoutId, type: "exit", name: "Timeout", position: { x: 100, y: 200 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: waitId },
    { id: "t2", fromStepId: waitId, toStepId: exitYesId, condition: { branch: "yes" } },
    { id: "t3", fromStepId: waitId, toStepId: exitTimeoutId, condition: { branch: "timeout" } },
  ];

  return {
    id: `${TEST_PREFIX}-wf-wait-event-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Wait for Event Test Workflow",
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

function createWaitForEmailEngagementWorkflow(timeoutSeconds = 86400) {
  const triggerId = "trigger-1";
  const waitId = "wait-1";
  const exitOpenedId = "exit-opened";
  const exitTimeoutId = "exit-timeout";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: waitId,
      type: "wait_for_email_engagement",
      name: "Wait for Email Engagement",
      position: { x: 0, y: 100 },
      config: {
        type: "wait_for_email_engagement",
        timeoutSeconds,
      },
    },
    { id: exitOpenedId, type: "exit", name: "Opened", position: { x: -100, y: 200 }, config: { type: "exit" } },
    { id: exitTimeoutId, type: "exit", name: "Timeout", position: { x: 100, y: 200 }, config: { type: "exit" } },
  ];

  // Branch is determined by the engagement event type (opened, clicked, bounced)
  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: waitId },
    { id: "t2", fromStepId: waitId, toStepId: exitOpenedId, condition: { branch: "opened" } },
    { id: "t3", fromStepId: waitId, toStepId: exitTimeoutId, condition: { branch: "timeout" } },
  ];

  return {
    id: `${TEST_PREFIX}-wf-wait-email-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Wait for Email Engagement Test Workflow",
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

function createSubscribeTopicWorkflow(topicId: string) {
  const triggerId = "trigger-1";
  const subscribeId = "subscribe-1";
  const exitId = "exit-1";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: subscribeId,
      type: "subscribe_topic",
      name: "Subscribe to Topic",
      position: { x: 0, y: 100 },
      config: {
        type: "subscribe_topic",
        topicId,
        channel: "email",
      },
    },
    { id: exitId, type: "exit", name: "Exit", position: { x: 0, y: 200 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: subscribeId },
    { id: "t2", fromStepId: subscribeId, toStepId: exitId },
  ];

  return {
    id: `${TEST_PREFIX}-wf-subscribe-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Subscribe Topic Test Workflow",
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

function createUnsubscribeTopicWorkflow(topicId: string) {
  const triggerId = "trigger-1";
  const unsubscribeId = "unsubscribe-1";
  const exitId = "exit-1";

  const steps: WorkflowStep[] = [
    { id: triggerId, type: "trigger", name: "Trigger", position: { x: 0, y: 0 }, config: { type: "trigger", triggerType: "api" } },
    {
      id: unsubscribeId,
      type: "unsubscribe_topic",
      name: "Unsubscribe from Topic",
      position: { x: 0, y: 100 },
      config: {
        type: "unsubscribe_topic",
        topicId,
        channel: "email",
      },
    },
    { id: exitId, type: "exit", name: "Exit", position: { x: 0, y: 200 }, config: { type: "exit" } },
  ];

  const transitions: WorkflowTransition[] = [
    { id: "t1", fromStepId: triggerId, toStepId: unsubscribeId },
    { id: "t2", fromStepId: unsubscribeId, toStepId: exitId },
  ];

  return {
    id: `${TEST_PREFIX}-wf-unsubscribe-${Date.now()}`,
    organizationId: testOrg.id,
    name: "Unsubscribe Topic Test Workflow",
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
  "Workflow Integration Tests",
  () => {
    let sstOutputs: SstOutputs;
    const createdWorkflowIds: string[] = [];

    beforeAll(async () => {
      sstOutputs = loadSstOutputs();

      // Insert test user
      await db
        .insert(user)
        .values(testUser)
        .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });

      // Insert test organization
      await db
        .insert(organization)
        .values(testOrg)
        .onConflictDoUpdate({
          target: organization.id,
          set: { name: testOrg.name },
        });

      // Insert test member
      await db
        .insert(member)
        .values(testMember)
        .onConflictDoUpdate({
          target: member.id,
          set: { role: testMember.role },
        });

      // Insert test topic
      await db
        .insert(topic)
        .values(testTopic)
        .onConflictDoUpdate({ target: topic.id, set: { name: testTopic.name } });

      // Insert test contact
      await db
        .insert(contact)
        .values(testContact)
        .onConflictDoUpdate({
          target: contact.id,
          set: { updatedAt: new Date(), properties: testContact.properties },
        });
    });

    beforeEach(async () => {
      // Clean up any executions from previous tests
      await db
        .delete(workflowExecution)
        .where(eq(workflowExecution.organizationId, testOrg.id));

      // Clean up contact topic subscriptions
      await db
        .delete(contactTopic)
        .where(eq(contactTopic.contactId, testContact.id));

      // Reset contact properties before each test
      await db
        .update(contact)
        .set({
          properties: testContact.properties,
          updatedAt: new Date(),
        })
        .where(eq(contact.id, testContact.id));
    });

    afterAll(async () => {
      // Clean up workflows and executions
      for (const workflowId of createdWorkflowIds) {
        await db
          .delete(workflowStepExecution)
          .where(eq(workflowStepExecution.executionId, workflowId));
        await db
          .delete(workflowExecution)
          .where(eq(workflowExecution.workflowId, workflowId));
        await db.delete(workflow).where(eq(workflow.id, workflowId));
      }

      // Clean up all executions for test org
      await db
        .delete(workflowExecution)
        .where(eq(workflowExecution.organizationId, testOrg.id));

      // Clean up contact topic subscriptions
      await db
        .delete(contactTopic)
        .where(eq(contactTopic.contactId, testContact.id));

      // Clean up test data
      await db.delete(contact).where(eq(contact.id, testContact.id));
      await db.delete(topic).where(eq(topic.id, testTopic.id));
      await db.delete(member).where(eq(member.id, testMember.id));
      await db.delete(organization).where(eq(organization.id, testOrg.id));
      await db.delete(user).where(eq(user.id, testUser.id));
    });

    describe("Simple Workflow", () => {
      it("should trigger and complete a simple workflow", { timeout: 30000 }, async () => {
        // Create workflow
        const wf = createSimpleWorkflow();
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow via SQS
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to complete
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        const finalExecution = await waitForExecutionStatus(
          execution!.id,
          ["completed", "failed"],
          15000
        );

        // Log error if failed
        if (finalExecution?.status === "failed") {
          console.error("Execution failed:", {
            error: finalExecution.error,
            errorStepId: finalExecution.errorStepId,
          });
        }

        expect(finalExecution?.status).toBe("completed");
        expect(finalExecution?.completedAt).not.toBeNull();
      });
    });

    describe("Condition Branching", () => {
      it("should take YES branch when condition matches", { timeout: 30000 }, async () => {
        // Create workflow
        const wf = createConditionWorkflow();
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Ensure contact has plan: "pro" (matches condition)
        await db
          .update(contact)
          .set({ properties: { plan: "pro", score: 100 } })
          .where(eq(contact.id, testContact.id));

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        const finalExecution = await waitForExecutionStatus(
          execution!.id,
          "completed",
          15000
        );
        expect(finalExecution?.status).toBe("completed");

        // Check step executions to verify YES branch was taken
        const stepExecs = await getStepExecutions(execution!.id);
        const conditionStep = stepExecs.find((s) => s.stepType === "condition");
        expect(conditionStep?.branch).toBe("yes");
      });

      it("should take NO branch when condition does not match", { timeout: 30000 }, async () => {
        // Create workflow
        const wf = createConditionWorkflow();
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Set contact to plan: "free" (does NOT match condition)
        await db
          .update(contact)
          .set({ properties: { plan: "free", score: 50 } })
          .where(eq(contact.id, testContact.id));

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        const finalExecution = await waitForExecutionStatus(
          execution!.id,
          "completed",
          15000
        );
        expect(finalExecution?.status).toBe("completed");

        // Check step executions to verify NO branch was taken
        const stepExecs = await getStepExecutions(execution!.id);
        const conditionStep = stepExecs.find((s) => s.stepType === "condition");
        expect(conditionStep?.branch).toBe("no");
      });
    });

    describe("Update Contact Step", () => {
      it("should update contact properties", { timeout: 30000 }, async () => {
        // Create workflow
        const wf = createUpdateContactWorkflow();
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Initial properties
        const initialScore = 100;
        await db
          .update(contact)
          .set({ properties: { plan: "pro", score: initialScore } })
          .where(eq(contact.id, testContact.id));

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to complete
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        await waitForExecutionStatus(execution!.id, "completed", 15000);

        // Verify contact was updated
        const [updatedContact] = await db
          .select()
          .from(contact)
          .where(eq(contact.id, testContact.id));

        expect(updatedContact.properties).toMatchObject({
          updated_by_workflow: "true",
          score: initialScore + 10,
        });
      });
    });

    describe("Multi-Step Workflow", () => {
      it("should process multiple steps in sequence", { timeout: 30000 }, async () => {
        // Create workflow
        const wf = createMultiStepWorkflow();
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Ensure contact has plan: "pro" to take YES branch
        await db
          .update(contact)
          .set({ properties: { plan: "pro", score: 100 } })
          .where(eq(contact.id, testContact.id));

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to complete
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        const finalExecution = await waitForExecutionStatus(
          execution!.id,
          "completed",
          20000
        );
        expect(finalExecution?.status).toBe("completed");

        // Verify all steps were executed
        const stepExecs = await getStepExecutions(execution!.id);
        const stepTypes = stepExecs.map((s) => s.stepType);

        // Should have: update_contact, condition, update_contact, exit
        expect(stepTypes).toContain("update_contact");
        expect(stepTypes).toContain("condition");

        // Verify contact properties were updated by both update steps
        const [updatedContact] = await db
          .select()
          .from(contact)
          .where(eq(contact.id, testContact.id));

        expect(updatedContact.properties).toMatchObject({
          step1: "done",
          step2: "done",
        });
      });
    });

    describe("Delay Step", () => {
      // Skip: 1-minute minimum delay + EventBridge Scheduler latency makes this too slow for CI
      it.skip("should pause execution and resume after delay", { timeout: 120000 }, async () => {
        // Create workflow with 1 minute delay
        const wf = createDelayWorkflow(1);
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to be created
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        // First, it should enter "paused" state while waiting for delay
        const pausedExecution = await waitForExecutionStatus(
          execution!.id,
          "paused",
          15000
        );
        expect(pausedExecution?.status).toBe("paused");
        expect(pausedExecution?.delaySchedulerName).not.toBeNull();

        // Wait for delay to complete (5s delay + buffer)
        const completedExecution = await waitForExecutionStatus(
          execution!.id,
          "completed",
          20000 // 20s timeout for delay + processing
        );
        expect(completedExecution?.status).toBe("completed");
      });
    });

    describe("Execution Limits", () => {
      it("should prevent duplicate execution when allowReentry is false", { timeout: 30000 }, async () => {
        // Create workflow with reentry disabled
        const wf = createSimpleWorkflow({ allowReentry: false });
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Send both triggers immediately (before either can complete)
        // This tests the atomic INSERT ... ON CONFLICT behavior
        await Promise.all([
          sendWorkflowJob(sstOutputs.workflowQueueUrl, {
            type: "trigger",
            workflowId: wf.id,
            contactId: testContact.id,
            organizationId: testOrg.id,
          }),
          sendWorkflowJob(sstOutputs.workflowQueueUrl, {
            type: "trigger",
            workflowId: wf.id,
            contactId: testContact.id,
            organizationId: testOrg.id,
          }),
        ]);

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Should only have one execution (the other was blocked by ON CONFLICT)
        const executions = await db
          .select()
          .from(workflowExecution)
          .where(
            and(
              eq(workflowExecution.workflowId, wf.id),
              eq(workflowExecution.contactId, testContact.id)
            )
          );

        expect(executions.length).toBe(1);
      });

      it("should prevent race condition with concurrent triggers (atomic INSERT)", { timeout: 30000 }, async () => {
        // This test verifies the fix for the race condition bug where simultaneous
        // triggers could both pass the check-then-insert and create duplicate executions.
        // The fix uses INSERT ... ON CONFLICT DO NOTHING with a partial unique index.
        const wf = createSimpleWorkflow({ allowReentry: false });
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Send 5 triggers simultaneously (race condition)
        const triggerPromises = Array.from({ length: 5 }, () =>
          sendWorkflowJob(sstOutputs.workflowQueueUrl, {
            type: "trigger",
            workflowId: wf.id,
            contactId: testContact.id,
            organizationId: testOrg.id,
          })
        );
        await Promise.all(triggerPromises);

        // Wait for all triggers to be processed
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Should only have exactly ONE execution despite 5 concurrent triggers
        const executions = await db
          .select()
          .from(workflowExecution)
          .where(
            and(
              eq(workflowExecution.workflowId, wf.id),
              eq(workflowExecution.contactId, testContact.id)
            )
          );

        expect(executions.length).toBe(1);
        // Verify the execution has the correct allowReentry flag denormalized
        expect(executions[0].allowReentry).toBe(false);
      });

      it("should allow multiple executions when allowReentry is true", { timeout: 30000 }, async () => {
        // Create workflow with reentry enabled
        const wf = createSimpleWorkflow({ allowReentry: true });
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow twice
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for executions to complete (longer timeout for Lambda)
        await new Promise((resolve) => setTimeout(resolve, 15000));

        // Should have at least two executions
        const executions = await db
          .select()
          .from(workflowExecution)
          .where(
            and(
              eq(workflowExecution.workflowId, wf.id),
              eq(workflowExecution.contactId, testContact.id)
            )
          );

        expect(executions.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe("Disabled Workflow", () => {
      it("should not execute disabled workflow", { timeout: 30000 }, async () => {
        // Create disabled workflow
        const wf = createSimpleWorkflow({ status: "paused" });
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Try to trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Should have no executions
        const executions = await db
          .select()
          .from(workflowExecution)
          .where(eq(workflowExecution.workflowId, wf.id));

        expect(executions.length).toBe(0);
      });
    });

    describe("Wait for Event Step", () => {
      it("should enter waiting state when wait_for_event step is reached", { timeout: 30000 }, async () => {
        // Create workflow with wait_for_event step
        const wf = createWaitForEventWorkflow("purchase_completed");
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to be created and enter waiting state
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        // Wait for execution to enter waiting state
        const waitingExecution = await waitForExecutionStatus(
          execution!.id,
          "waiting",
          15000
        );

        expect(waitingExecution?.status).toBe("waiting");
        expect(waitingExecution?.waitingForEvent).toBe("purchase_completed");
        expect(waitingExecution?.waitTimeoutAt).not.toBeNull();
      });

      it("should resume execution when event is received", { timeout: 30000 }, async () => {
        // Create workflow
        const wf = createWaitForEventWorkflow("purchase_completed");
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to enter waiting state
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        await waitForExecutionStatus(execution!.id, "waiting", 15000);

        // Send resume event (simulating event received)
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "resume",
          executionId: execution!.id,
          branch: "yes",
          organizationId: testOrg.id,
        });

        // Wait for execution to complete
        const completedExecution = await waitForExecutionStatus(
          execution!.id,
          "completed",
          15000
        );

        expect(completedExecution?.status).toBe("completed");
        expect(completedExecution?.waitingForEvent).toBeNull();
      });
    });

    describe("Wait for Email Engagement Step", () => {
      it("should enter waiting state for email engagement", { timeout: 30000 }, async () => {
        // Create workflow with wait_for_email_engagement step
        // Note: Without a previous send_email step, it will wait for "email_engagement:unknown"
        const wf = createWaitForEmailEngagementWorkflow();
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to enter waiting state
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        const waitingExecution = await waitForExecutionStatus(
          execution!.id,
          "waiting",
          15000
        );

        expect(waitingExecution?.status).toBe("waiting");
        // Without a previous send_email step, it will wait for "email_engagement:unknown"
        expect(waitingExecution?.waitingForEvent).toMatch(/^email_engagement:/);
        expect(waitingExecution?.waitTimeoutAt).not.toBeNull();
      });

      it("should resume when email engagement is received", { timeout: 30000 }, async () => {
        const wf = createWaitForEmailEngagementWorkflow();
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for waiting state
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        await waitForExecutionStatus(execution!.id, "waiting", 15000);

        // Send resume with "opened" branch
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "resume",
          executionId: execution!.id,
          branch: "opened",
          organizationId: testOrg.id,
        });

        // Should complete
        const completedExecution = await waitForExecutionStatus(
          execution!.id,
          "completed",
          15000
        );

        expect(completedExecution?.status).toBe("completed");
      });
    });

    describe("Subscribe Topic Step", () => {
      it("should subscribe contact to topic", { timeout: 30000 }, async () => {
        // Create workflow that subscribes to the test topic
        const wf = createSubscribeTopicWorkflow(testTopic.id);
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Verify no subscription exists initially
        const initialSubscription = await db
          .select()
          .from(contactTopic)
          .where(
            and(
              eq(contactTopic.contactId, testContact.id),
              eq(contactTopic.topicId, testTopic.id)
            )
          );
        expect(initialSubscription.length).toBe(0);

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for execution to complete
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        await waitForExecutionStatus(execution!.id, "completed", 15000);

        // Verify subscription was created
        const [subscription] = await db
          .select()
          .from(contactTopic)
          .where(
            and(
              eq(contactTopic.contactId, testContact.id),
              eq(contactTopic.topicId, testTopic.id)
            )
          );

        expect(subscription).toBeDefined();
        expect(subscription.status).toBe("subscribed");
        expect(subscription.subscribedAt).not.toBeNull();
      });

      it("should re-subscribe contact to topic if previously unsubscribed", { timeout: 30000 }, async () => {
        // Create an existing unsubscribed record
        await db.insert(contactTopic).values({
          contactId: testContact.id,
          topicId: testTopic.id,
          status: "unsubscribed",
          unsubscribedAt: new Date(),
        });

        // Create and trigger workflow
        const wf = createSubscribeTopicWorkflow(testTopic.id);
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        await waitForExecutionStatus(execution!.id, "completed", 15000);

        // Verify subscription was updated
        const [subscription] = await db
          .select()
          .from(contactTopic)
          .where(
            and(
              eq(contactTopic.contactId, testContact.id),
              eq(contactTopic.topicId, testTopic.id)
            )
          );

        expect(subscription.status).toBe("subscribed");
        expect(subscription.unsubscribedAt).toBeNull();
      });
    });

    describe("Unsubscribe Topic Step", () => {
      it("should unsubscribe contact from topic", { timeout: 30000 }, async () => {
        // First, create a subscription
        await db.insert(contactTopic).values({
          contactId: testContact.id,
          topicId: testTopic.id,
          status: "subscribed",
          subscribedAt: new Date(),
        });

        // Create workflow that unsubscribes
        const wf = createUnsubscribeTopicWorkflow(testTopic.id);
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        // Trigger workflow
        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        // Wait for completion
        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        await waitForExecutionStatus(execution!.id, "completed", 15000);

        // Verify subscription was updated to unsubscribed
        const [subscription] = await db
          .select()
          .from(contactTopic)
          .where(
            and(
              eq(contactTopic.contactId, testContact.id),
              eq(contactTopic.topicId, testTopic.id)
            )
          );

        expect(subscription.status).toBe("unsubscribed");
        expect(subscription.unsubscribedAt).not.toBeNull();
      });

      it("should handle unsubscribe when no subscription exists (no-op)", { timeout: 30000 }, async () => {
        // Don't create any subscription - workflow should complete without error

        const wf = createUnsubscribeTopicWorkflow(testTopic.id);
        await db.insert(workflow).values(wf as typeof workflow.$inferInsert);
        createdWorkflowIds.push(wf.id);

        await sendWorkflowJob(sstOutputs.workflowQueueUrl, {
          type: "trigger",
          workflowId: wf.id,
          contactId: testContact.id,
          organizationId: testOrg.id,
        });

        const execution = await waitForExecutionCreated(wf.id, testContact.id);
        expect(execution).not.toBeNull();

        // Should complete (unsubscribe with no existing record is a no-op)
        const completedExecution = await waitForExecutionStatus(
          execution!.id,
          "completed",
          15000
        );

        expect(completedExecution?.status).toBe("completed");

        // Verify no subscription record was created
        const subscriptions = await db
          .select()
          .from(contactTopic)
          .where(
            and(
              eq(contactTopic.contactId, testContact.id),
              eq(contactTopic.topicId, testTopic.id)
            )
          );

        expect(subscriptions.length).toBe(0);
      });
    });
  }
);
