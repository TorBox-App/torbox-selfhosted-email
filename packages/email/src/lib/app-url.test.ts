import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAppUrl } from "./app-url";

beforeEach(() => {
  // Start from a deployment that has configured nothing, so each case controls
  // exactly which variable is present.
  vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
  vi.stubEnv("BETTER_AUTH_URL", undefined);
  vi.stubEnv("APP_BASE_URL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAppUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://a.example");
    vi.stubEnv("BETTER_AUTH_URL", "https://b.example");

    expect(resolveAppUrl()).toBe("https://a.example");
  });

  it("falls back to BETTER_AUTH_URL, which selfhost sets on the web app", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://b.example");

    expect(resolveAppUrl()).toBe("https://b.example");
  });

  it("falls back to APP_BASE_URL, which selfhost sets on the workers", () => {
    vi.stubEnv("APP_BASE_URL", "https://c.example");

    expect(resolveAppUrl()).toBe("https://c.example");
  });

  it("treats an empty value as unset rather than building a bare-path link", () => {
    // SST injects "" before the first deploy pass has URLs to bake in.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("APP_BASE_URL", "https://c.example");

    expect(resolveAppUrl()).toBe("https://c.example");
  });

  it("strips trailing slashes so callers can append a path", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://a.example//");

    expect(resolveAppUrl()).toBe("https://a.example");
  });

  it("throws instead of defaulting to the Wraps platform", () => {
    expect(() => resolveAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => resolveAppUrl()).not.toThrow(/wraps\.dev/);
  });
});
