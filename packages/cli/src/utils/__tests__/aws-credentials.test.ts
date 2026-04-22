import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @aws-sdk/client-sts so we can control sts.config.credentials at
// construction time. The existing aws.test.ts uses aws-sdk-client-mock to
// intercept *commands* — that doesn't help here because resolveAWSCredentialsToEnv
// pulls credentials directly off the client config without sending any command.
//
// vi.hoisted() is required because vi.mock factories run before any module-
// scope const declarations, so a plain `const mockProvider = vi.fn()` would
// be undefined inside the factory at hoist time.
const { mockCredentialsProvider } = vi.hoisted(() => ({
  mockCredentialsProvider: vi.fn(),
}));

vi.mock("@aws-sdk/client-sts", () => ({
  // Use a real class so `new STSClient(...)` works. Returning an object
  // literal from vi.fn().mockImplementation is callable but not constructable.
  STSClient: class {
    config = {
      credentials: mockCredentialsProvider,
    };
  },
}));

// aws-detection has no bearing on resolveAWSCredentialsToEnv, but importing
// aws.js pulls in validateAWSCredentialsWithDetails which touches the SSO
// cache via detectAWSState. Stub it out so tests don't hit the real fs.
vi.mock("../shared/aws-detection.js", () => ({
  detectAWSState: vi.fn().mockResolvedValue({
    sso: { configured: false, tokenStatus: null, activeProfile: null },
    credentialSource: "environment",
  }),
  getCurrentProfile: vi.fn().mockReturnValue(undefined),
  getConfiguredProfiles: vi.fn().mockReturnValue([]),
  getSSOLoginCommand: vi.fn().mockReturnValue("aws sso login"),
}));

import { resolveAWSCredentialsToEnv } from "../shared/aws.js";
import { WrapsError } from "../shared/errors.js";

