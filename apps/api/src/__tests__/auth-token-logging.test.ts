/**
 * Auth Token Logging Security Tests
 *
 * Tests that session tokens are never logged to console,
 * even partially (e.g., first 10 characters).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock database before importing auth module
vi.mock("@wraps/db", () => {
  const makeLimitFn = () => vi.fn(() => []);
  const makeWhereFn = () => vi.fn(() => ({ limit: makeLimitFn() }));
  // Each leftJoin returns an object with both .leftJoin and .where
  const makeJoinable = (): Record<string, ReturnType<typeof vi.fn>> => ({
    leftJoin: vi.fn(() => makeJoinable()),
    where: makeWhereFn(),
  });

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => makeJoinable()),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
    },
    apiKey: {
      id: "id",
      keyHash: "key_hash",
      organizationId: "organization_id",
      createdBy: "created_by",
      expiresAt: "expires_at",
      lastUsedAt: "last_used_at",
    },
    session: {
      id: "id",
      token: "token",
      userId: "user_id",
      expiresAt: "expires_at",
      activeOrganizationId: "active_organization_id",
    },
    member: {
      userId: "user_id",
      organizationId: "organization_id",
      role: "role",
    },
    subscription: {
      referenceId: "reference_id",
      plan: "plan",
      status: "status",
    },
    eq: vi.fn((a, b) => ({ eq: [a, b] })),
    and: vi.fn((...args) => ({ and: args })),
  };
});

// Spy on console.log before importing
const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("Auth Token Logging Security", () => {
  beforeEach(() => {
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  it("does not log any portion of session token to console", async () => {
    const { authenticate } = await import("../middleware/auth");

    const sessionToken = "super-secret-session-token-abc123";
    const request = new Request("http://localhost/v1/contacts", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    await authenticate(request);

    // Check all console.log calls — none should contain any part of the token
    for (const call of consoleSpy.mock.calls) {
      const logMessage = call.join(" ");
      expect(logMessage).not.toContain(sessionToken.slice(0, 10));
      expect(logMessage).not.toContain(sessionToken);
    }
  });

  it("does not log any portion of API key to console", async () => {
    const { authenticate } = await import("../middleware/auth");

    const apiKey = "wraps_live_supersecretkey12345";
    const request = new Request("http://localhost/v1/contacts", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    await authenticate(request);

    // Check all console.log calls — none should contain the key (beyond the public prefix)
    for (const call of consoleSpy.mock.calls) {
      const logMessage = call.join(" ");
      expect(logMessage).not.toContain(apiKey);
      expect(logMessage).not.toContain(apiKey.slice(0, 15));
    }
  });
});
