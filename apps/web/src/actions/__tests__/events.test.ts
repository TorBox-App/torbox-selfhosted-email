import {
  contact,
  contactEvent,
  db,
  member,
  organization,
  user,
} from "@wraps/db";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getEvent, getEventNames, listEvents } from "../events";

// Test data
const testUser = {
  id: "test-events-user-1",
  email: "events-test@example.com",
  name: "Events Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
};

const testOrganization = {
  id: "test-events-org-1",
  name: "Events Test Org",
  slug: "events-test-org",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember = {
  id: "test-events-member-1",
  organizationId: testOrganization.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

// Second organization for isolation tests
const testOrganization2 = {
  id: "test-events-org-2",
  name: "Events Test Org 2",
  slug: "events-test-org-2",
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const testMember2 = {
  id: "test-events-member-2",
  organizationId: testOrganization2.id,
  userId: testUser.id,
  role: "owner" as const,
  createdAt: new Date(),
};

// Contact in second organization
const testContactOrg2 = {
  id: "test-events-contact-org2",
  organizationId: testOrganization2.id,
  email: "jarod@example.com", // Same email as testContact1 to test isolation
  emailHash: "hash-org2",
  status: "active" as const,
  emailStatus: "active" as const,
  firstName: "Jarod", // Same name to test search isolation
  lastName: "Stewart",
  properties: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test contacts
const testContact1 = {
  id: "test-events-contact-1",
  organizationId: testOrganization.id,
  email: "jarod@example.com",
  emailHash: "hash1",
  status: "active" as const,
  emailStatus: "active" as const,
  firstName: "Jarod",
  lastName: "Stewart",
  properties: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testContact2 = {
  id: "test-events-contact-2",
  organizationId: testOrganization.id,
  email: "alice@example.com",
  emailHash: "hash2",
  status: "active" as const,
  emailStatus: "active" as const,
  firstName: "Alice",
  lastName: "Johnson",
  properties: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testContact3 = {
  id: "test-events-contact-3",
  organizationId: testOrganization.id,
  email: "bob@example.com",
  emailHash: "hash3",
  status: "active" as const,
  emailStatus: "active" as const,
  firstName: null,
  lastName: null,
  properties: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

// Mock the auth module
vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: testUser.id, email: testUser.email, name: testUser.name },
        session: {
          id: "session-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 86_400_000),
          token: "test-token",
        },
      })),
    },
  },
}));

// Set up test database
beforeAll(async () => {
  // Insert test user
  await db
    .insert(user)
    .values(testUser)
    .onConflictDoUpdate({
      target: user.id,
      set: { updatedAt: new Date() },
    });

  // Insert test organization
  await db
    .insert(organization)
    .values(testOrganization)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: testOrganization.name },
    });

  // Insert test member
  await db
    .insert(member)
    .values(testMember)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMember.role },
    });

  // Insert test contacts
  await db
    .insert(contact)
    .values(testContact1)
    .onConflictDoUpdate({
      target: contact.id,
      set: { updatedAt: new Date() },
    });

  await db
    .insert(contact)
    .values(testContact2)
    .onConflictDoUpdate({
      target: contact.id,
      set: { updatedAt: new Date() },
    });

  await db
    .insert(contact)
    .values(testContact3)
    .onConflictDoUpdate({
      target: contact.id,
      set: { updatedAt: new Date() },
    });

  // Set up second organization for isolation tests
  await db
    .insert(organization)
    .values(testOrganization2)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: testOrganization2.name },
    });

  await db
    .insert(member)
    .values(testMember2)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: testMember2.role },
    });

  await db
    .insert(contact)
    .values(testContactOrg2)
    .onConflictDoUpdate({
      target: contact.id,
      set: { updatedAt: new Date() },
    });
});

// Clean up events before each test
beforeEach(async () => {
  await db
    .delete(contactEvent)
    .where(eq(contactEvent.organizationId, testOrganization.id));
  await db
    .delete(contactEvent)
    .where(eq(contactEvent.organizationId, testOrganization2.id));
});

// Clean up after all tests
afterAll(async () => {
  // Clean up org 1
  await db
    .delete(contactEvent)
    .where(eq(contactEvent.organizationId, testOrganization.id));
  await db
    .delete(contact)
    .where(eq(contact.organizationId, testOrganization.id));
  await db.delete(member).where(eq(member.id, testMember.id));
  await db.delete(organization).where(eq(organization.id, testOrganization.id));

  // Clean up org 2
  await db
    .delete(contactEvent)
    .where(eq(contactEvent.organizationId, testOrganization2.id));
  await db
    .delete(contact)
    .where(eq(contact.organizationId, testOrganization2.id));
  await db.delete(member).where(eq(member.id, testMember2.id));
  await db
    .delete(organization)
    .where(eq(organization.id, testOrganization2.id));

  await db.delete(user).where(eq(user.id, testUser.id));
});

