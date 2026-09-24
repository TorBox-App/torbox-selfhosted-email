/**
 * better-auth swallows its own failures: OAuth callbacks log and redirect to
 * `?error=internal_server_error`, endpoints log and answer 500. Without a
 * custom logger none of it reached Sentry, and the 1.7.1 `account.issuer`
 * break stopped every signup for nine days unnoticed.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("@wraps/email", () => ({ getWrapsClient: vi.fn() }));

describe("better-auth error reporting", () => {
  let auth: typeof import("../index").auth;

  beforeAll(async () => {
    ({ auth } = await import("../index"));
  }, 60_000);

  beforeEach(() => {
    captureException.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("reports the error better-auth logs internally", async () => {
    const ctx = await auth.$context;
    const failure = new Error('The field "issuer" does not exist');

    ctx.logger.error("Better auth was unable to query your database.", failure);

    expect(captureException).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ tags: { feature: "better-auth" } })
    );
  });

  it("reports message-only errors as a synthetic Error", async () => {
    const ctx = await auth.$context;

    ctx.logger.error("OAuth account references a missing user.");

    const [reported] = captureException.mock.calls[0] ?? [];
    expect(reported).toBeInstanceOf(Error);
    expect((reported as Error).message).toContain(
      "OAuth account references a missing user."
    );
  });

  it("does not report warnings", async () => {
    const ctx = await auth.$context;

    ctx.logger.warn("rate limit nearly reached");

    expect(captureException).not.toHaveBeenCalled();
  });
});
