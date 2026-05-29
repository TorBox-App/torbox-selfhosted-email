import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let WRAPS_DIR = "";

vi.mock("../shared/fs.js", () => ({
  getWrapsDir: () => WRAPS_DIR,
  ensureWrapsDir: () => Promise.resolve(),
}));

import {
  clearSelfhostAuth,
  readAuthConfig,
  readSelfhostAuth,
  resolveSelfhostToken,
  saveAuthConfig,
  saveSelfhostAuth,
} from "../shared/config.js";

const INSTANCE_A = "https://self-host.demo.wraps.dev";
const INSTANCE_B = "https://wraps.acme.internal";

beforeEach(() => {
  WRAPS_DIR = mkdtempSync(join(tmpdir(), "wraps-config-"));
});

afterEach(() => {
  rmSync(WRAPS_DIR, { recursive: true, force: true });
});

describe("per-instance self-hosted auth", () => {
  it("stores and reads a self-hosted session keyed by instance URL", async () => {
    await saveSelfhostAuth(INSTANCE_A, {
      token: "sh-token-a",
      tokenType: "session",
      organizations: [{ id: "o1", name: "Acme", slug: "acme" }],
    });

    const session = await readSelfhostAuth(INSTANCE_A);
    expect(session?.token).toBe("sh-token-a");
    expect(session?.organizations).toEqual([
      { id: "o1", name: "Acme", slug: "acme" },
    ]);
  });

  it("keeps the SaaS slot and self-hosted sessions independent (coexistence)", async () => {
    await saveAuthConfig({
      auth: {
        token: "saas-token",
        tokenType: "session",
        organizations: [{ id: "saas", name: "Wraps", slug: "wraps" }],
      },
    });
    await saveSelfhostAuth(INSTANCE_A, {
      token: "sh-token-a",
      tokenType: "session",
    });

    expect(await resolveSelfhostToken(INSTANCE_A)).toBe("sh-token-a");
    // SaaS token is not returned for a self-hosted instance.
    expect(await readSelfhostAuth(INSTANCE_B)).toBeNull();
  });

  it("isolates sessions across multiple self-hosted instances", async () => {
    await saveSelfhostAuth(INSTANCE_A, {
      token: "sh-a",
      tokenType: "session",
    });
    await saveSelfhostAuth(INSTANCE_B, {
      token: "sh-b",
      tokenType: "session",
    });

    expect(await resolveSelfhostToken(INSTANCE_A)).toBe("sh-a");
    expect(await resolveSelfhostToken(INSTANCE_B)).toBe("sh-b");
  });

  it("treats trailing-slash variants as the same instance", async () => {
    await saveSelfhostAuth(`${INSTANCE_A}/`, {
      token: "sh-slash",
      tokenType: "session",
    });

    expect(await resolveSelfhostToken(INSTANCE_A)).toBe("sh-slash");
  });

  it("returns null for an expired self-hosted token", async () => {
    await saveSelfhostAuth(INSTANCE_A, {
      token: "stale",
      tokenType: "session",
      expiresAt: "2000-01-01T00:00:00.000Z",
    });

    expect(await resolveSelfhostToken(INSTANCE_A)).toBeNull();
  });

  it("returns null when no session exists for the instance", async () => {
    expect(await readSelfhostAuth(INSTANCE_A)).toBeNull();
    expect(await resolveSelfhostToken(INSTANCE_A)).toBeNull();
  });

  it("clears one instance's session without touching SaaS or other instances", async () => {
    await saveAuthConfig({
      auth: { token: "saas-token", tokenType: "session" },
    });
    await saveSelfhostAuth(INSTANCE_A, { token: "sh-a", tokenType: "session" });
    await saveSelfhostAuth(INSTANCE_B, { token: "sh-b", tokenType: "session" });

    await clearSelfhostAuth(INSTANCE_A);

    expect(await readSelfhostAuth(INSTANCE_A)).toBeNull();
    expect(await resolveSelfhostToken(INSTANCE_B)).toBe("sh-b");
    expect((await readAuthConfig())?.auth?.token).toBe("saas-token");
  });

  it("is a no-op when clearing an instance with no stored session", async () => {
    await expect(clearSelfhostAuth(INSTANCE_A)).resolves.toBeUndefined();
  });
});
