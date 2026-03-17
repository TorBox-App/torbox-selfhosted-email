/**
 * Unsubscribe Topic IDOR Prevention Tests
 *
 * BUG-023: Topic lookups in unsubscribe routes must be scoped by
 * organizationId to prevent cross-tenant topic name disclosure.
 */

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Track arguments passed to `and()` and `eq()` so we can verify org-scoping
const { mockEq, mockAnd, mockSelectLimit, mockUpdateWhere, selectCallCounter } =
  vi.hoisted(() => ({
    mockEq: vi.fn((a: string, b: string) => ({ eq: [a, b] })),
    mockAnd: vi.fn((...args: unknown[]) => ({ and: args })),
    mockSelectLimit: vi.fn(),
    mockUpdateWhere: vi.fn(),
    selectCallCounter: { count: 0 },
  }));

vi.mock("jose", () => ({
  jwtVerify: vi.fn(async () => ({
    payload: {
      cid: "contact-123",
      oid: "org-A",
      tid: "topic-456",
      type: "unsub",
    },
  })),
  errors: {
    JWTExpired: class JWTExpired extends Error {},
    JWTInvalid: class JWTInvalid extends Error {},
  },
}));

vi.mock("@wraps/db", () => {
  return {
    db: {
      select: vi.fn(() => {
        selectCallCounter.count++;
        const callNumber = selectCallCounter.count;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => {
                return mockSelectLimit(callNumber);
              }),
            })),
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => []),
            })),
          })),
        };
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: mockUpdateWhere,
        })),
      })),
    },
    contact: {
      id: "contact.id",
      email: "contact.email",
      emailStatus: "contact.emailStatus",
      organizationId: "contact.organizationId",
    },
    contactTopic: {
      contactId: "contactTopic.contactId",
      topicId: "contactTopic.topicId",
      status: "contactTopic.status",
    },
    topic: {
      id: "topic.id",
      name: "topic.name",
      organizationId: "topic.organizationId",
    },
    eq: mockEq,
    and: mockAnd,
  };
});

vi.mock("drizzle-orm", () => ({
  and: mockAnd,
}));

vi.mock("../services/workflow-events", () => ({
  emitTopicUnsubscribed: vi.fn(async () => {}),
}));

describe("Unsubscribe Topic IDOR Prevention", () => {
  beforeEach(() => {
    mockEq.mockClear();
    mockAnd.mockClear();
    mockSelectLimit.mockReset();
    mockUpdateWhere.mockReset();
    selectCallCounter.count = 0;
  });

  it("POST topic-specific unsubscribe scopes topic lookup by organizationId", async () => {
    // Call 1: contact lookup → found
    // Call 2: topic lookup → found
    mockSelectLimit.mockImplementation((callNumber: number) => {
      if (callNumber === 1) {
        return [
          {
            id: "contact-123",
            email: "test@example.com",
            emailStatus: "active",
          },
        ];
      }
      if (callNumber === 2) {
        return [{ name: "Newsletter" }];
      }
      return [];
    });

    const { unsubscribeRoutes } = await import("../routes/unsubscribe");
    const app = new Elysia().use(unsubscribeRoutes);

    const response = await app.handle(
      new Request("http://localhost/unsubscribe/valid-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(200);

    // Verify that `and()` was called with both topic.id and topic.organizationId for the topic lookup
    // The topic query should use: and(eq(topic.id, topicId), eq(topic.organizationId, organizationId))
    const andCalls = mockAnd.mock.calls;
    const eqCalls = mockEq.mock.calls;

    // Find the eq call for topic.organizationId
    const topicOrgScopeCall = eqCalls.find(
      ([field, value]) =>
        field === "topic.organizationId" && value === "org-A"
    );

    expect(topicOrgScopeCall).toBeDefined();
  });

  it("GET confirmation page scopes topic lookup by organizationId", async () => {
    // Call 1: contact lookup → found
    // Call 2: topic lookup → found
    mockSelectLimit.mockImplementation((callNumber: number) => {
      if (callNumber === 1) {
        return [
          {
            id: "contact-123",
            email: "test@example.com",
            emailStatus: "active",
          },
        ];
      }
      if (callNumber === 2) {
        return [{ name: "Newsletter" }];
      }
      return [];
    });

    const { unsubscribeRoutes } = await import("../routes/unsubscribe");
    const app = new Elysia().use(unsubscribeRoutes);

    const response = await app.handle(
      new Request("http://localhost/unsubscribe/valid-token", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);

    // Verify that the GET route also scopes topic lookup by organizationId
    const eqCalls = mockEq.mock.calls;

    const topicOrgScopeCall = eqCalls.find(
      ([field, value]) =>
        field === "topic.organizationId" && value === "org-A"
    );

    expect(topicOrgScopeCall).toBeDefined();
  });
});
