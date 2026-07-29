import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAIModel, resetAIProviderCache, validateAIConfig } from "../index";
import {
  applyInferenceProfile,
  describeBedrockError,
} from "../providers/bedrock";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn((id: string) => ({ id })),
}));

const createAmazonBedrock = vi.fn(() => (id: string) => ({ id }));
const fromNodeProviderChain = vi.fn(() => () => Promise.resolve({}));

vi.mock("@ai-sdk/amazon-bedrock", () => ({
  createAmazonBedrock: (...args: unknown[]) =>
    createAmazonBedrock(...(args as [])),
}));

vi.mock("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: (...args: unknown[]) =>
    fromNodeProviderChain(...(args as [])),
}));

const SELF_HOSTED = {
  WRAPS_AI_PROVIDER: "bedrock",
  WRAPS_DEPLOYMENT_MODE: "self-hosted",
  AWS_REGION: "us-east-1",
};

beforeEach(() => {
  resetAIProviderCache();
  createAmazonBedrock.mockClear();
  fromNodeProviderChain.mockClear();
});

describe("bedrock is gated to self-hosted deployments", () => {
  it("is rejected on Wraps Cloud even with a region present", () => {
    const [issue] = validateAIConfig({
      WRAPS_AI_PROVIDER: "bedrock",
      AWS_REGION: "us-east-1",
    });
    expect(issue?.code).toBe("provider_requires_self_hosted");
  });

  it("is rejected when the mode is explicitly saas", () => {
    const [issue] = validateAIConfig({
      ...SELF_HOSTED,
      WRAPS_DEPLOYMENT_MODE: "saas",
    });
    expect(issue?.code).toBe("provider_requires_self_hosted");
  });

  it("names both vars the operator would look at", () => {
    const [issue] = validateAIConfig({ WRAPS_AI_PROVIDER: "bedrock" });
    expect(issue?.envVars).toContain("WRAPS_AI_PROVIDER");
    expect(issue?.envVars).toContain("WRAPS_DEPLOYMENT_MODE");
  });

  it("runs the gate before the spec, so a missing region is not what's reported", () => {
    // Otherwise a Cloud operator would be told to set AWS_REGION and would
    // keep trying, instead of learning the provider is unavailable at all.
    const [issue] = validateAIConfig({ WRAPS_AI_PROVIDER: "bedrock" });
    expect(issue?.code).not.toBe("missing_region");
  });

  it("is allowed once the deployment is self-hosted", () => {
    expect(validateAIConfig(SELF_HOSTED)).toEqual([]);
  });

  it("does not gate the other providers", () => {
    expect(
      validateAIConfig({
        WRAPS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-test",
      })
    ).toEqual([]);
  });
});

describe("bedrock configuration", () => {
  it("requires a region and says which vars supply it", () => {
    const [issue] = validateAIConfig({
      WRAPS_AI_PROVIDER: "bedrock",
      WRAPS_DEPLOYMENT_MODE: "self-hosted",
    });
    expect(issue?.code).toBe("missing_region");
    expect(issue?.envVars).toContain("WRAPS_AI_REGION");
  });

  it("prefers WRAPS_AI_REGION over the ambient AWS_REGION", async () => {
    await getAIModel({}, { ...SELF_HOSTED, WRAPS_AI_REGION: "eu-west-1" });
    expect(createAmazonBedrock).toHaveBeenCalledWith(
      expect.objectContaining({ region: "eu-west-1" })
    );
  });

  it("uses the deployment's own credential chain, not an assume-role", async () => {
    await getAIModel({}, SELF_HOSTED);
    // Borrowing the customer's SES-connected account would bill inference to a
    // budget they scoped for email.
    expect(fromNodeProviderChain).toHaveBeenCalled();
    expect(createAmazonBedrock).toHaveBeenCalledWith(
      expect.objectContaining({ credentialProvider: expect.any(Function) })
    );
  });

  it("builds the client once per provider, not per request", async () => {
    await getAIModel({}, SELF_HOSTED);
    await getAIModel({}, SELF_HOSTED);
    expect(createAmazonBedrock).toHaveBeenCalledTimes(1);
  });
});

