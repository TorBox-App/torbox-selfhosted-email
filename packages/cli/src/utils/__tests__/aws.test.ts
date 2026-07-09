import {
  GetIdentityVerificationAttributesCommand,
  ListIdentitiesCommand,
  SESClient,
} from "@aws-sdk/client-ses";
import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRegion,
  getAWSRegion,
  getSESAccountStatus,
  isSESSandbox,
  listSESDomains,
  validateAWSCredentials,
} from "../shared/aws.js";
import { detectAWSState } from "../shared/aws-detection.js";
import { WrapsError } from "../shared/errors.js";

// Mock aws-detection to prevent real filesystem reads (SSO cache, AWS config)
vi.mock("../shared/aws-detection.js", () => ({
  detectAWSState: vi.fn().mockResolvedValue({
    cliInstalled: true,
    cliVersion: "2.15.0",
    credentialsConfigured: true,
    credentialSource: "environment",
    profileName: "default",
    accountId: "123456789012",
    detectedProvider: null,
    region: "us-east-1",
    sso: {
      configured: false,
      profiles: [],
      sessions: [],
      tokenStatus: null,
      activeProfile: null,
    },
  }),
  getCurrentProfile: vi.fn().mockReturnValue("default"),
  getConfiguredProfiles: vi.fn().mockReturnValue([]),
  getSSOLoginCommand: vi.fn().mockReturnValue("aws sso login"),
}));

const stsMock = mockClient(STSClient);
const sesMock = mockClient(SESClient);
const sesv2Mock = mockClient(SESv2Client);

describe("validateAWSCredentials", () => {
  beforeEach(() => {
    stsMock.reset();
  });

  it("should return identity when credentials are valid", async () => {
    stsMock.on(GetCallerIdentityCommand).resolves({
      Account: "123456789012",
      UserId: "AIDAI123456789",
      Arn: "arn:aws:iam::123456789012:user/test",
    });

    const result = await validateAWSCredentials();

    expect(result).toEqual({
      accountId: "123456789012",
      userId: "AIDAI123456789",
      arn: "arn:aws:iam::123456789012:user/test",
    });
  });

  it("should throw WrapsError when credentials are invalid", async () => {
    stsMock
      .on(GetCallerIdentityCommand)
      .rejects(new Error("Invalid credentials"));

    await expect(validateAWSCredentials()).rejects.toThrow(WrapsError);
    await expect(validateAWSCredentials()).rejects.toThrow(
      "AWS credentials not found"
    );
  });

  it("should throw WrapsError when STS call fails", async () => {
    stsMock.on(GetCallerIdentityCommand).rejects(new Error("Network error"));

    await expect(validateAWSCredentials()).rejects.toThrow(WrapsError);
  });
});

describe("validateAWSCredentials SSO pre-checks vs env credentials", () => {
  const ORIGINAL_ENV = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  };

  const expiredSSOState = {
    cliInstalled: true,
    cliVersion: "2.15.0",
    credentialsConfigured: false,
    credentialSource: null,
    profileName: null,
    accountId: null,
    detectedProvider: null,
    region: "us-east-1",
    sso: {
      configured: true,
      profiles: [],
      sessions: [],
      tokenStatus: { valid: false, expired: true, minutesRemaining: null },
      activeProfile: { name: "work" },
    },
  };

  beforeEach(() => {
    stsMock.reset();
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("reports the env credentials' actual failure, not SSO expiry, when env credentials are set", async () => {
    // Static env credentials outrank SSO in the SDK chain. A machine with an
    // expired SSO session must not mask an invalid-access-key failure.
    process.env.AWS_ACCESS_KEY_ID = "AKIABOGUS";
    process.env.AWS_SECRET_ACCESS_KEY = "bogussecret";
    // biome-ignore lint/suspicious/noExplicitAny: partial AWSSetupState is sufficient for this path
    vi.mocked(detectAWSState).mockResolvedValueOnce(expiredSSOState as any);
    const invalidKey = new Error("The security token is invalid");
    invalidKey.name = "InvalidClientTokenId";
    stsMock.on(GetCallerIdentityCommand).rejects(invalidKey);

    await expect(validateAWSCredentials()).rejects.toMatchObject({
      code: "ACCESS_KEY_INVALID",
    });
  });

  it("proceeds to STS when env credentials are set even if SSO is expired", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIAVALID";
    process.env.AWS_SECRET_ACCESS_KEY = "validsecret";
    // biome-ignore lint/suspicious/noExplicitAny: partial AWSSetupState is sufficient for this path
    vi.mocked(detectAWSState).mockResolvedValueOnce(expiredSSOState as any);
    stsMock.on(GetCallerIdentityCommand).resolves({
      Account: "123456789012",
      UserId: "AIDAI123456789",
      Arn: "arn:aws:iam::123456789012:user/test",
    });

    const result = await validateAWSCredentials();

    expect(result.accountId).toBe("123456789012");
  });

  it("still reports SSO expiry when no env credentials are set", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: partial AWSSetupState is sufficient for this path
    vi.mocked(detectAWSState).mockResolvedValueOnce(expiredSSOState as any);

    await expect(validateAWSCredentials()).rejects.toMatchObject({
      code: "SSO_SESSION_EXPIRED",
    });
  });
});

