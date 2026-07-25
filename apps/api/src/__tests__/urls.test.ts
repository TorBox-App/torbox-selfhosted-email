import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveApiUrl, resolveAppUrl } from "../lib/urls";

/**
 * Three call sites hand these values to the customer's own infrastructure: the
 * `.well-known` device-flow document, the SES webhook endpoint returned by
 * POST /v1/connections, and the OpenAPI `servers` list. Each was hardcoded to
 * wraps.dev, so a self-hosted deployment pointed its customer's CLI, AWS
 * account and generated clients at the platform.
 *
 * apps/api/vitest.config.ts dotenv-loads apps/web/.env.test, which already sets
 * NEXT_PUBLIC_APP_URL — so every case stubs explicitly rather than inheriting.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveApiUrl", () => {
  it("uses the deployment's own API URL", () => {
    vi.stubEnv("WRAPS_API_URL", "https://api.selfhost.example.com");

    expect(resolveApiUrl()).toBe("https://api.selfhost.example.com");
  });

  it("falls back to the platform when unset", () => {
    vi.stubEnv("WRAPS_API_URL", undefined);

    expect(resolveApiUrl()).toBe("https://api.wraps.dev");
  });

  it("treats SST's empty-string injection as unset", () => {
    // infra/selfhost.config.ts injects "" before the first deploy pass has URLs
    // to bake in. A bare "" would make every caller build a relative path.
    vi.stubEnv("WRAPS_API_URL", "");

    expect(resolveApiUrl()).toBe("https://api.wraps.dev");
  });

  it("strips a pasted trailing slash so callers can append a path", () => {
    vi.stubEnv("WRAPS_API_URL", "https://api.selfhost.example.com//");

    expect(`${resolveApiUrl()}/webhooks/ses/123456789012`).toBe(
      "https://api.selfhost.example.com/webhooks/ses/123456789012"
    );
  });
});

describe("resolveAppUrl", () => {
  it("uses the deployment's own dashboard URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://web.selfhost.example.com");

    expect(resolveAppUrl()).toBe("https://web.selfhost.example.com");
  });

  it("falls back to the platform when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(resolveAppUrl()).toBe("https://app.wraps.dev");
  });

  it("strips a pasted trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://web.selfhost.example.com/");

    expect(`${resolveAppUrl()}/api/auth/device/code`).toBe(
      "https://web.selfhost.example.com/api/auth/device/code"
    );
  });
});
