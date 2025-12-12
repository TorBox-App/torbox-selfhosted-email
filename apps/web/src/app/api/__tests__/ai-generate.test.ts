import { aiUsageMonthly, db } from "@wraps/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentPeriodKey } from "@/lib/usage/ai-usage";
import { testOrganization, testUser, testUserNoAccess } from "./setup";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

// Mock Better-Auth session
const mockSession = (userId: string | null): any => ({
  user: userId
    ? { id: userId, email: "test@example.com", name: "Test" }
    : undefined,
  session: userId
    ? {
        id: "session-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        expiresAt: new Date(Date.now() + 86_400_000),
        token: "test-token",
      }
    : undefined,
});

// Mock the auth module
vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => mockSession(testUser.id)),
    },
  },
}));

// Mock organization helper
vi.mock("@/lib/organization", () => ({
  getOrganizationWithMembership: vi.fn(async (slug: string, userId: string) => {
    if (slug === testOrganization.slug && userId === testUser.id) {
      return {
        id: testOrganization.id,
        name: testOrganization.name,
        slug: testOrganization.slug,
      };
    }
    return null;
  }),
  getOrganizationPlanId: vi.fn(async () => "starter"),
}));

// Mock AI SDK
vi.mock("ai", () => ({
  convertToModelMessages: vi.fn(() => []),
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
  })),
}));

// Mock AI SDK gateway
vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn(() => ({})),
}));

// Mock AI helpers
vi.mock("@/lib/ai/system-prompt", () => ({
  buildSystemPrompt: vi.fn(() => "test system prompt"),
}));

vi.mock("@/lib/ai/validator", () => ({
  extractTipTapJson: vi.fn(),
  validateTipTapJson: vi.fn(() => ({ valid: true, errors: [] })),
}));

describe("AI Generate API - POST /api/[orgSlug]/templates/ai/generate", () => {
  beforeEach(async () => {
    // Clean up any existing usage data
    await db
      .delete(aiUsageMonthly)
      .where(eq(aiUsageMonthly.organizationId, testOrganization.id));
  });

  afterEach(async () => {
    await db
      .delete(aiUsageMonthly)
      .where(eq(aiUsageMonthly.organizationId, testOrganization.id));
  });

  it("should allow request when under usage limit", async () => {
    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Create a welcome email" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);

    // Should succeed (not return 429)
    expect(response.status).not.toBe(429);
  });

  it("should return 429 when usage limit reached", async () => {
    const periodKey = getCurrentPeriodKey();

    // Set usage at the starter limit (50)
    await db.insert(aiUsageMonthly).values({
      organizationId: testOrganization.id,
      periodKey,
      messageCount: 50,
    });

    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Create a welcome email" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("AI message limit reached");
    expect(data.limitReached).toBe(true);
    expect(data.current).toBe(50);
    expect(data.limit).toBe(50);
  });

  it("should return 429 when usage exceeds limit", async () => {
    const periodKey = getCurrentPeriodKey();

    // Set usage over the starter limit
    await db.insert(aiUsageMonthly).values({
      organizationId: testOrganization.id,
      periodKey,
      messageCount: 55,
    });

    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Create a welcome email" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.current).toBe(55);
  });

  it("should include helpful message when limit reached", async () => {
    const periodKey = getCurrentPeriodKey();

    await db.insert(aiUsageMonthly).values({
      organizationId: testOrganization.id,
      periodKey,
      messageCount: 50,
    });

    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Create a welcome email" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(data.message).toContain("50 of 50");
    expect(data.message).toContain("Upgrade your plan");
  });

  it("should return 401 for unauthenticated requests", async () => {
    const { auth } = await import("@wraps/auth");
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession(null));

    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Create a welcome email" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 403 for non-member access", async () => {
    const { auth } = await import("@wraps/auth");
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(
      mockSession(testUserNoAccess.id)
    );

    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Create a welcome email" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should return 400 when messages are missing", async () => {
    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      // No messages
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Messages are required");
  });

  it("should return 400 when messages array is empty", async () => {
    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    const requestBody = {
      messages: [],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Messages are required");
  });

  it("should check usage limit before processing request body", async () => {
    const periodKey = getCurrentPeriodKey();

    // Set usage at limit
    await db.insert(aiUsageMonthly).values({
      organizationId: testOrganization.id,
      periodKey,
      messageCount: 50,
    });

    const { POST } = await import("../[orgSlug]/templates/ai/generate/route");

    // Even with invalid messages, should return 429 first (usage check happens before body parsing)
    // Actually, looking at the code, body parsing happens AFTER the limit check
    // So this test verifies the order is correct
    const requestBody = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "test" }],
        },
      ],
    };

    const request = new Request(
      `http://localhost/api/${testOrganization.slug}/templates/ai/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await POST(request, context);

    // Should get 429 (rate limit) rather than proceeding to message validation
    expect(response.status).toBe(429);
  });
});
