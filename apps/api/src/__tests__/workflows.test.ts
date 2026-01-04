/**
 * Workflow Routes Tests
 *
 * Tests for the workflow API trigger endpoints.
 * Covers:
 * - POST /v1/workflows/:workflowId/trigger - Trigger workflow for a contact
 * - POST /v1/workflows/:workflowId/trigger/batch - Batch trigger for multiple contacts
 */

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Track enqueued workflow steps
const enqueuedSteps: Array<{
  type: string;
  workflowId: string;
  contactId: string;
  organizationId: string;
  eventData: Record<string, unknown>;
}> = [];

// Mock workflow queue
vi.mock("../services/workflow-queue", () => ({
  enqueueWorkflowStep: vi.fn().mockImplementation((step) => {
    enqueuedSteps.push(step);
    return Promise.resolve();
  }),
}));

// Mock data
const mockWorkflows: Record<
  string,
  {
    id: string;
    organizationId: string;
    name: string;
    status: string;
    triggerType: string;
  }
> = {};

const mockContacts: Record<
  string,
  {
    id: string;
    email: string;
    organizationId: string;
  }
> = {};

// Mock database
vi.mock("@wraps/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation((n) => {
            // Return based on what's in our mock data
            const workflows = Object.values(mockWorkflows);
            const contacts = Object.values(mockContacts);
            if (workflows.length > 0)
              return Promise.resolve(workflows.slice(0, n));
            if (contacts.length > 0)
              return Promise.resolve(contacts.slice(0, n));
            return Promise.resolve([]);
          }),
        })),
      })),
    })),
  },
  contact: {
    id: "id",
    email: "email",
    organizationId: "organization_id",
  },
  workflow: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
    status: "status",
    triggerType: "trigger_type",
  },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

// Mock auth context
const mockAuthContext = {
  apiKeyId: "key-123",
  organizationId: "org-123",
  userId: "user-123",
  planId: "starter",
};

// Create a test app that simulates the workflow routes
function createTestApp() {
  return new Elysia()
    .derive(() => ({ auth: mockAuthContext }))
    .post("/v1/workflows/:workflowId/trigger", async (ctx) => {
      const { params } = ctx;
      const body = await ctx.request.json();
      const { contactId, contactEmail, data } = body;

      // Find workflow
      const workflow = mockWorkflows[params.workflowId];
      if (!workflow) {
        ctx.set.status = 200;
        return { success: false, error: "Workflow not found" };
      }

      if (workflow.organizationId !== mockAuthContext.organizationId) {
        ctx.set.status = 200;
        return { success: false, error: "Workflow not found" };
      }

      if (workflow.status !== "enabled") {
        ctx.set.status = 200;
        return { success: false, error: "Workflow is not enabled" };
      }

      if (workflow.triggerType !== "api") {
        ctx.set.status = 200;
        return {
          success: false,
          error: `Workflow has trigger type "${workflow.triggerType}", expected "api"`,
        };
      }

      // Find contact
      let contact: (typeof mockContacts)[string] | undefined;
      if (contactId) {
        contact = Object.values(mockContacts).find(
          (c) =>
            c.id === contactId &&
            c.organizationId === mockAuthContext.organizationId
        );
      } else if (contactEmail) {
        contact = Object.values(mockContacts).find(
          (c) =>
            c.email === contactEmail &&
            c.organizationId === mockAuthContext.organizationId
        );
      }

      if (!contact) {
        ctx.set.status = 200;
        return { success: false, error: "Contact not found" };
      }

      // Enqueue workflow
      enqueuedSteps.push({
        type: "trigger",
        workflowId: workflow.id,
        contactId: contact.id,
        organizationId: mockAuthContext.organizationId,
        eventData: data || {},
      });

      return {
        success: true,
        message: "Workflow triggered successfully",
        workflowId: workflow.id,
        workflowName: workflow.name,
        contactId: contact.id,
      };
    })
    .post("/v1/workflows/:workflowId/trigger/batch", async (ctx) => {
      const { params } = ctx;
      const body = await ctx.request.json();
      const { contacts, data } = body;

      // Find workflow
      const workflow = mockWorkflows[params.workflowId];
      if (!workflow) {
        ctx.set.status = 200;
        return { success: false, error: "Workflow not found" };
      }

      if (workflow.organizationId !== mockAuthContext.organizationId) {
        ctx.set.status = 200;
        return { success: false, error: "Workflow not found" };
      }

      if (workflow.status !== "enabled") {
        ctx.set.status = 200;
        return { success: false, error: "Workflow is not enabled" };
      }

      if (workflow.triggerType !== "api") {
        ctx.set.status = 200;
        return {
          success: false,
          error: `Workflow has trigger type "${workflow.triggerType}", expected "api"`,
        };
      }

      const results = {
        triggered: 0,
        errors: [] as string[],
      };

      for (const c of contacts) {
        let contact: (typeof mockContacts)[string] | undefined;
        if (c.contactId) {
          contact = Object.values(mockContacts).find(
            (mc) =>
              mc.id === c.contactId &&
              mc.organizationId === mockAuthContext.organizationId
          );
        } else if (c.contactEmail) {
          contact = Object.values(mockContacts).find(
            (mc) =>
              mc.email === c.contactEmail &&
              mc.organizationId === mockAuthContext.organizationId
          );
        }

        if (!contact) {
          results.errors.push(
            `Contact not found: ${c.contactId || c.contactEmail}`
          );
          continue;
        }

        enqueuedSteps.push({
          type: "trigger",
          workflowId: workflow.id,
          contactId: contact.id,
          organizationId: mockAuthContext.organizationId,
          eventData: { ...(data || {}), ...(c.data || {}) },
        });

        results.triggered++;
      }

      return {
        success: results.errors.length === 0,
        workflowId: workflow.id,
        workflowName: workflow.name,
        ...results,
      };
    });
}

