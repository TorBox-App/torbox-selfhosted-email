import { describe, expect, it, vi } from "vitest";
import { testOrganization, testUser, testUserNoAccess } from "./setup";

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

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

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => mockSession(testUser.id)),
    },
  },
}));

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
}));

vi.mock("@/lib/activation-tracking", () => ({
  computeActivationScore: vi.fn(async () => ({
    score: 3,
    milestones: {
      hasTemplate: true,
      hasBroadcast: false,
      hasContact: true,
      hasTeammateInvited: false,
      hasAwsAccount: true,
      hasVerifiedDomain: false,
      hasSentEmail: false,
    },
  })),
}));

describe("Activation API - GET /api/[orgSlug]/activation/status", () => {
  it("should return activation score and milestones for authorized user", async () => {
    const { GET } = await import("../[orgSlug]/activation/status/route");

    const request = new Request(
      "http://localhost/api/onboarding-test-org/activation/status"
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.score).toBe(3);
    expect(data.milestones).toEqual({
      hasTemplate: true,
      hasBroadcast: false,
      hasContact: true,
      hasTeammateInvited: false,
      hasAwsAccount: true,
      hasVerifiedDomain: false,
      hasSentEmail: false,
    });
    expect(data).toHaveProperty("onboardingPath");
  });

  it("should return 401 for unauthenticated requests", async () => {
    const { auth } = await import("@wraps/auth");
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession(null));

    const { GET } = await import("../[orgSlug]/activation/status/route");

    const request = new Request(
      "http://localhost/api/onboarding-test-org/activation/status"
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    expect(response.status).toBe(401);
  });

  it("should return 403 for non-member access", async () => {
    const { auth } = await import("@wraps/auth");
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(
      mockSession(testUserNoAccess.id)
    );

    const { GET } = await import("../[orgSlug]/activation/status/route");

    const request = new Request(
      "http://localhost/api/onboarding-test-org/activation/status"
    );
    const context = {
      params: Promise.resolve({ orgSlug: testOrganization.slug }),
    };

    const response = await GET(request, context);
    expect(response.status).toBe(403);
  });
});
