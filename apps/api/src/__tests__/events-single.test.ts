/**
 * Single Event Endpoint Tests
 *
 * Integration tests for POST /v1/events (single event ingestion).
 * Covers: contact resolution (id, email), createIfMissing, workflow triggering,
 * waiting execution resumption, and invalid body handling.
 */

import {
  contact,
  contactEvent,
  db,
  eq,
  member,
  organization,
  user,
  workflow,
  workflowExecution,
} from "@wraps/db";
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

vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn().mockResolvedValue(undefined),
  enqueueWorkflowStepBatch: vi.fn().mockResolvedValue(undefined),
  deleteScheduledStep: vi.fn().mockResolvedValue(undefined),
}));

import { Elysia } from "elysia";

vi.mock("../middleware/event-limit", () => ({
  eventLimitMiddleware: new Elysia({ name: "event-limit" }),
  getEventTTLExpiration: () => {
    const ttl = new Date();
    ttl.setFullYear(ttl.getFullYear() + 2);
    return ttl;
  },
  incrementEventUsage: vi.fn().mockResolvedValue(1),
}));

import type { AuthContext } from "../middleware/auth";
import { eventsRoutes } from "../routes/events";
import {
  deleteScheduledStep,
  enqueueWorkflowStep,
} from "../services/workflow-queue";