describe("bedrock call options", () => {
  it("uses the bedrock namespace, never anthropic", async () => {
    const resolved = await getAIModel(
      { reasoning: { effort: "medium" } },
      SELF_HOSTED
    );
    // Bedrock silently ignores an `anthropic` block: no error, reasoning just
    // disappears. This assertion is the only thing that catches that.
    expect(resolved.providerOptions).not.toHaveProperty("anthropic");
    expect(resolved.providerOptions).toEqual({
      bedrock: { reasoningConfig: { type: "enabled", budgetTokens: 10_000 } },
    });
  });

  it("uses cachePoint rather than anthropic cacheControl", async () => {
    const resolved = await getAIModel({}, SELF_HOSTED);
    expect(resolved.cache.breakpoint).toEqual({
      bedrock: { cachePoint: { type: "default" } },
    });
  });
});

describe("describeBedrockError", () => {
  it("points an AccessDenied at model access, not at credentials", () => {
    const original = new Error(
      "AccessDeniedException: You don't have access to the model with the specified model ID."
    );
    const rewritten = describeBedrockError(original, "eu-central-1") as Error;

    expect(rewritten.message).toContain("Model access");
    expect(rewritten.message).toContain("eu-central-1");
    // IAM is granted by our own infra, so pointing there wastes the operator's
    // time — that is the whole reason this rewrite exists.
    expect(rewritten.message).toContain("IAM permissions are granted");
  });

  it("preserves the original error as the cause", () => {
    const original = new Error("AccessDeniedException: nope");
    const rewritten = describeBedrockError(original, "us-east-1") as Error;
    expect(rewritten.cause).toBe(original);
    expect(rewritten.message).toContain("AccessDeniedException: nope");
  });

  it("leaves unrelated errors untouched", () => {
    const original = new Error("ThrottlingException: slow down");
    expect(describeBedrockError(original, "us-east-1")).toBe(original);
  });

  it("does not throw on a non-Error value", () => {
    expect(() => describeBedrockError("weird", "us-east-1")).not.toThrow();
  });
});

describe("applyInferenceProfile", () => {
  const BARE = "anthropic.claude-sonnet-4-20250514-v1:0";

  it("prepends us. in a US region", () => {
    expect(applyInferenceProfile(BARE, "us-east-1", true)).toBe(`us.${BARE}`);
  });

  it("prepends eu. in an EU region", () => {
    expect(applyInferenceProfile(BARE, "eu-central-1", true)).toBe(
      `eu.${BARE}`
    );
  });

  it("prepends apac. in an Asia-Pacific region", () => {
    expect(applyInferenceProfile(BARE, "ap-southeast-2", true)).toBe(
      `apac.${BARE}`
    );
  });

  it("leaves the id alone in an unmapped region rather than guessing", () => {
    // AWS extends this mapping without notice; a wrong prefix is a hard failure
    // whereas the bare id at least works where profiles are not required.
    expect(applyInferenceProfile(BARE, "sa-east-1", true)).toBe(BARE);
  });

  it("never rewrites an operator-supplied passthrough id", () => {
    expect(applyInferenceProfile("some.custom-model", "us-east-1", false)).toBe(
      "some.custom-model"
    );
  });

  it("does not double-prefix an id that already has one", () => {
    expect(applyInferenceProfile(`us.${BARE}`, "us-east-1", true)).toBe(
      `us.${BARE}`
    );
  });

  it("leaves a full profile ARN untouched", () => {
    const arn = "arn:aws:bedrock:us-east-1:1234:inference-profile/foo";
    expect(applyInferenceProfile(arn, "us-east-1", true)).toBe(arn);
  });

  it("applies the profile to the id actually sent on the wire", async () => {
    const resolved = await getAIModel({}, SELF_HOSTED);
    expect(resolved.modelId).toBe(`us.${BARE}`);
    // modelKey stays provider-neutral so analytics can still group across
    // providers.
    expect(resolved.modelKey).toBe("claude-sonnet-4");
  });
});
