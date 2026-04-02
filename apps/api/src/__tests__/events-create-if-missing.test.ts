/**
 * Single Event – createIfMissing race condition test
 *
 * Validates the fix for the duplicate key violation on
 * `contact_unique_org_email_idx` when concurrent requests
 * try to auto-create the same contact.
 */

import {
  contact,
  contactEvent,
  db,
  eq,
  member,
  organization,
  user,
} from "@wraps/db";
import { and } from "drizzle-orm";
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

const TEST_PREFIX = "events-cim-test";

const testUser = {
  id: `${TEST_PREFIX}-user-1`,
  email: `${TEST_PREFIX}@example.com`,
  name: "CIM Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrg = {
  id: `${TEST_PREFIX}-org-1`,
  name: "CIM Test Org",
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

describe("POST /v1/events – createIfMissing", () => {
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
      .insert(member)
      .values(testMember)
      .onConflictDoUpdate({
        target: member.id,
        set: { role: testMember.role },
      });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createTestApp();

    // Clean up contacts and events created by tests
    await db
      .delete(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    await db.delete(contact).where(eq(contact.organizationId, testOrg.id));
  });

  afterAll(async () => {
    await db
      .delete(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    await db.delete(contact).where(eq(contact.organizationId, testOrg.id));
    await db.delete(member).where(eq(member.id, testMember.id));
    await db.delete(organization).where(eq(organization.id, testOrg.id));
    await db.delete(user).where(eq(user.id, testUser.id));
  });

  // -------------------------------------------------------------------------
  // Basic createIfMissing
  // -------------------------------------------------------------------------

  it("creates a new contact when createIfMissing is true", async () => {
    const res = await postEvent(app, {
      name: "signup.started",
      contactEmail: "new-person@example.com",
      createIfMissing: true,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.contactCreated).toBe(true);

    const contacts = await db
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, testOrg.id),
          eq(contact.email, "new-person@example.com")
        )
      );
    expect(contacts).toHaveLength(1);
  });

  it("sets firstName from contactName when creating", async () => {
    const res = await postEvent(app, {
      name: "signup.started",
      contactEmail: "named@example.com",
      contactName: "Jane",
      createIfMissing: true,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contactCreated).toBe(true);

    const [c] = await db
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, testOrg.id),
          eq(contact.email, "named@example.com")
        )
      );
    expect(c.firstName).toBe("Jane");
  });

  it("uses existing contact when createIfMissing is true but contact exists", async () => {
    // Pre-create the contact
    await db.insert(contact).values({
      organizationId: testOrg.id,
      email: "existing@example.com",
      emailHash: "test-hash-existing",
      emailStatus: "active",
      properties: {},
    });

    const res = await postEvent(app, {
      name: "page.viewed",
      contactEmail: "existing@example.com",
      createIfMissing: true,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.contactCreated).toBe(false);

    // Should still be only one contact
    const contacts = await db
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, testOrg.id),
          eq(contact.email, "existing@example.com")
        )
      );
    expect(contacts).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Race condition: concurrent createIfMissing for same email
  // -------------------------------------------------------------------------

  it("handles concurrent createIfMissing without duplicate key error", async () => {
    const email = "race-condition@example.com";

    // Fire two identical requests concurrently
    const [res1, res2] = await Promise.all([
      postEvent(app, {
        name: "event.a",
        contactEmail: email,
        createIfMissing: true,
      }),
      postEvent(app, {
        name: "event.b",
        contactEmail: email,
        createIfMissing: true,
      }),
    ]);

    // Both should succeed (no 500 from unique constraint violation)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.success).toBe(true);
    expect(body2.success).toBe(true);

    // Exactly one contact should exist
    const contacts = await db
      .select()
      .from(contact)
      .where(
        and(eq(contact.organizationId, testOrg.id), eq(contact.email, email))
      );
    expect(contacts).toHaveLength(1);

    // Both events should be recorded
    const events = await db
      .select()
      .from(contactEvent)
      .where(eq(contactEvent.organizationId, testOrg.id));
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.eventName).sort()).toEqual([
      "event.a",
      "event.b",
    ]);
  });

  it("handles triple concurrent createIfMissing", async () => {
    const email = "triple-race@example.com";

    const results = await Promise.all(
      ["ev.1", "ev.2", "ev.3"].map((name) =>
        postEvent(app, { name, contactEmail: email, createIfMissing: true })
      )
    );

    for (const res of results) {
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    }

    const contacts = await db
      .select()
      .from(contact)
      .where(
        and(eq(contact.organizationId, testOrg.id), eq(contact.email, email))
      );
    expect(contacts).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Without createIfMissing, missing contact = 400
  // -------------------------------------------------------------------------

  it("returns 400 when contact not found and createIfMissing is false", async () => {
    const res = await postEvent(app, {
      name: "page.viewed",
      contactEmail: "ghost@example.com",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Contact not found");
  });
});