const TEST_PREFIX = "events-single-test";

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "Events Single Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "Events Single Test Org",
  slug: `${TEST_PREFIX}-org`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const otherOrg = {
  id: `${TEST_PREFIX}-org-2`,
  name: "Events Single Other Org",
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

const testContact = {
  id: `${TEST_PREFIX}-contact-1`,
  organizationId: testOrg.id,
  email: `${TEST_PREFIX}-c1@example.com`,
  emailHash: `${TEST_PREFIX}-hash-1`,
  externalId: `${TEST_PREFIX}-ext-1`,
  firstName: "Alice",
  lastName: "Test",
  emailStatus: "active" as const,
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const otherOrgContact = {
  id: `${TEST_PREFIX}-contact-other`,
  organizationId: otherOrg.id,
  email: `${TEST_PREFIX}-other@example.com`,
  emailHash: `${TEST_PREFIX}-hash-other`,
  firstName: "Other",
  lastName: "Org",
  emailStatus: "active" as const,
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testWorkflow = {
  id: `${TEST_PREFIX}-workflow-1`,
  organizationId: testOrg.id,
  name: "Single Event Trigger Flow",
  status: "enabled",
  triggerType: "event",
  triggerConfig: { eventName: "purchase.completed" },
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
  planId: "starter",
};

function createTestApp() {
  return new Elysia().derive(() => ({ auth: mockAuth })).use(eventsRoutes);
}

function postEvent(
  app: ReturnType<typeof createTestApp>,
  body: Record<string, unknown>
) {
  return app.handle(
    new Request("http://localhost/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /v1/events (single)", () => {
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
      .insert(contact)
      .values(testContact)
      .onConflictDoUpdate({
        target: contact.id,
        set: { updatedAt: new Date() },
      });
    await db
      .insert(contact)
      .values(otherOrgContact)
      .onConflictDoUpdate({
        target: contact.id,
        set: { updatedAt: new Date() },
      });
    await db
      .insert(workflow)
      .values(testWorkflow as typeof workflow.$inferInsert)
      .onConflictDoUpdate({
        target: workflow.id,
        set: { updatedAt: new Date() },
      });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createTestApp();

    await db
      .delete(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    await db
      .delete(workflowExecution)
      .where(eq(workflowExecution.organizationId, testOrg.id));

    // Remove any auto-created contacts (leave the seeded testContact)
    await db
      .delete(contact)
      .where(
        and(
          eq(contact.organizationId, testOrg.id),
          inArray(contact.email, [
            `${TEST_PREFIX}-created@example.com`,
            `${TEST_PREFIX}-missing@example.com`,
          ])
        )
      );
  });

  afterAll(async () => {
    await db
      .delete(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    await db
      .delete(workflowExecution)
      .where(eq(workflowExecution.organizationId, testOrg.id));
    await db.delete(workflow).where(eq(workflow.id, testWorkflow.id));
    await db.delete(contact).where(eq(contact.id, otherOrgContact.id));
    await db.delete(contact).where(eq(contact.organizationId, testOrg.id));
    await db.delete(member).where(eq(member.id, testMember.id));
    await db.delete(organization).where(eq(organization.id, otherOrg.id));
    await db.delete(organization).where(eq(organization.id, testOrg.id));
    await db.delete(user).where(eq(user.id, testUser.id));
  });

  it("resolves contact by contactId (org-scoped)", async () => {
    const res = await postEvent(app, {
      name: "page.viewed",
      contactId: testContact.id,
      properties: { path: "/pricing" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const events = await db
      .select()
      .from(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    expect(events).toHaveLength(1);
    expect(events[0].contactId).toBe(testContact.id);
    expect(events[0].eventName).toBe("page.viewed");
    expect(events[0].eventData).toEqual({ path: "/pricing" });
  });

  it("returns 400 for contactId belonging to a different org (IDOR guard)", async () => {
    const res = await postEvent(app, {
      name: "page.viewed",
      contactId: otherOrgContact.id,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Contact not found");

    // No event should have been inserted for the testOrg
    const events = await db
      .select()
      .from(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    expect(events).toHaveLength(0);
  });

  it("resolves contact by contactEmail", async () => {
    const res = await postEvent(app, {
      name: "signup.completed",
      contactEmail: testContact.email,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const events = await db
      .select()
      .from(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    expect(events).toHaveLength(1);
    expect(events[0].contactId).toBe(testContact.id);
  });

  it("createIfMissing=true creates new contact when email is unknown", async () => {
    const newEmail = `${TEST_PREFIX}-created@example.com`;

    const res = await postEvent(app, {
      name: "signup.started",
      contactEmail: newEmail,
      contactName: "New Person",
      createIfMissing: true,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.contactCreated).toBe(true);

    const [created] = await db
      .select()
      .from(contact)
      .where(
        and(eq(contact.organizationId, testOrg.id), eq(contact.email, newEmail))
      );
    expect(created).toBeDefined();
    expect(created.firstName).toBe("New Person");
  });

  it("triggers matching workflows", async () => {
    const res = await postEvent(app, {
      name: "purchase.completed",
      contactId: testContact.id,
      properties: { amount: 49 },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflowsTriggered).toBe(1);

    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "trigger",
        workflowId: testWorkflow.id,
        contactId: testContact.id,
        organizationId: testOrg.id,
        eventData: { amount: 49 },
      })
    );
  });

  it("resumes waiting executions and cancels timeout scheduler", async () => {
    await db.insert(workflowExecution).values({
      id: `${TEST_PREFIX}-exec-1`,
      workflowId: testWorkflow.id,
      contactId: testContact.id,
      organizationId: testOrg.id,
      status: "waiting",
      waitingForEvent: "purchase.completed",
      waitTimeoutSchedulerName: `${TEST_PREFIX}-timeout-1`,
      currentStepId: "step-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof workflowExecution.$inferInsert);

    const res = await postEvent(app, {
      name: "purchase.completed",
      contactId: testContact.id,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.executionsResumed).toBe(1);

    expect(deleteScheduledStep).toHaveBeenCalledWith(
      `${TEST_PREFIX}-timeout-1`
    );
    expect(enqueueWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resume",
        executionId: `${TEST_PREFIX}-exec-1`,
        branch: "yes",
        organizationId: testOrg.id,
      })
    );
  });

  it("resolves contact by contactExternalId", async () => {
    const res = await postEvent(app, {
      name: "signup.completed",
      contactExternalId: testContact.externalId,
      properties: { plan: "pro" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const events = await db
      .select()
      .from(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    expect(events).toHaveLength(1);
    expect(events[0].contactId).toBe(testContact.id);
    expect(events[0].eventName).toBe("signup.completed");
  });

  it("returns 400 when contactExternalId belongs to a different org", async () => {
    const res = await postEvent(app, {
      name: "page.viewed",
      contactExternalId: "nonexistent-ext-id",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Contact not found");
  });

  it("returns 422 for invalid body (missing required 'name')", async () => {
    const res = await postEvent(app, {
      contactId: testContact.id,
    });

    expect(res.status).toBe(422);
  });
});