describe("checkRegion", () => {
  it("should return true for valid US regions", async () => {
    expect(await checkRegion("us-east-1")).toBe(true);
    expect(await checkRegion("us-east-2")).toBe(true);
    expect(await checkRegion("us-west-1")).toBe(true);
    expect(await checkRegion("us-west-2")).toBe(true);
  });

  it("should return true for valid EU regions", async () => {
    expect(await checkRegion("eu-west-1")).toBe(true);
    expect(await checkRegion("eu-central-1")).toBe(true);
    expect(await checkRegion("eu-north-1")).toBe(true);
  });

  it("should return true for valid Asia Pacific regions", async () => {
    expect(await checkRegion("ap-southeast-1")).toBe(true);
    expect(await checkRegion("ap-northeast-1")).toBe(true);
  });

  it("should return false for invalid regions", async () => {
    expect(await checkRegion("invalid-region")).toBe(false);
    expect(await checkRegion("us-east-3")).toBe(false);
    expect(await checkRegion("")).toBe(false);
    expect(await checkRegion("foo-bar-1")).toBe(false);
  });

  it("should be case sensitive", async () => {
    expect(await checkRegion("US-EAST-1")).toBe(false);
    expect(await checkRegion("us-EAST-1")).toBe(false);
  });
});

describe("getAWSRegion", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return AWS_REGION if set", async () => {
    process.env.AWS_REGION = "us-west-2";
    const region = await getAWSRegion();
    expect(region).toBe("us-west-2");
  });

  it("should return AWS_DEFAULT_REGION if AWS_REGION is not set", async () => {
    process.env.AWS_REGION = undefined;
    process.env.AWS_DEFAULT_REGION = "eu-west-1";
    const region = await getAWSRegion();
    expect(region).toBe("eu-west-1");
  });

  it("should prefer AWS_REGION over AWS_DEFAULT_REGION", async () => {
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_DEFAULT_REGION = "us-west-1";
    const region = await getAWSRegion();
    expect(region).toBe("us-east-1");
  });

  it("should default to us-east-1 if no environment variables are set", async () => {
    process.env.AWS_REGION = undefined;
    process.env.AWS_DEFAULT_REGION = undefined;
    const region = await getAWSRegion();
    expect(region).toBe("us-east-1");
  });
});

