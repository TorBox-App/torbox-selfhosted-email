import { Elysia } from "elysia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wellKnownRoutes } from "../routes/well-known";

/**
 * RFC 8414 OAuth Authorization Server Metadata. The values are env-derived so a
 * self-hosted deployment advertises its OWN device-flow endpoints — pointing a
 * customer's users at app.wraps.dev hands their device codes to a server that
 * has never heard of them.
 *
 * apps/api/vitest.config.ts dotenv-loads apps/web/.env.test, which already sets
 * NEXT_PUBLIC_APP_URL — so every case below stubs both vars explicitly rather
 * than inheriting whatever the ambient env happens to hold.
 */
const fetchDoc = async () => {
  const app = new Elysia().use(wellKnownRoutes);
  const response = await app.handle(
    new Request("http://localhost/.well-known/oauth-authorization-server")
  );
  expect(response.status).toBe(200);
  return response.json();
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /.well-known/oauth-authorization-server", () => {
  it("advertises the self-hosted deployment's own endpoints", async () => {
    vi.stubEnv("WRAPS_API_URL", "https://api.selfhost.example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://web.selfhost.example.com");

    const doc = await fetchDoc();

    expect(doc.issuer).toBe("https://api.selfhost.example.com");
    expect(doc.device_authorization_endpoint).toBe(
      "https://web.selfhost.example.com/api/auth/device/code"
    );
    expect(doc.token_endpoint).toBe(
      "https://web.selfhost.example.com/api/auth/device/token"
    );
    // No auth endpoint may point at the platform on a self-hosted deployment.
    expect(doc.device_authorization_endpoint).not.toContain("wraps.dev");
    expect(doc.token_endpoint).not.toContain("wraps.dev");
    expect(doc.issuer).not.toContain("wraps.dev");
  });

  it("treats SST's empty-string injection as unset, not as a bare path", async () => {
    // infra/selfhost.config.ts injects "" before the first deploy pass has URLs
    // to bake in. That must fall back, not produce "/api/auth/device/code".
    vi.stubEnv("WRAPS_API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    const doc = await fetchDoc();

    expect(doc.issuer).toBe("https://api.wraps.dev");
    expect(doc.device_authorization_endpoint).toBe(
      "https://app.wraps.dev/api/auth/device/code"
    );
  });

  it("normalizes a trailing slash instead of emitting a double slash", async () => {
    // Operators paste these into .env.selfhost; // routes differently than /.
    vi.stubEnv("WRAPS_API_URL", "https://api.selfhost.example.com/");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://web.selfhost.example.com/");

    const doc = await fetchDoc();

    expect(doc.issuer).toBe("https://api.selfhost.example.com");
    expect(doc.device_authorization_endpoint).toBe(
      "https://web.selfhost.example.com/api/auth/device/code"
    );
    expect(doc.token_endpoint).not.toContain("//api/auth");
  });

  it("keeps the static grant and documentation fields intact", async () => {
    vi.stubEnv("WRAPS_API_URL", "https://api.selfhost.example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://web.selfhost.example.com");

    const doc = await fetchDoc();

    expect(doc.grant_types_supported).toEqual([
      "urn:ietf:params:oauth:grant-type:device_code",
    ]);
    expect(doc.token_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(doc.service_documentation).toBe("https://wraps.dev/docs");
  });
});
