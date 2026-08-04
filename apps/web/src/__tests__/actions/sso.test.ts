import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockVerifyOrgAccess,
  mockRegisterSSOProvider,
  mockDeleteSSOProvider,
  mockRequestDomainVerification,
  mockVerifyDomainApi,
  mockGenerateSCIMToken,
  mockFindFirst,
  mockDelete,
} = vi.hoisted(() => ({
  mockVerifyOrgAccess: vi.fn(),
  mockRegisterSSOProvider: vi.fn(),
  mockDeleteSSOProvider: vi.fn(),
  mockRequestDomainVerification: vi.fn(),
  mockVerifyDomainApi: vi.fn(),
  mockGenerateSCIMToken: vi.fn(),
  mockFindFirst: vi.fn(),
  mockDelete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock("@/lib/plan-limits", () => ({
  checkFeatureAccess: vi
    .fn()
    .mockResolvedValue({ allowed: true, requiredPlan: null }),
}));

vi.mock("@/actions/shared/verify-org-access", () => ({
  verifyOrgAccess: mockVerifyOrgAccess,
}));

vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      registerSSOProvider: mockRegisterSSOProvider,
      deleteSSOProvider: mockDeleteSSOProvider,
      requestDomainVerification: mockRequestDomainVerification,
      verifyDomain: mockVerifyDomainApi,
      generateSCIMToken: mockGenerateSCIMToken,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockTx = {
  delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
  }),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
  query: { ssoProvider: { findFirst: mockFindFirst } },
};

vi.mock("@wraps/db", () => ({
  db: {
    query: { ssoProvider: { findFirst: mockFindFirst } },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    delete: mockDelete,
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
        cb(mockTx)
      ),
  },
  and: vi.fn(),
  eq: vi.fn(),
  ssoProvider: {},
  scimProvider: {},
  auditLog: {},
  scimToken: {},
}));

const {
  saveSsoProvider,
  deleteSsoProvider,
  requestDomainVerification,
  verifyDomain,
  generateScimToken,
} = await import("@/actions/sso");

const OWNER_ACCESS = {
  role: "owner",
  orgSlug: "test-org",
  userId: "user-123",
  userEmail: "test@example.com",
};
const MEMBER_ACCESS = {
  role: "member",
  orgSlug: "test-org",
  userId: "user-456",
  userEmail: "test2@example.com",
};
const TEST_ORG_ID = "test-org-123";
const EXISTING_PROVIDER = {
  id: "sso-1",
  providerId: "provider-1",
  organizationId: TEST_ORG_ID,
};