describe("Workflow Routes", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    enqueuedSteps.length = 0;
    // Clear mock data
    for (const key of Object.keys(mockWorkflows)) {
      delete mockWorkflows[key];
    }
    for (const key of Object.keys(mockContacts)) {
      delete mockContacts[key];
    }
    app = createTestApp();
  });

  describe("POST /v1/workflows/:workflowId/trigger", () => {
    it("should trigger workflow for contact by ID", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Welcome Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-456"] = {
        id: "contact-456",
        email: "test@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: "contact-456" }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.workflowId).toBe("wf-123");
      expect(result.contactId).toBe("contact-456");
      expect(enqueuedSteps).toHaveLength(1);
      expect(enqueuedSteps[0]).toMatchObject({
        type: "trigger",
        workflowId: "wf-123",
        contactId: "contact-456",
      });
    });

    it("should trigger workflow for contact by email", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Welcome Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-456"] = {
        id: "contact-456",
        email: "user@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactEmail: "user@example.com" }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.contactId).toBe("contact-456");
    });

    it("should pass custom data to workflow", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Order Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-456"] = {
        id: "contact-456",
        email: "test@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: "contact-456",
            data: { orderId: "order-789", amount: 99.99 },
          }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(enqueuedSteps[0].eventData).toEqual({
        orderId: "order-789",
        amount: 99.99,
      });
    });

    it("should return error for non-existent workflow", async () => {
      mockContacts["contact-456"] = {
        id: "contact-456",
        email: "test@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-nonexistent/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: "contact-456" }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Workflow not found");
      expect(enqueuedSteps).toHaveLength(0);
    });

    it("should return error for disabled workflow", async () => {
      mockWorkflows["wf-disabled"] = {
        id: "wf-disabled",
        organizationId: "org-123",
        name: "Disabled Flow",
        status: "disabled",
        triggerType: "api",
      };
      mockContacts["contact-456"] = {
        id: "contact-456",
        email: "test@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-disabled/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: "contact-456" }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Workflow is not enabled");
    });

    it("should return error for non-api trigger type", async () => {
      mockWorkflows["wf-event"] = {
        id: "wf-event",
        organizationId: "org-123",
        name: "Event Flow",
        status: "enabled",
        triggerType: "event",
      };
      mockContacts["contact-456"] = {
        id: "contact-456",
        email: "test@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-event/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: "contact-456" }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('trigger type "event"');
    });

    it("should return error for non-existent contact", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Test Flow",
        status: "enabled",
        triggerType: "api",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: "contact-nonexistent" }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Contact not found");
    });

    it("should not find contact from different organization", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Test Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-other"] = {
        id: "contact-other",
        email: "other@example.com",
        organizationId: "org-different", // Different org
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: "contact-other" }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Contact not found");
    });
  });

  describe("POST /v1/workflows/:workflowId/trigger/batch", () => {
    it("should trigger workflow for multiple contacts", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Batch Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-1"] = {
        id: "contact-1",
        email: "user1@example.com",
        organizationId: "org-123",
      };
      mockContacts["contact-2"] = {
        id: "contact-2",
        email: "user2@example.com",
        organizationId: "org-123",
      };
      mockContacts["contact-3"] = {
        id: "contact-3",
        email: "user3@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: [
              { contactId: "contact-1" },
              { contactId: "contact-2" },
              { contactId: "contact-3" },
            ],
          }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.triggered).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(enqueuedSteps).toHaveLength(3);
    });

    it("should support mixed contact ID and email lookup", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Batch Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-1"] = {
        id: "contact-1",
        email: "user1@example.com",
        organizationId: "org-123",
      };
      mockContacts["contact-2"] = {
        id: "contact-2",
        email: "user2@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: [
              { contactId: "contact-1" },
              { contactEmail: "user2@example.com" },
            ],
          }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.triggered).toBe(2);
    });

    it("should pass common and per-contact data", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Batch Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-1"] = {
        id: "contact-1",
        email: "user1@example.com",
        organizationId: "org-123",
      };
      mockContacts["contact-2"] = {
        id: "contact-2",
        email: "user2@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: [
              { contactId: "contact-1", data: { discount: "10%" } },
              { contactId: "contact-2", data: { discount: "20%" } },
            ],
            data: { campaign: "summer-sale" },
          }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(true);

      // Common data + per-contact data should be merged
      expect(enqueuedSteps[0].eventData).toEqual({
        campaign: "summer-sale",
        discount: "10%",
      });
      expect(enqueuedSteps[1].eventData).toEqual({
        campaign: "summer-sale",
        discount: "20%",
      });
    });

    it("should track errors for missing contacts", async () => {
      mockWorkflows["wf-123"] = {
        id: "wf-123",
        organizationId: "org-123",
        name: "Batch Flow",
        status: "enabled",
        triggerType: "api",
      };
      mockContacts["contact-1"] = {
        id: "contact-1",
        email: "user1@example.com",
        organizationId: "org-123",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-123/trigger/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: [
              { contactId: "contact-1" },
              { contactId: "contact-missing" },
              { contactEmail: "missing@example.com" },
            ],
          }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(false); // Has errors
      expect(result.triggered).toBe(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain("Contact not found: contact-missing");
      expect(result.errors).toContain("Contact not found: missing@example.com");
    });

    it("should return error for non-api trigger type", async () => {
      mockWorkflows["wf-schedule"] = {
        id: "wf-schedule",
        organizationId: "org-123",
        name: "Scheduled Flow",
        status: "enabled",
        triggerType: "schedule",
      };

      const response = await app.handle(
        new Request("http://localhost/v1/workflows/wf-schedule/trigger/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: [{ contactId: "contact-1" }],
          }),
        })
      );

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('trigger type "schedule"');
    });
  });
});

describe("Workflow Routes - Security", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    enqueuedSteps.length = 0;
    for (const key of Object.keys(mockWorkflows)) {
      delete mockWorkflows[key];
    }
    for (const key of Object.keys(mockContacts)) {
      delete mockContacts[key];
    }
    app = createTestApp();
  });

  it("should not allow triggering workflow from different organization", async () => {
    mockWorkflows["wf-other-org"] = {
      id: "wf-other-org",
      organizationId: "org-different", // Different org than auth context
      name: "Other Org Flow",
      status: "enabled",
      triggerType: "api",
    };
    mockContacts["contact-456"] = {
      id: "contact-456",
      email: "test@example.com",
      organizationId: "org-123",
    };

    const response = await app.handle(
      new Request("http://localhost/v1/workflows/wf-other-org/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: "contact-456" }),
      })
    );

    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workflow not found");
    expect(enqueuedSteps).toHaveLength(0);
  });
});