describe("listSESDomains", () => {
  beforeEach(() => {
    sesMock.reset();
  });

  it("should return empty array when no domains exist", async () => {
    sesMock.on(ListIdentitiesCommand).resolves({
      Identities: [],
    });

    const domains = await listSESDomains("us-east-1");
    expect(domains).toEqual([]);
  });

  it("should return domains with verification status", async () => {
    sesMock
      .on(ListIdentitiesCommand)
      .resolves({
        Identities: ["example.com", "test.com"],
      })
      .on(GetIdentityVerificationAttributesCommand)
      .resolves({
        VerificationAttributes: {
          "example.com": { VerificationStatus: "Success" },
          "test.com": { VerificationStatus: "Pending" },
        },
      });

    const domains = await listSESDomains("us-east-1");

    expect(domains).toEqual([
      { domain: "example.com", verified: true },
      { domain: "test.com", verified: false },
    ]);
  });

  it("should handle missing verification attributes", async () => {
    sesMock
      .on(ListIdentitiesCommand)
      .resolves({
        Identities: ["example.com"],
      })
      .on(GetIdentityVerificationAttributesCommand)
      .resolves({
        VerificationAttributes: {},
      });

    const domains = await listSESDomains("us-east-1");

    expect(domains).toEqual([{ domain: "example.com", verified: false }]);
  });

  it("should return empty array on API error", async () => {
    sesMock.on(ListIdentitiesCommand).rejects(new Error("API Error"));

    const domains = await listSESDomains("us-east-1");

    expect(domains).toEqual([]);
  });

  it("should handle multiple domains correctly", async () => {
    const domainList = [
      "domain1.com",
      "domain2.com",
      "domain3.com",
      "domain4.com",
    ];

    sesMock
      .on(ListIdentitiesCommand)
      .resolves({
        Identities: domainList,
      })
      .on(GetIdentityVerificationAttributesCommand)
      .resolves({
        VerificationAttributes: {
          "domain1.com": { VerificationStatus: "Success" },
          "domain2.com": { VerificationStatus: "Success" },
          "domain3.com": { VerificationStatus: "Pending" },
          "domain4.com": { VerificationStatus: "Failed" },
        },
      });

    const domains = await listSESDomains("us-east-1");

    expect(domains).toHaveLength(4);
    expect(domains[0]).toEqual({ domain: "domain1.com", verified: true });
    expect(domains[2]).toEqual({ domain: "domain3.com", verified: false });
  });
});

describe("getSESAccountStatus", () => {
  beforeEach(() => {
    sesv2Mock.reset();
  });

  it("should return isSandbox true when ProductionAccessEnabled is false", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: false,
      SendQuota: {
        Max24HourSend: 200,
        MaxSendRate: 1,
        SentLast24Hours: 5,
      },
      EnforcementStatus: "HEALTHY",
    });

    const result = await getSESAccountStatus("us-east-1");
    expect(result.isSandbox).toBe(true);
    expect(result.sendQuota).toEqual({
      max24HourSend: 200,
      maxSendRate: 1,
      sentLast24Hours: 5,
    });
    expect(result.enforcementStatus).toBe("HEALTHY");
  });

  it("should return isSandbox false when ProductionAccessEnabled is true", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
      SendQuota: {
        Max24HourSend: 50_000,
        MaxSendRate: 14,
        SentLast24Hours: 100,
      },
      EnforcementStatus: "HEALTHY",
    });

    const result = await getSESAccountStatus("us-east-1");
    expect(result.isSandbox).toBe(false);
    expect(result.sendQuota?.max24HourSend).toBe(50_000);
  });

  it("should return isSandbox true with sandboxUncertain on API error (safe default)", async () => {
    sesv2Mock.on(GetAccountCommand).rejects(new Error("Access denied"));

    const result = await getSESAccountStatus("us-east-1");
    expect(result.isSandbox).toBe(true);
    expect(result.sandboxUncertain).toBe(true);
    expect(result.sendQuota).toBeUndefined();
  });

  it("should handle missing SendQuota in response", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: false,
    });

    const result = await getSESAccountStatus("us-east-1");
    expect(result.isSandbox).toBe(true);
    expect(result.sendQuota).toBeUndefined();
  });
});

describe("isSESSandbox", () => {
  beforeEach(() => {
    sesv2Mock.reset();
  });

  it("should return true when account is in sandbox", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: false,
    });

    const result = await isSESSandbox("us-east-1");
    expect(result).toBe(true);
  });

  it("should return false when account has production access", async () => {
    sesv2Mock.on(GetAccountCommand).resolves({
      ProductionAccessEnabled: true,
    });

    const result = await isSESSandbox("us-east-1");
    expect(result).toBe(false);
  });

  it("should return true on API error (safe default)", async () => {
    sesv2Mock.on(GetAccountCommand).rejects(new Error("Network timeout"));

    const result = await isSESSandbox("us-east-1");
    expect(result).toBe(true);
  });
});
