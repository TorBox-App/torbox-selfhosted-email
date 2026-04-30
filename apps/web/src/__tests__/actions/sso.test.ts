import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockVerifyOrgAccess,
  mockRegisterSSOProvider,
  mockDeleteSSOProvider,
  mockRequestDomainVerification,
  mockVerifyDomainApi,
  mockGenerateSCIMToken,
  mockFindFirst,
} = vi.hoisted(() => ({
  mockVerifyOrgAccess: vi.fn(),
  mockRegisterSSOProvider: vi.fn(),
  mockDeleteSSOProvider: vi.fn(),
  mockRequestDomainVerification: vi.fn(),
  mockVerifyDomainApi: vi.fn(),
  mockGenerateSCIMToken: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
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

vi.mock("@wraps/db", () => ({
  db: { query: { ssoProvider: { findFirst: mockFindFirst } } },
  and: vi.fn(),
  eq: vi.fn(),
  ssoProvider: {},
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
      expect(result).toEqual({ success: false, error: "Unauthorized" });
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
      expect(result).toEqual({ success: false, error: "TXT record not found" });
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
            providerId: "provider-1",
            organizationId: TEST_ORG_ID,
          }),
        })
      );
    });
  });
});
