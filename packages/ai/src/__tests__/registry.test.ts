import { describe, expect, it, vi } from "vitest";
import {
  createRegistry,
  fail,
  isProviderConfigError,
  memoizeAsync,
  ok,
  type ProviderSpec,
} from "../registry";

type Fake = { readonly id: string };

const alpha: ProviderSpec<Fake> = {
  id: "alpha",
  label: "Alpha",
  prepare: () => ok(() => Promise.resolve({ id: "alpha" })),
};

const needsKey: ProviderSpec<Fake> = {
  id: "needs-key",
  label: "Needs key",
  prepare: (env) =>
    env.FAKE_KEY
      ? ok(() => Promise.resolve({ id: "needs-key" }))
      : fail({
          code: "missing_key",
          message: "Set FAKE_KEY.",
          envVars: ["FAKE_KEY"],
        }),
};

const registry = createRegistry<Fake>({
  domain: "fake",
  selectorEnvVar: "FAKE_PROVIDER",
  defaultId: "alpha",
  specs: [alpha, needsKey],
  gate: (id, env) =>
    id === "needs-key" && env.MODE !== "self-hosted"
      ? {
          code: "provider_requires_self_hosted",
          message: 'The "needs-key" provider is only available self-hosted.',
          envVars: ["FAKE_PROVIDER", "MODE"],
        }
      : undefined,
});

describe("createRegistry", () => {
  it("falls back to the default provider when the selector is unset", async () => {
    await expect(registry.resolve({})).resolves.toEqual({ id: "alpha" });
  });

  it("treats an empty or whitespace selector as unset", async () => {
    await expect(registry.resolve({ FAKE_PROVIDER: "   " })).resolves.toEqual({
      id: "alpha",
    });
  });

  it("matches the selector case-insensitively", async () => {
    await expect(registry.resolve({ FAKE_PROVIDER: "ALPHA" })).resolves.toEqual(
      { id: "alpha" }
    );
  });

  it("reports an unknown provider and lists the valid ids", () => {
    const [issue] = registry.validate({ FAKE_PROVIDER: "nope" });
    expect(issue?.code).toBe("unknown_provider");
    expect(issue?.message).toContain("alpha");
    expect(issue?.message).toContain("needs-key");
  });

  it("applies the gate before the spec's own validation", () => {
    // FAKE_KEY is present, so only the gate can reject this.
    const [issue] = registry.validate({
      FAKE_PROVIDER: "needs-key",
      FAKE_KEY: "k",
    });
    expect(issue?.code).toBe("provider_requires_self_hosted");
  });

  it("passes the gate and then surfaces the spec's own issue", () => {
    const [issue] = registry.validate({
      FAKE_PROVIDER: "needs-key",
      MODE: "self-hosted",
    });
    expect(issue?.code).toBe("missing_key");
  });

  it("resolves once gate and spec both pass", async () => {
    await expect(
      registry.resolve({
        FAKE_PROVIDER: "needs-key",
        MODE: "self-hosted",
        FAKE_KEY: "k",
      })
    ).resolves.toEqual({ id: "needs-key" });
  });

  it("validate() returns an empty array for a good config", () => {
    expect(registry.validate({ FAKE_PROVIDER: "alpha" })).toEqual([]);
  });

  it("validate() never throws, even on a broken config", () => {
    expect(() => registry.validate({ FAKE_PROVIDER: "nope" })).not.toThrow();
  });

  it("resolve() throws a tagged ProviderConfigError carrying the issues", async () => {
    const error = await registry
      .resolve({ FAKE_PROVIDER: "nope" })
      .catch((e: unknown) => e);
    expect(isProviderConfigError(error)).toBe(true);
    if (isProviderConfigError(error)) {
      expect(error.domain).toBe("fake");
      expect(error.issues[0]?.code).toBe("unknown_provider");
    }
  });

  it("does not instantiate anything during validate()", () => {
    const prepare = vi.fn(() => ok(() => Promise.resolve({ id: "spy" })));
    const spied = createRegistry<Fake>({
      domain: "fake",
      selectorEnvVar: "P",
      defaultId: "spy",
      specs: [{ id: "spy", label: "Spy", prepare }],
    });
    const thunk = vi.fn();
    spied.validate({});
    expect(prepare).toHaveBeenCalled();
    expect(thunk).not.toHaveBeenCalled();
  });

  it("exposes the registered ids", () => {
    expect(registry.ids).toEqual(["alpha", "needs-key"]);
  });

  it("collects selector env vars from the selector, the gate and every spec", () => {
    const collected = createRegistry<Fake>({
      domain: "fake",
      selectorEnvVar: "FAKE_PROVIDER",
      defaultId: "alpha",
      specs: [
        { ...alpha, selectorEnvVars: ["ALPHA_BASE_URL"] },
        { ...needsKey, selectorEnvVars: ["NEEDS_REGION"] },
      ],
      gateEnvVars: ["MODE"],
    }).selectorEnvVars;

    expect(collected).toEqual([
      "FAKE_PROVIDER",
      "MODE",
      "ALPHA_BASE_URL",
      "NEEDS_REGION",
    ]);
  });

  it("dedupes env vars two specs both read", () => {
    const collected = createRegistry<Fake>({
      domain: "fake",
      selectorEnvVar: "P",
      defaultId: "alpha",
      specs: [
        { ...alpha, selectorEnvVars: ["AWS_REGION"] },
        { ...needsKey, selectorEnvVars: ["AWS_REGION"] },
      ],
    }).selectorEnvVars;

    expect(collected).toEqual(["P", "AWS_REGION"]);
  });
});

describe("memoizeAsync", () => {
  it("runs the factory once across concurrent callers", async () => {
    const factory = vi.fn(() => Promise.resolve({ id: "once" }));
    const memoized = memoizeAsync(factory);
    await Promise.all([memoized(), memoized(), memoized()]);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("stays retryable after a rejection instead of caching the failure", async () => {
    let attempt = 0;
    const memoized = memoizeAsync(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error("transient"))
        : Promise.resolve({ id: "recovered" });
    });

    await expect(memoized()).rejects.toThrow("transient");
    await expect(memoized()).resolves.toEqual({ id: "recovered" });
    expect(attempt).toBe(2);
  });
});