describe("resolveAWSCredentialsToEnv", () => {
  // Snapshot env vars we mutate so each test starts from a clean slate.
  const ORIGINAL_ENV = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
    AWS_PROFILE: process.env.AWS_PROFILE,
  };

  beforeEach(() => {
    mockCredentialsProvider.mockReset();
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.AWS_PROFILE;
  });

  afterEach(() => {
    // Restore the real env so we don't leak test state into the runner.
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("clears AWS_PROFILE even when static creds are already set (early return path)", async () => {
    // The exact case the SDK warns on: both static keys *and* AWS_PROFILE set.
    // The previous implementation returned early without clearing AWS_PROFILE,
    // so the warning kept firing on every downstream SDK call.
    process.env.AWS_ACCESS_KEY_ID = "AKIATEST";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.AWS_PROFILE = "default";

    await resolveAWSCredentialsToEnv();

    expect(process.env.AWS_PROFILE).toBeUndefined();
    expect(process.env.AWS_ACCESS_KEY_ID).toBe("AKIATEST");
    expect(process.env.AWS_SECRET_ACCESS_KEY).toBe("secret");
    // No STS client should be constructed in the early-return path.
    expect(mockCredentialsProvider).not.toHaveBeenCalled();
  });

  it("returns early without invoking the provider when static creds are present", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIATEST";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";

    await resolveAWSCredentialsToEnv();

    expect(mockCredentialsProvider).not.toHaveBeenCalled();
  });

  it("resolves credentials from the provider chain and writes them to env", async () => {
    process.env.AWS_PROFILE = "sso-profile";
    mockCredentialsProvider.mockResolvedValue({
      accessKeyId: "ASIATEST",
      secretAccessKey: "ssotempsecret",
      sessionToken: "FwoGZXI...sessiontoken",
    });

    await resolveAWSCredentialsToEnv();

    expect(mockCredentialsProvider).toHaveBeenCalledTimes(1);
    expect(process.env.AWS_ACCESS_KEY_ID).toBe("ASIATEST");
    expect(process.env.AWS_SECRET_ACCESS_KEY).toBe("ssotempsecret");
    expect(process.env.AWS_SESSION_TOKEN).toBe("FwoGZXI...sessiontoken");
    // AWS_PROFILE must be cleared so the SDK v3 "Multiple credential sources"
    // warning doesn't fire on every downstream call.
    expect(process.env.AWS_PROFILE).toBeUndefined();
  });

  it("keeps AWS_PROFILE visible to the credential provider while it resolves", async () => {
    // Regression: an earlier version deleted AWS_PROFILE FIRST, so the SDK
    // chain fell back to the `default` profile. That silently swapped
    // credentials between AWS accounts — a user who ran `AWS_PROFILE=foo
    // wraps email init` ended up deploying with their `default` profile's
    // creds instead. The contract: the provider sees AWS_PROFILE when it
    // runs; AWS_PROFILE is only deleted AFTER static creds are in env.
    process.env.AWS_PROFILE = "test-profile";
    let profileVisibleDuringResolve: string | undefined;
    mockCredentialsProvider.mockImplementation(() => {
      profileVisibleDuringResolve = process.env.AWS_PROFILE;
      return Promise.resolve({
        accessKeyId: "ASIATEST",
        secretAccessKey: "secret",
        sessionToken: "token",
      });
    });

    await resolveAWSCredentialsToEnv();

    expect(profileVisibleDuringResolve).toBe("test-profile");
    expect(process.env.AWS_PROFILE).toBeUndefined();
  });

  it("omits AWS_SESSION_TOKEN when the provider returns long-lived static creds", async () => {
    mockCredentialsProvider.mockResolvedValue({
      accessKeyId: "AKIATEST",
      secretAccessKey: "longlivedsecret",
      // No sessionToken — simulates an IAM user with static keys, not SSO.
    });

    await resolveAWSCredentialsToEnv();

    expect(process.env.AWS_ACCESS_KEY_ID).toBe("AKIATEST");
    expect(process.env.AWS_SECRET_ACCESS_KEY).toBe("longlivedsecret");
    expect(process.env.AWS_SESSION_TOKEN).toBeUndefined();
  });

  it("maps ExpiredTokenException to sessionTokenExpired WrapsError", async () => {
    const expired = new Error("The security token expired");
    expired.name = "ExpiredTokenException";
    mockCredentialsProvider.mockRejectedValue(expired);

    await expect(resolveAWSCredentialsToEnv()).rejects.toThrow(WrapsError);
    await expect(resolveAWSCredentialsToEnv()).rejects.toMatchObject({
      code: "SESSION_TOKEN_EXPIRED",
    });
  });

  it("maps SSOTokenExpired to sessionTokenExpired WrapsError", async () => {
    const expired = new Error("SSO token expired");
    expired.name = "SSOTokenExpired";
    mockCredentialsProvider.mockRejectedValue(expired);

    await expect(resolveAWSCredentialsToEnv()).rejects.toMatchObject({
      code: "SESSION_TOKEN_EXPIRED",
    });
  });

  it("maps TokenRefreshRequired to sessionTokenExpired WrapsError", async () => {
    const refresh = new Error("Token refresh required");
    refresh.name = "TokenRefreshRequired";
    mockCredentialsProvider.mockRejectedValue(refresh);

    await expect(resolveAWSCredentialsToEnv()).rejects.toMatchObject({
      code: "SESSION_TOKEN_EXPIRED",
    });
  });

  it("maps 'Could not load credentials' message to credentialsFileMissing WrapsError", async () => {
    const missing = new Error("Could not load credentials from any providers");
    missing.name = "CredentialsProviderError";
    mockCredentialsProvider.mockRejectedValue(missing);

    await expect(resolveAWSCredentialsToEnv()).rejects.toMatchObject({
      code: "CREDENTIALS_FILE_MISSING",
    });
  });

  it("maps unrecognized errors to noAWSCredentials WrapsError", async () => {
    mockCredentialsProvider.mockRejectedValue(
      new Error("Some unrelated network failure")
    );

    await expect(resolveAWSCredentialsToEnv()).rejects.toMatchObject({
      code: "NO_AWS_CREDENTIALS",
    });
  });

  it("does not match the loose 'expired' substring on unrelated messages", async () => {
    // Regression: a previous version did `error.message?.includes("expired")`
    // which would have falsely matched this. We now key off error.name only.
    const unrelated = new Error("the role expired its trust");
    unrelated.name = "InvalidParameterException";
    mockCredentialsProvider.mockRejectedValue(unrelated);

    await expect(resolveAWSCredentialsToEnv()).rejects.toMatchObject({
      code: "NO_AWS_CREDENTIALS",
    });
  });
});
