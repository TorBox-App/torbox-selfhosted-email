/**
 * Unit tests for the orgAction `feature` gate option.
 *
 * All collaborators are mocked so no DB/session is needed.
 * Verifies: denied path, allowed path, self-hosted path, and gate order.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyOrgAccess, mockCheckPermission, mockCheckFeatureAccess } =
  vi.hoisted(() => ({
    mockVerifyOrgAccess: vi.fn(),
    mockCheckPermission: vi.fn(),
    mockCheckFeatureAccess: vi.fn(),
  }));

vi.mock("@/actions/shared/verify-org-access", () => ({
  verifyOrgAccess: mockVerifyOrgAccess,
}));

vi.mock("@/actions/shared/permissions", () => ({
  checkPermission: mockCheckPermission,
}));

vi.mock("@/lib/plan-limits", () => ({
  checkFeatureAccess: mockCheckFeatureAccess,
}));

vi.mock("@wraps/db", () => ({
  db: {
    transaction: vi.fn(),
    insert: vi.fn(),
  },
  auditLog: {},
}));

vi.mock("@/lib/audit", () => ({
  auditLogEntry: vi.fn(),
  getAuditContext: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { orgAction } = await import("../shared/org-action");

const OWNER_ACCESS = {
  role: "owner",
  orgSlug: "test-org",
  userId: "user-123",
  userEmail: "test@example.com",
};

describe("orgAction — feature gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: permission check passes
    mockCheckPermission.mockReturnValue(null);
  });

  it("1. denied: returns error message and does not call handler when feature not allowed", async () => {
    const handler = vi.fn(async () => ({ success: true as const }));
    mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      requiredPlan: "scale",
      message: "SSO & SCIM provisioning requires a Scale plan.",
    });

    const action = orgAction(
      {
        name: "testFeatureDenied",
        resource: "sso",
        permission: ["write"],
        orgId: (orgId: string) => orgId,
        onError: "Something went wrong.",
        feature: "sso",
      },
      handler
    );

    const result = await action("org-123");

    expect(result).toEqual({
      success: false,
      error: "SSO & SCIM provisioning requires a Scale plan.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("2. allowed: handler runs and its result is returned", async () => {
    const handler = vi.fn(async () => ({
      success: true as const,
      data: "ok",
    }));
    mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: true,
      requiredPlan: null,
    });

    const action = orgAction(
      {
        name: "testFeatureAllowed",
        resource: "sso",
        permission: ["write"],
        orgId: (orgId: string) => orgId,
        onError: "Something went wrong.",
        feature: "sso",
      },
      handler
    );

    const result = await action("org-123");

    expect(result).toEqual({ success: true, data: "ok" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("3. self-hosted: handler runs when checkFeatureAccess resolves allowed:true", async () => {
    const handler = vi.fn(async () => ({ success: true as const }));
    mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
    // isSelfHosted() short-circuits inside checkFeatureAccess; we model the
    // result it would return: allowed:true with no message.
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });

    const action = orgAction(
      {
        name: "testSelfHosted",
        resource: "sso",
        permission: ["write"],
        orgId: (orgId: string) => orgId,
        onError: "Something went wrong.",
        feature: "sso",
      },
      handler
    );

    const result = await action("org-123");

    expect(result.success).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("4. order: checkFeatureAccess is not called when verifyOrgAccess returns null", async () => {
    const handler = vi.fn(async () => ({ success: true as const }));
    mockVerifyOrgAccess.mockResolvedValue(null);

    const action = orgAction(
      {
        name: "testGateOrder",
        resource: "sso",
        permission: ["write"],
        orgId: (orgId: string) => orgId,
        onError: "Something went wrong.",
        feature: "sso",
      },
      handler
    );

    const result = await action("org-123");

    expect(result).toEqual({
      success: false,
      error: "You don't have access to this organization",
    });
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
