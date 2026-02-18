/**
 * Unsubscribe XSS Security Tests
 *
 * Tests that topic names are HTML-escaped in unsubscribe pages
 * to prevent stored XSS attacks against email recipients.
 */

import { describe, expect, it, vi } from "vitest";

// Mock jose for token verification
vi.mock("jose", () => ({
  jwtVerify: vi.fn(async () => ({
    payload: {
      cid: "contact-123",
      oid: "org-123",
      tid: "topic-xss",
      type: "unsub",
    },
  })),
  errors: {
    JWTExpired: class JWTExpired extends Error {},
    JWTInvalid: class JWTInvalid extends Error {},
  },
}));

// Mock database
const mockContact = {
  id: "contact-123",
  email: "victim@example.com",
  emailStatus: "active",
};

const XSS_TOPIC_NAME = '<script>alert("XSS")</script>';

vi.mock("@wraps/db", () => {
  const selectHandlers: Record<string, () => unknown[]> = {
    contact: () => [mockContact],
    topic: () => [{ name: XSS_TOPIC_NAME }],
  };

  let currentTable = "";

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: { toString: () => string } | string) => {
          // Determine which table is being queried
          const tableName = typeof table === "string" ? table : String(table);
          if (tableName.includes("topic") || table === "name") {
            currentTable = "topic";
          } else {
            currentTable = "contact";
          }
          return {
            where: vi.fn(() => ({
              limit: vi.fn(() => selectHandlers[currentTable]?.() ?? []),
            })),
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => []),
              })),
            })),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => []),
        })),
      })),
    },
    contact: "contact",
    contactTopic: "contact_topic",
    topic: "topic",
    eq: vi.fn(),
    and: vi.fn(),
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
}));

vi.mock("../services/workflow-events", () => ({
  emitTopicUnsubscribed: vi.fn(async () => {}),
}));

describe("Unsubscribe XSS Prevention", () => {
  it("escapes topic name containing script tags in the confirmation page", async () => {
    const { unsubscribeRoutes } = await import("../routes/unsubscribe");
    const { Elysia } = await import("elysia");

    const app = new Elysia().use(unsubscribeRoutes);

    const response = await app.handle(
      new Request("http://localhost/unsubscribe/valid-token", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    const html = await response.text();

    // The raw script tag must NOT appear in the HTML
    expect(html).not.toContain('<script>alert("XSS")</script>');

    // The escaped version should appear instead
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes topic name containing HTML attributes in the confirmation page", async () => {
    // This test uses the same mock (script tag topic name) but validates
    // that no unescaped angle brackets from the topic name exist
    const { unsubscribeRoutes } = await import("../routes/unsubscribe");
    const { Elysia } = await import("elysia");

    const app = new Elysia().use(unsubscribeRoutes);

    const response = await app.handle(
      new Request("http://localhost/unsubscribe/valid-token", {
        method: "GET",
      })
    );

    const html = await response.text();

    // Extract the topic span content — find the .topic span
    const topicMatch = html.match(/<span class="topic">([\s\S]*?)<\/span>/);
    expect(topicMatch).not.toBeNull();
    if (topicMatch) {
      const topicContent = topicMatch[1];
      // Topic content must not contain raw < or > from user input
      expect(topicContent).not.toMatch(/<script/i);
      // The escaped form should be present
      expect(topicContent).toContain("&lt;script&gt;");
    }
  });
});