// Helper to create test events
async function createTestEvent(
  contactId: string,
  eventName: string,
  eventData?: Record<string, unknown>,
  orgId: string = testOrganization.id
) {
  const [event] = await db
    .insert(contactEvent)
    .values({
      contactId,
      organizationId: orgId,
      eventName,
      eventData: eventData ?? null,
      createdAt: new Date(),
    })
    .returning();
  return event;
}

describe("Events Server Actions", () => {
  describe("listEvents", () => {
    beforeEach(async () => {
      // Create test events
      await createTestEvent(testContact1.id, "page_view", { page: "/home" });
      await createTestEvent(testContact1.id, "button_click", {
        button: "signup",
      });
      await createTestEvent(testContact2.id, "purchase", {
        amount: 99.99,
        product: "Pro Plan",
      });
      await createTestEvent(testContact3.id, "page_view", {
        page: "/pricing",
      });
    });

    it("should list all events", async () => {
      const result = await listEvents(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(4);
        expect(result.total).toBe(4);
      }
    });

    it("should paginate results", async () => {
      const result = await listEvents(testOrganization.id, {
        page: 1,
        pageSize: 2,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(2);
        expect(result.total).toBe(4);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(2);
      }
    });

    it("should filter by event name", async () => {
      const result = await listEvents(testOrganization.id, {
        eventName: "page_view",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(2);
        expect(result.events.every((e) => e.eventName === "page_view")).toBe(
          true
        );
      }
    });

    describe("search functionality", () => {
      it("should search by event name", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "purchase",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(1);
          expect(result.events[0].eventName).toBe("purchase");
        }
      });

      it("should search by contact email", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "jarod@example.com",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(2);
          expect(
            result.events.every((e) => e.contactEmail === "jarod@example.com")
          ).toBe(true);
        }
      });

      it("should search by contact email partial match", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "alice",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(1);
          expect(result.events[0].contactEmail).toBe("alice@example.com");
        }
      });

      it("should search by contact first name", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "Jarod",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(2);
          expect(
            result.events.every((e) => e.contactFirstName === "Jarod")
          ).toBe(true);
        }
      });

      it("should search by contact first name case insensitive", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "jarod",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(2);
          expect(
            result.events.every((e) => e.contactFirstName === "Jarod")
          ).toBe(true);
        }
      });

      it("should search by contact last name", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "Stewart",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(2);
          expect(
            result.events.every((e) => e.contactLastName === "Stewart")
          ).toBe(true);
        }
      });

      it("should search by contact last name case insensitive", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "johnson",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(1);
          expect(result.events[0].contactLastName).toBe("Johnson");
        }
      });

      it("should search within event data JSON", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "Pro Plan",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(1);
          expect(result.events[0].eventName).toBe("purchase");
        }
      });

      it("should handle contacts with null firstName/lastName", async () => {
        // testContact3 has null firstName and lastName
        const result = await listEvents(testOrganization.id, {
          search: "bob@example.com",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(1);
          expect(result.events[0].contactEmail).toBe("bob@example.com");
          expect(result.events[0].contactFirstName).toBeNull();
          expect(result.events[0].contactLastName).toBeNull();
        }
      });

      it("should return empty when search matches nothing", async () => {
        const result = await listEvents(testOrganization.id, {
          search: "nonexistent",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.events).toHaveLength(0);
          expect(result.total).toBe(0);
        }
      });
    });

    it("should filter by contact email", async () => {
      const result = await listEvents(testOrganization.id, {
        contactEmail: "alice",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].contactEmail).toBe("alice@example.com");
      }
    });

    it("should filter by date range", async () => {
      // Create an event with a specific date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      await db.insert(contactEvent).values({
        contactId: testContact1.id,
        organizationId: testOrganization.id,
        eventName: "old_event",
        createdAt: pastDate,
      });

      const result = await listEvents(testOrganization.id, {
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should exclude the old event
        expect(result.events.every((e) => e.eventName !== "old_event")).toBe(
          true
        );
      }
    });

    it("should combine multiple filters", async () => {
      const result = await listEvents(testOrganization.id, {
        eventName: "page_view",
        contactEmail: "jarod",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].eventName).toBe("page_view");
        expect(result.events[0].contactEmail).toBe("jarod@example.com");
      }
    });
  });

  describe("getEvent", () => {
    it("should get event by ID", async () => {
      const createdEvent = await createTestEvent(testContact1.id, "test_event");

      const result = await getEvent(createdEvent.id, testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.id).toBe(createdEvent.id);
        expect(result.event.eventName).toBe("test_event");
        expect(result.event.contactEmail).toBe(testContact1.email);
      }
    });

    it("should include contact details", async () => {
      const createdEvent = await createTestEvent(testContact1.id, "test_event");

      const result = await getEvent(createdEvent.id, testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.contactFirstName).toBe("Jarod");
        expect(result.event.contactLastName).toBe("Stewart");
        expect(result.event.contactEmail).toBe("jarod@example.com");
      }
    });

    it("should return error for non-existent event", async () => {
      const result = await getEvent("non-existent-id", testOrganization.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not found");
      }
    });

    it("should not return event from different organization", async () => {
      const createdEvent = await createTestEvent(testContact1.id, "test_event");

      const result = await getEvent(createdEvent.id, "different-org-id");

      expect(result.success).toBe(false);
    });
  });

  describe("getEventNames", () => {
    beforeEach(async () => {
      await createTestEvent(testContact1.id, "page_view");
      await createTestEvent(testContact1.id, "button_click");
      await createTestEvent(testContact2.id, "page_view"); // Duplicate
      await createTestEvent(testContact2.id, "purchase");
    });

    it("should return unique event names", async () => {
      const result = await getEventNames(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.eventNames).toHaveLength(3);
        expect(result.eventNames).toContain("page_view");
        expect(result.eventNames).toContain("button_click");
        expect(result.eventNames).toContain("purchase");
      }
    });

    it("should return sorted event names", async () => {
      const result = await getEventNames(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        const sorted = [...result.eventNames].sort();
        expect(result.eventNames).toEqual(sorted);
      }
    });

    it("should return empty array when no events exist", async () => {
      // Clear events
      await db
        .delete(contactEvent)
        .where(eq(contactEvent.organizationId, testOrganization.id));

      const result = await getEventNames(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.eventNames).toHaveLength(0);
      }
    });
  });

  describe("organization isolation", () => {
    beforeEach(async () => {
      // Create events in org 1
      await createTestEvent(
        testContact1.id,
        "org1_event",
        { org: "org1" },
        testOrganization.id
      );
      await createTestEvent(
        testContact1.id,
        "shared_event_name",
        { data: "org1 data" },
        testOrganization.id
      );

      // Create events in org 2 with same contact name/email pattern
      await createTestEvent(
        testContactOrg2.id,
        "org2_event",
        { org: "org2" },
        testOrganization2.id
      );
      await createTestEvent(
        testContactOrg2.id,
        "shared_event_name",
        { data: "org2 data" },
        testOrganization2.id
      );
    });

    it("should only return events from the requested organization", async () => {
      const result = await listEvents(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(2);
        // All events should be from org 1
        expect(
          result.events.every((e) => e.contactId === testContact1.id)
        ).toBe(true);
        // Should not contain org2 events
        expect(result.events.some((e) => e.eventName === "org2_event")).toBe(
          false
        );
      }
    });

    it("should not leak events when searching by contact name that exists in multiple orgs", async () => {
      // Both orgs have a contact named "Jarod Stewart"
      const result = await listEvents(testOrganization.id, {
        search: "Jarod",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should only return events from org 1, not org 2
        expect(result.events).toHaveLength(2);
        expect(
          result.events.every((e) => e.contactId === testContact1.id)
        ).toBe(true);
      }
    });

    it("should not leak events when searching by contact email that exists in multiple orgs", async () => {
      // Both orgs have a contact with email "jarod@example.com"
      const result = await listEvents(testOrganization.id, {
        search: "jarod@example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should only return events from org 1, not org 2
        expect(result.events).toHaveLength(2);
        expect(
          result.events.every((e) => e.contactId === testContact1.id)
        ).toBe(true);
      }
    });

    it("should not leak events when searching by event name that exists in multiple orgs", async () => {
      const result = await listEvents(testOrganization.id, {
        search: "shared_event_name",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should only return the event from org 1
        expect(result.events).toHaveLength(1);
        expect(result.events[0].eventData).toEqual({ data: "org1 data" });
      }
    });

    it("should not leak events when searching within event data", async () => {
      const result = await listEvents(testOrganization.id, {
        search: "org2",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should not find org2's event data
        expect(result.events).toHaveLength(0);
      }
    });

    it("getEvent should not return event from different organization", async () => {
      // Create an event in org 2
      const org2Event = await createTestEvent(
        testContactOrg2.id,
        "secret_event",
        { secret: "data" },
        testOrganization2.id
      );

      // Try to access it from org 1
      const result = await getEvent(org2Event.id, testOrganization.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not found");
      }
    });

    it("getEventNames should only return event names from the requested organization", async () => {
      const result = await getEventNames(testOrganization.id);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should include org1's events but not org2_event
        expect(result.eventNames).toContain("org1_event");
        expect(result.eventNames).toContain("shared_event_name");
        expect(result.eventNames).not.toContain("org2_event");
      }
    });
  });
});
