import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let WRAPS_DIR = "";

vi.mock("../shared/fs.js", () => ({
  getWrapsDir: () => WRAPS_DIR,
  ensureWrapsDir: () => Promise.resolve(),
}));

import { checkApiTarget, resolveApiTarget } from "../shared/api-target.js";
import {
  saveAuthConfig,
  saveSelfhostAuth,
  setActiveInstance,
} from "../shared/config.js";

const INSTANCE = "https://wraps.acme.internal";
const INSTANCE_API = "https://abc123.lambda-url.us-east-1.on.aws";

function writeSelfhostConnection(opts: {
  accountId: string;
  region: string;
  appUrl: string;
  apiUrl: string;
}) {
  const dir = join(WRAPS_DIR, "connections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${opts.accountId}-${opts.region}.json`),
    JSON.stringify({
      version: "1.0.0",
      accountId: opts.accountId,
      region: opts.region,
      timestamp: new Date().toISOString(),
      services: {
        selfhost: {
          apiUrl: opts.apiUrl,
          config: { appUrl: opts.appUrl },
        },
      },
    })
  );
}

beforeEach(() => {
  WRAPS_DIR = mkdtempSync(join(tmpdir(), "wraps-target-"));
  delete process.env.WRAPS_API_URL;
  delete process.env.WRAPS_API_KEY;
});

afterEach(() => {
  rmSync(WRAPS_DIR, { recursive: true, force: true });
  delete process.env.WRAPS_API_URL;
  delete process.env.WRAPS_API_KEY;
});

describe("resolveApiTarget", () => {
  it("defaults to the SaaS plane with the SaaS session", async () => {
    await saveAuthConfig({
      auth: { token: "saas-token", tokenType: "session" },
    });

    const target = await resolveApiTarget();

    expect(target.selfhosted).toBe(false);
    expect(target.apiBase).toBe("https://api.wraps.dev");
    expect(target.token).toBe("saas-token");
  });

  it("targets the active self-hosted instance with its own session", async () => {
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
      apiUrl: INSTANCE_API,
    });
    await setActiveInstance(INSTANCE);

    const target = await resolveApiTarget();

    expect(target.selfhosted).toBe(true);
    expect(target.apiBase).toBe(INSTANCE_API);
    expect(target.token).toBe("sh-token");
    expect(target.loginCommand).toBe("wraps selfhost login");
  });

  it("keeps the self-hosted target when a SaaS session also exists", async () => {
    await saveAuthConfig({
      auth: { token: "saas-token", tokenType: "session" },
    });
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
      apiUrl: INSTANCE_API,
    });
    await setActiveInstance(INSTANCE);

    const target = await resolveApiTarget();

    expect(target.apiBase).toBe(INSTANCE_API);
    expect(target.token).toBe("sh-token");
  });

  it("hands back to the SaaS after `auth login` clears the pointer", async () => {
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
      apiUrl: INSTANCE_API,
    });
    await setActiveInstance(INSTANCE);
    await saveAuthConfig({
      auth: { token: "saas-token", tokenType: "session" },
    });
    await setActiveInstance(null);

    const target = await resolveApiTarget();

    expect(target.selfhosted).toBe(false);
    expect(target.token).toBe("saas-token");
  });

  it("adopts a lone pre-pointer self-hosted session (upgrade path)", async () => {
    // Stored by a `selfhost login` that predates `activeInstance` and `apiUrl`:
    // no pointer, no API URL — both must be recovered.
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
    });
    writeSelfhostConnection({
      accountId: "111122223333",
      region: "us-east-1",
      appUrl: INSTANCE,
      apiUrl: INSTANCE_API,
    });

    const target = await resolveApiTarget();

    expect(target.selfhosted).toBe(true);
    expect(target.apiBase).toBe(INSTANCE_API);
    expect(target.token).toBe("sh-token");
  });

  it("stays on the SaaS when a pre-pointer session is ambiguous with it", async () => {
    await saveAuthConfig({
      auth: { token: "saas-token", tokenType: "session" },
    });
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
    });

    const target = await resolveApiTarget();

    expect(target.selfhosted).toBe(false);
    expect(target.token).toBe("saas-token");
  });

  it("lets an explicit WRAPS_API_URL override the active instance", async () => {
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
      apiUrl: INSTANCE_API,
    });
    await setActiveInstance(INSTANCE);
    process.env.WRAPS_API_URL = "http://localhost:3001";

    const target = await resolveApiTarget();

    expect(target.selfhosted).toBe(false);
    expect(target.apiBase).toBe("http://localhost:3001");
  });

  it("reads --token as a credential for the active self-hosted plane", async () => {
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
      apiUrl: INSTANCE_API,
    });
    await setActiveInstance(INSTANCE);

    const target = await resolveApiTarget({ token: "wraps_explicit" });

    expect(target.apiBase).toBe(INSTANCE_API);
    expect(target.token).toBe("wraps_explicit");
  });

  it("reports an expired self-hosted session as needing `selfhost login`", async () => {
    await saveSelfhostAuth(INSTANCE, {
      token: "stale",
      tokenType: "session",
      expiresAt: "2000-01-01T00:00:00.000Z",
      apiUrl: INSTANCE_API,
    });
    await setActiveInstance(INSTANCE);

    const check = checkApiTarget(await resolveApiTarget());

    expect(check.ok).toBe(false);
    expect(check.ok === false && check.suggestion).toBe(
      "Run: wraps selfhost login"
    );
  });

  it("refuses to fall back to the SaaS when the instance API URL is unknown", async () => {
    await saveSelfhostAuth(INSTANCE, {
      token: "sh-token",
      tokenType: "session",
    });
    await setActiveInstance(INSTANCE);

    const target = await resolveApiTarget();
    const check = checkApiTarget(target);

    expect(target.apiBase).toBeNull();
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain(INSTANCE);
  });
});

describe("checkApiTarget", () => {
  it("points a signed-out SaaS user at `auth login`", async () => {
    const check = checkApiTarget(await resolveApiTarget());

    expect(check.ok).toBe(false);
    expect(check.ok === false && check.suggestion).toBe(
      "Run: wraps auth login"
    );
  });

  it("narrows a usable target to non-null URL and token", async () => {
    await saveAuthConfig({
      auth: { token: "saas-token", tokenType: "session" },
    });

    const check = checkApiTarget(await resolveApiTarget());

    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.target.apiBase).toBe("https://api.wraps.dev");
      expect(check.target.token).toBe("saas-token");
    }
  });
});
