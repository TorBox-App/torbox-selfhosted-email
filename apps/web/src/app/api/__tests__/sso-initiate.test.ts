import { db, ssoProvider } from "@wraps/db";
import { organization } from "@wraps/db/schema/auth";
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

// Boundary mock: auth.api.signInSSO would hit real Okta OIDC discovery
const mockSignInSSO = vi.fn();
vi.mock("@wraps/auth", () => ({
  auth: {
    api: {
      signInSSO: mockSignInSSO,
    },
  },
}));

const TEST_ORG_ID = "test-sso-initiate-org-1";
const TEST_ISSUER = "https://torbox.okta.com/oauth2/default";
const TEST_PROVIDER_ID = "torbox.com";
const OKTA_AUTH_URL =
  "https://torbox.okta.com/oauth2/default/v1/authorize?client_id=abc&state=xyz";

beforeAll(async () => {
  await db
    .insert(organization)
    .values({
      id: TEST_ORG_ID,
      name: "SSO Initiate Test Org",
      slug: "sso-initiate-test-org",
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(ssoProvider)
    .values({
      id: "test-sso-initiate-provider-1",
      providerId: TEST_PROVIDER_ID,
      issuer: TEST_ISSUER,
      domain: "torbox.com",
      organizationId: TEST_ORG_ID,
      domainVerified: true,
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(ssoProvider)
    .where(eq(ssoProvider.id, "test-sso-initiate-provider-1"));
  await db.delete(organization).where(eq(organization.id, TEST_ORG_ID));
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInSSO.mockResolvedValue({ url: OKTA_AUTH_URL, redirect: true });
});

describe("GET /api/sso/initiate", () => {
  it("redirects to Okta auth URL for a valid registered and verified issuer", async () => {
    const { GET } = await import("../sso/initiate/route");

    const req = new Request(
      `http://localhost/api/sso/initiate?iss=${encodeURIComponent(TEST_ISSUER)}`
    );

    const response = await GET(req);

    expect(response.headers.get("location")).toBe(OKTA_AUTH_URL);
    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ providerId: TEST_PROVIDER_ID }),
      })
    );
  });

  it("redirects to /sign-in when iss param is missing", async () => {
    const { GET } = await import("../sso/initiate/route");

    const req = new Request("http://localhost/api/sso/initiate");
    const response = await GET(req);

    expect(response.headers.get("location")).toContain("/sign-in");
    expect(mockSignInSSO).not.toHaveBeenCalled();
  });

  it("redirects to /sign-in when iss is not registered", async () => {
    const { GET } = await import("../sso/initiate/route");

    const req = new Request(
      "http://localhost/api/sso/initiate?iss=https://unknown.okta.com/oauth2/default"
    );
    const response = await GET(req);

    expect(response.headers.get("location")).toContain("/sign-in");
    expect(mockSignInSSO).not.toHaveBeenCalled();
  });

  it("redirects to /sign-in when domain is not verified", async () => {
    await db
      .insert(ssoProvider)
      .values({
        id: "test-sso-initiate-provider-unverified",
        providerId: "unverified.com",
        issuer: "https://unverified.okta.com/oauth2/default",
        domain: "unverified.com",
        organizationId: TEST_ORG_ID,
        domainVerified: false,
      })
      .onConflictDoNothing();

    try {
      const { GET } = await import("../sso/initiate/route");
      const req = new Request(
        "http://localhost/api/sso/initiate?iss=https://unverified.okta.com/oauth2/default"
      );
      const response = await GET(req);

      expect(response.headers.get("location")).toContain("/sign-in");
      expect(mockSignInSSO).not.toHaveBeenCalled();
    } finally {
      await db
        .delete(ssoProvider)
        .where(eq(ssoProvider.id, "test-sso-initiate-provider-unverified"));
    }
  });

  it("uses target_link_uri as callbackURL when it is on app.wraps.dev", async () => {
    const { GET } = await import("../sso/initiate/route");

    const target = "https://app.wraps.dev/torbox/templates";
    const req = new Request(
      `http://localhost/api/sso/initiate?iss=${encodeURIComponent(TEST_ISSUER)}&target_link_uri=${encodeURIComponent(target)}`
    );
    const response = await GET(req);

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: target }),
      })
    );
  });

  it("ignores target_link_uri on an external domain and defaults callbackURL to /", async () => {
    const { GET } = await import("../sso/initiate/route");

    const malicious = "https://evil.com/steal-tokens";
    const req = new Request(
      `http://localhost/api/sso/initiate?iss=${encodeURIComponent(TEST_ISSUER)}&target_link_uri=${encodeURIComponent(malicious)}`
    );
    const response = await GET(req);

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: "/" }),
      })
    );
  });

  it("forwards login_hint to auth.api", async () => {
    const { GET } = await import("../sso/initiate/route");

    const req = new Request(
      `http://localhost/api/sso/initiate?iss=${encodeURIComponent(TEST_ISSUER)}&login_hint=wamy%40torbox.com`
    );
    const response = await GET(req);

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ loginHint: "wamy@torbox.com" }),
      })
    );
  });
});
