import { beforeEach, describe, expect, it, vi } from "vitest";

const isSelfHosted = vi.fn(() => false);
vi.mock("@/lib/plan-limits", () => ({
  isSelfHosted: () => isSelfHosted(),
}));

const errorLog = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: { error: (...args: unknown[]) => errorLog(...args) },
}));

const { aiEnv, logAIConfigIssuesAtBoot } = await import("../env");

beforeEach(() => {
  errorLog.mockClear();
  isSelfHosted.mockReturnValue(false);
  vi.unstubAllEnvs();
});

describe("aiEnv — deployment mode comes from the license, not the env", () => {
  it("reports saas without a license, whatever the process env claims", () => {
    vi.stubEnv("WRAPS_DEPLOYMENT_MODE", "self-hosted");
    expect(aiEnv().WRAPS_DEPLOYMENT_MODE).toBe("saas");
  });

  it("reports self-hosted when the license says so", () => {
    isSelfHosted.mockReturnValue(true);
    expect(aiEnv().WRAPS_DEPLOYMENT_MODE).toBe("self-hosted");
  });
});

describe("logAIConfigIssuesAtBoot", () => {
  it("stays silent on the default gateway config", () => {
    // Stubbed rather than assumed unset: a developer with either var exported
    // would otherwise see this pass or fail for reasons unrelated to the code.
    vi.stubEnv("WRAPS_AI_PROVIDER", "");
    vi.stubEnv("AI_MODEL", "");

    logAIConfigIssuesAtBoot();

    expect(errorLog).not.toHaveBeenCalled();
  });

  it("reports an unknown provider, naming the var to fix", () => {
    vi.stubEnv("WRAPS_AI_PROVIDER", "not-a-provider");

    logAIConfigIssuesAtBoot();

    expect(errorLog).toHaveBeenCalledTimes(1);
    const [context] = errorLog.mock.calls[0] as [
      { event: string; issues: { code: string; envVars: string[] }[] },
    ];
    expect(context.event).toBe("ai.config_invalid");
    expect(context.issues[0]?.code).toBe("unknown_provider");
    expect(context.issues[0]?.envVars).toContain("WRAPS_AI_PROVIDER");
  });

  it("reports a provider whose credentials are missing", () => {
    vi.stubEnv("WRAPS_AI_PROVIDER", "openai");

    logAIConfigIssuesAtBoot();

    const [context] = errorLog.mock.calls[0] as [
      { issues: { code: string }[] },
    ];
    expect(context.issues[0]?.code).toBe("missing_api_key");
  });

  it("reports Bedrock selected on cloud, where the gate rejects it", () => {
    vi.stubEnv("WRAPS_AI_PROVIDER", "bedrock");
    vi.stubEnv("AWS_REGION", "us-east-1");

    logAIConfigIssuesAtBoot();

    const [context] = errorLog.mock.calls[0] as [
      { issues: { code: string }[] },
    ];
    expect(context.issues[0]?.code).toBe("provider_requires_self_hosted");
  });

  it("never throws — a boot-time log must not take the dashboard down", () => {
    vi.stubEnv("WRAPS_AI_PROVIDER", "not-a-provider");
    expect(() => logAIConfigIssuesAtBoot()).not.toThrow();
  });
});