describe("SSO Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveSsoProvider", () => {
    it("returns error when user is not admin", async () => {
      mockVerifyOrgAccess.mockResolvedValue(MEMBER_ACCESS);
      const result = await saveSsoProvider(TEST_ORG_ID, {
        domain: "company.com",
        issuer: "https://dev-123.okta.com",
        clientId: "client123",
        clientSecret: "secret123",
      });
      expect(result).toEqual({
        success: false,
        error: "You don't have permission to perform this action",
      });
    });

    it("calls registerSSOProvider with correct body and returns success for admin", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockRegisterSSOProvider.mockResolvedValue({
        id: "provider-1",
        domain: "company.com",
      });
      const result = await saveSsoProvider(TEST_ORG_ID, {
        domain: "company.com",
        issuer: "https://dev-123.okta.com",
        clientId: "client123",
        clientSecret: "secret123",
      });
      expect(result.success).toBe(true);
      expect(mockRegisterSSOProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            domain: "company.com",
            issuer: "https://dev-123.okta.com",
            organizationId: TEST_ORG_ID,
            oidcConfig: { clientId: "client123", clientSecret: "secret123" },
          }),
        })
      );
    });

    /**
     * better-auth refuses OIDC discovery against any origin outside
     * `trustedOrigins` and reports it by naming that config — a server-side
     * array the admin clicking Save cannot see. Every IdP outside the built-in
     * allowlist (Okta custom domain, self-hosted Keycloak) arrives here, so the
     * message has to name the knob that fixes it.
     */
    it("rewrites better-auth's untrusted-origin error into an actionable one", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      const { APIError } = await import("better-auth/api");
      mockRegisterSSOProvider.mockRejectedValue(
        new APIError("BAD_REQUEST", {
          message:
            'Untrusted OIDC discovery URL: The main discovery endpoint "https://login.acme.com/.well-known/openid-configuration" is not trusted by your trusted origins configuration.',
        })
      );
      const result = await saveSsoProvider(TEST_ORG_ID, {
        domain: "acme.com",
        issuer: "https://login.acme.com",
        clientId: "client123",
        clientSecret: "secret123",
      });
      expect(result.success).toBe(false);
      const error = (result as { error: string }).error;
      expect(error).toContain("WRAPS_SSO_TRUSTED_ORIGINS");
      expect(error).toContain(
        "https://login.acme.com/.well-known/openid-configuration"
      );
      expect(error).not.toContain("trusted origins configuration");
    });

    it("leaves other better-auth messages untouched", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      const { APIError } = await import("better-auth/api");
      mockRegisterSSOProvider.mockRejectedValue(
        new APIError("BAD_REQUEST", {
          message: "SSO provider with this providerId already exists",
        })
      );
      const result = await saveSsoProvider(TEST_ORG_ID, {
        domain: "acme.com",
        issuer: "https://acme.okta.com",
        clientId: "client123",
        clientSecret: "secret123",
      });
      expect(result).toEqual({
        success: false,
        error: "SSO provider with this providerId already exists",
      });
    });
  });

  describe("deleteSsoProvider", () => {
    it("returns error when user is not admin", async () => {
      mockVerifyOrgAccess.mockResolvedValue(MEMBER_ACCESS);
      const result = await deleteSsoProvider(TEST_ORG_ID, "provider-1");
      expect(result).toEqual({
        success: false,
        error: "You don't have permission to perform this action",
      });
    });

    it("returns error when provider does not belong to org", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(null);
      const result = await deleteSsoProvider(TEST_ORG_ID, "other-org-provider");
      expect(result).toEqual({ success: false, error: "Provider not found" });
    });

    it("deletes provider and revalidates correct path for admin", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      mockDeleteSSOProvider.mockResolvedValue({});
      const { revalidatePath } = await import("next/cache");
      const result = await deleteSsoProvider(TEST_ORG_ID, "provider-1");
      expect(result.success).toBe(true);
      expect(mockDeleteSSOProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ providerId: "provider-1" }),
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/test-org/settings/sso");
    });
  });

  describe("requestDomainVerification", () => {
    it("maps domainVerificationToken from API response to token in result", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      const mockToken = "dns-verify-token-abc123";
      // API returns { domainVerificationToken }, NOT { token } — guard against regressions
      mockRequestDomainVerification.mockResolvedValue({
        domainVerificationToken: mockToken,
      });
      const result = await requestDomainVerification(TEST_ORG_ID, "provider-1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.token).toBe(mockToken);
        // expiresAt computed locally as 7 days from now
        const expiresAt = new Date(result.expiresAt);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        expect(expiresAt.getTime()).toBeGreaterThan(
          Date.now() + sevenDays - 5000
        );
        expect(expiresAt.getTime()).toBeLessThan(Date.now() + sevenDays + 5000);
      }
    });

    it("returns error when unauthorized", async () => {
      mockVerifyOrgAccess.mockResolvedValue(null);
      const result = await requestDomainVerification(TEST_ORG_ID, "provider-1");
      expect(result).toEqual({
        success: false,
        error: "You don't have access to this organization",
      });
    });

    it("returns error when provider not found in org", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(null);
      const result = await requestDomainVerification(
        TEST_ORG_ID,
        "other-provider"
      );
      expect(result).toEqual({ success: false, error: "Provider not found" });
    });
  });

  describe("verifyDomain", () => {
    it("returns success when TXT record found", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      mockVerifyDomainApi.mockResolvedValue({ verified: true });
      const result = await verifyDomain(TEST_ORG_ID, "provider-1");
      expect(result.success).toBe(true);
      expect(mockVerifyDomainApi).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ providerId: "provider-1" }),
        })
      );
    });

    it("returns error when domain verification fails", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      mockVerifyDomainApi.mockRejectedValue(new Error("TXT record not found"));
      const result = await verifyDomain(TEST_ORG_ID, "provider-1");
      expect(result).toEqual({
        success: false,
        error: "Something went wrong. Please try again.",
      });
    });
  });

  describe("generateScimToken", () => {
    it("returns error when user is not admin", async () => {
      mockVerifyOrgAccess.mockResolvedValue(MEMBER_ACCESS);
      const result = await generateScimToken(TEST_ORG_ID, "provider-1");
      expect(result).toEqual({
        success: false,
        error: "You don't have permission to perform this action",
      });
    });

    it("calls generateSCIMToken and returns token for admin", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      mockGenerateSCIMToken.mockResolvedValue({ scimToken: "scim_token_xyz" });
      const result = await generateScimToken(TEST_ORG_ID, "provider-1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.token).toBe("scim_token_xyz");
      }
      expect(mockGenerateSCIMToken).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            organizationId: TEST_ORG_ID,
          }),
        })
      );
    });

    // better-auth >=1.6 rejects any SCIM providerId that already exists in
    // sso_provider. We only offer SCIM once an SSO provider is verified, so
    // reusing the SSO id made this fail 100% of the time.
    it("never reuses the SSO provider id as the SCIM provider id", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      mockGenerateSCIMToken.mockResolvedValue({ scimToken: "scim_token_xyz" });
      await generateScimToken(TEST_ORG_ID, "provider-1");
      const { body } = mockGenerateSCIMToken.mock.calls[0][0];
      expect(body.providerId).not.toBe("provider-1");
      expect(body.providerId).toBe(`scim-${TEST_ORG_ID}`);
    });

    it("revokes a legacy row keyed by the SSO provider id before rotating", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      mockGenerateSCIMToken.mockResolvedValue({ scimToken: "scim_token_xyz" });
      await generateScimToken(TEST_ORG_ID, "provider-1");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("surfaces the better-auth error message instead of a generic failure", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      const { APIError } = await import("better-auth/api");
      mockGenerateSCIMToken.mockRejectedValue(
        new APIError("BAD_REQUEST", {
          message:
            "Provider id collides with another account provider and cannot be used for SCIM",
        })
      );
      const result = await generateScimToken(TEST_ORG_ID, "provider-1");
      expect(result).toEqual({
        success: false,
        error:
          "Provider id collides with another account provider and cannot be used for SCIM",
      });
    });

    it("still hides non-APIError failures behind the generic message", async () => {
      mockVerifyOrgAccess.mockResolvedValue(OWNER_ACCESS);
      mockFindFirst.mockResolvedValue(EXISTING_PROVIDER);
      mockGenerateSCIMToken.mockRejectedValue(
        new Error('relation "scim_provider" does not exist')
      );
      const result = await generateScimToken(TEST_ORG_ID, "provider-1");
      expect(result).toEqual({
        success: false,
        error: "Failed to generate SCIM token",
      });
    });
  });
});
