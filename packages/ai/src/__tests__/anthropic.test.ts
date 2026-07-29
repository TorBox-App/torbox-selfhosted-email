import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAIModel, resetAIProviderCache, validateAIConfig } from "../index";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn((id: string) => ({ id })),
}));

const createAnthropic = vi.fn(() => (id: string) => ({ id }));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: (...args: unknown[]) => createAnthropic(...(args as [])),
}));

const ANTHROPIC_ENV = {
  WRAPS_AI_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "sk-ant-test",
};

beforeEach(() => {
  resetAIProviderCache();
  createAnthropic.mockClear();
});

describe("anthropic provider — configuration", () => {
  it("fails validation without a key, naming the var to set", () => {
    const [issue] = validateAIConfig({ WRAPS_AI_PROVIDER: "anthropic" });
    expect(issue?.code).toBe("missing_api_key");
    expect(issue?.envVars).toContain("ANTHROPIC_API_KEY");
  });

  it("never leaks the key value into the issue message", () => {
    const [issue] = validateAIConfig({
      WRAPS_AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "  ",
    });
    expect(issue?.message).not.toContain("sk-ant");
  });

  it("passes validation once the key is present", () => {
    expect(validateAIConfig(ANTHROPIC_ENV)).toEqual([]);
  });

  it("honours ANTHROPIC_BASE_URL for proxied deployments", async () => {
    await getAIModel(
      {},
      { ...ANTHROPIC_ENV, ANTHROPIC_BASE_URL: "https://proxy.internal" }
    );
    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: "sk-ant-test",
      baseURL: "https://proxy.internal",
    });
  });
});

describe("anthropic provider — model resolution", () => {
  it("maps the catalog default to the bare API id, not a gateway slug", async () => {
    const resolved = await getAIModel({}, ANTHROPIC_ENV);
    expect(resolved.providerId).toBe("anthropic");
    expect(resolved.modelId).toBe("claude-sonnet-4-20250514");
    // The namespaced form is a gateway concept and would 404 against the API.
    expect(resolved.modelId).not.toContain("/");
  });

  it("rejects at boot a catalog model Anthropic cannot serve", () => {
    const [issue] = validateAIConfig({
      ...ANTHROPIC_ENV,
      AI_MODEL: "grok-code-fast",
    });
    expect(issue?.code).toBe("unsupported_model_for_provider");
  });

  it("rejects gpt-5 too, since it has no anthropic id", () => {
    const [issue] = validateAIConfig({ ...ANTHROPIC_ENV, AI_MODEL: "gpt-5" });
    expect(issue?.code).toBe("unsupported_model_for_provider");
  });

  it("passes an uncatalogued claude id straight through", async () => {
    const resolved = await getAIModel(
      {},
      { ...ANTHROPIC_ENV, AI_MODEL: "claude-opus-4-1-20250805" }
    );
    expect(resolved.modelId).toBe("claude-opus-4-1-20250805");
    expect(resolved.catalogued).toBe(false);
  });
});

describe("anthropic provider — call options", () => {
  it("sends the thinking block with a token budget", async () => {
    const resolved = await getAIModel(
      { reasoning: { effort: "medium" } },
      ANTHROPIC_ENV
    );
    expect(resolved.providerOptions).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 10_000 } },
    });
  });

  it("offers an explicit cache breakpoint, unlike OpenAI", async () => {
    const resolved = await getAIModel({}, ANTHROPIC_ENV);
    expect(resolved.cache.breakpoint).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  it("omits reasoning options when none was requested", async () => {
    const resolved = await getAIModel({}, ANTHROPIC_ENV);
    expect(resolved.providerOptions).toBeUndefined();
  });
});

describe("provider isolation", () => {
  it("resolves the same catalog key to a different id per provider", async () => {
    const direct = await getAIModel({}, ANTHROPIC_ENV);
    const viaGateway = await getAIModel({}, {});

    expect(direct.modelKey).toBe(viaGateway.modelKey);
    expect(direct.modelId).toBe("claude-sonnet-4-20250514");
    expect(viaGateway.modelId).toBe("anthropic/claude-sonnet-4");
  });
});
