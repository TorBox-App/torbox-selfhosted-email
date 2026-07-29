import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiRegistry, getAIModel, resetAIProviderCache } from "../index";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn((id: string) => ({ id })),
}));

const createAnthropic = vi.fn(() => (id: string) => ({ id }));
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: (...args: unknown[]) => createAnthropic(...(args as [])),
}));

const createAmazonBedrock = vi.fn(() => (id: string) => ({ id }));
vi.mock("@ai-sdk/amazon-bedrock", () => ({
  createAmazonBedrock: (...args: unknown[]) =>
    createAmazonBedrock(...(args as [])),
}));

vi.mock("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: () => () => Promise.resolve({}),
}));

beforeEach(() => {
  resetAIProviderCache();
  createAnthropic.mockClear();
  createAmazonBedrock.mockClear();
});

/**
 * Every env var a spec reads has to be part of the resolution cache key, or a
 * second deployment reading a different value is served the first one's
 * provider. The registry derives the key from the specs so the two cannot drift
 * — these cover the vars that were previously missing from a hand-written list.
 */
describe("the provider cache key covers every declared selector", () => {
  it("includes the vars each provider spec declares", () => {
    expect(aiRegistry.selectorEnvVars).toEqual(
      expect.arrayContaining([
        "WRAPS_AI_PROVIDER",
        "WRAPS_DEPLOYMENT_MODE",
        "OPENAI_BASE_URL",
        "ANTHROPIC_BASE_URL",
        "WRAPS_AI_REGION",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
      ])
    );
  });

  it("never lets a credential become cache-key material", () => {
    for (const secret of [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "AI_GATEWAY_API_KEY",
    ]) {
      expect(aiRegistry.selectorEnvVars).not.toContain(secret);
    }
  });

  it("rebuilds the anthropic provider when ANTHROPIC_BASE_URL changes", async () => {
    const env = { WRAPS_AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" };
    await getAIModel({}, { ...env, ANTHROPIC_BASE_URL: "https://a.internal" });
    await getAIModel({}, { ...env, ANTHROPIC_BASE_URL: "https://b.internal" });

    expect(createAnthropic).toHaveBeenCalledTimes(2);
    expect(createAnthropic).toHaveBeenLastCalledWith({
      apiKey: "k",
      baseURL: "https://b.internal",
    });
  });

  it("rebuilds the bedrock provider when the region changes", async () => {
    const env = {
      WRAPS_AI_PROVIDER: "bedrock",
      WRAPS_DEPLOYMENT_MODE: "self-hosted",
    };
    const first = await getAIModel(
      {},
      { ...env, WRAPS_AI_REGION: "us-east-1" }
    );
    const second = await getAIModel(
      {},
      { ...env, WRAPS_AI_REGION: "eu-west-1" }
    );

    // A shared cache entry would pin the second deployment to the us. profile.
    expect(first.modelId).toContain("us.");
    expect(second.modelId).toContain("eu.");
    expect(createAmazonBedrock).toHaveBeenCalledTimes(2);
  });

  it("still reuses the provider when nothing relevant changed", async () => {
    const env = { WRAPS_AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" };
    await getAIModel({}, env);
    await getAIModel({}, env);

    expect(createAnthropic).toHaveBeenCalledTimes(1);
  });
});
