import { db, ssoProvider } from "@wraps/db";
import { organization } from "@wraps/db/schema/auth";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
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

afterEach(() => {
  // The redirect allowlist is derived from the environment, so every case that
  // stubs it must not leak into the next one.
  vi.unstubAllEnvs();
});

/**
 * Drive the route the way an IdP does. `requestHost` matters: the allowlist
 * falls back to the request's own host when nothing is configured.
 */
async function initiate(params: {
  requestHost?: string;
  targetLinkUri?: string;
}): Promise<Response> {
  const { GET } = await import("../sso/initiate/route");
  const search = new URLSearchParams({ iss: TEST_ISSUER });
  if (params.targetLinkUri) {
    search.set("target_link_uri", params.targetLinkUri);
  }
  return await GET(
    new Request(
      `${params.requestHost ?? "http://localhost"}/api/sso/initiate?${search}`
    )
  );
}

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

  it("uses target_link_uri as callbackURL when it is on the deployment's own host", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.wraps.dev");

    const target = "https://app.wraps.dev/torbox/templates";
    const response = await initiate({
      requestHost: "https://app.wraps.dev",
      targetLinkUri: target,
    });

    expect(response.headers.get("location")).toBe(OKTA_AUTH_URL);
    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: target }),
      })
    );
  });

  // The whole point of deriving the allowlist: a self-hosted deployment's SSO
  // settings page tells the customer to paste its OWN callback into their IdP,
  // and a hardcoded app.wraps.dev rejected it and silently dropped them on "/".
  it("accepts a self-hosted deployment's own host", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://wraps.torbox.app");

    const target = "https://wraps.torbox.app/torbox/templates";
    await initiate({
      requestHost: "https://wraps.torbox.app",
      targetLinkUri: target,
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: target }),
      })
    );
  });

  it("rejects the Wraps platform's host on a self-hosted deployment", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://wraps.torbox.app");

    await initiate({
      requestHost: "https://wraps.torbox.app",
      targetLinkUri: "https://app.wraps.dev/torbox/templates",
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: "/" }),
      })
    );
  });

  it("falls back to BETTER_AUTH_URL, the only URL the selfhost web app always sets", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("BETTER_AUTH_URL", "https://wraps.torbox.app");

    const target = "https://wraps.torbox.app/torbox/templates";
    await initiate({
      requestHost: "https://wraps.torbox.app",
      targetLinkUri: target,
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: target }),
      })
    );
  });

  it("does not let the request's host widen a configured allowlist", async () => {
    // Reflecting the incoming host would turn this into an open redirect on any
    // proxy that forwards an attacker-supplied X-Forwarded-Host.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://wraps.torbox.app");
    vi.stubEnv("BETTER_AUTH_URL", "");

    await initiate({
      requestHost: "https://evil.com",
      targetLinkUri: "https://evil.com/steal-tokens",
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: "/" }),
      })
    );
  });

  it("accepts its own host when nothing is configured yet", async () => {
    // First selfhost deploy pass: SST injects "" because the URLs do not exist
    // until the stack is up.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("BETTER_AUTH_URL", "");

    const target = "https://d111.cloudfront.net/torbox/templates";
    await initiate({
      requestHost: "https://d111.cloudfront.net",
      targetLinkUri: target,
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: target }),
      })
    );
  });

  it("stops reflecting the request's host in production", async () => {
    // The unconfigured fallback above is a development convenience. Left open in
    // production it is an open redirect on any proxy that forwards an
    // attacker-supplied X-Forwarded-Host — Next builds req.url from that header,
    // so the reflected host would allowlist itself.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("BETTER_AUTH_URL", "");

    await initiate({
      requestHost: "https://evil.com",
      targetLinkUri: "https://evil.com/steal-tokens",
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: "/" }),
      })
    );
  });

  it("still honors a configured host in production", async () => {
    // Closing the fallback must not close the normal path: this is the case
    // every real deployment hits.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://wraps.torbox.app");

    const target = "https://wraps.torbox.app/torbox/templates";
    await initiate({
      requestHost: "https://wraps.torbox.app",
      targetLinkUri: target,
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: target }),
      })
    );
  });

  it("stops accepting localhost in production", async () => {
    // An IdP redirect to a local listener is a session hand-off to whatever is
    // running on the victim's machine.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.wraps.dev");

    await initiate({
      requestHost: "https://app.wraps.dev",
      targetLinkUri: "http://localhost:6666/steal-tokens",
    });

    expect(mockSignInSSO).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: "/" }),
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
