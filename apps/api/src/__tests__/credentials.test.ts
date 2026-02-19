/**
 * Credentials Service Tests
 *
 * Verifies that getCredentials returns both AWS credentials AND
 * the customer's SES region from the awsAccount record.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStsSend = vi.fn().mockResolvedValue({
  Credentials: {
    AccessKeyId: "AKIA-test",
    SecretAccessKey: "secret-test",
    SessionToken: "token-test",
    Expiration: new Date("2099-01-01"),
  },
});

vi.mock("@aws-sdk/client-sts", () => {
  return {
    STSClient: class MockSTSClient {
      send = mockStsSend;
    },
    AssumeRoleCommand: class MockAssumeRoleCommand {
      constructor(public input: unknown) {}
    },
  };
});

vi.mock("@wraps/db", () => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    db: { select: mockSelect },
    eq: vi.fn(),
    awsAccount: {
      id: "id",
      roleArn: "role_arn",
      externalId: "external_id",
      region: "region",
    },
    __mockLimit: mockLimit,
  };
});

const { __mockLimit } = await import("@wraps/db" as string);

const { getCredentials } = await import("../services/credentials");

describe("getCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the credential cache between tests by re-importing would be complex,
    // so we use unique account IDs per test to avoid cache hits
  });

  it("returns the customer's AWS region from the awsAccount record", async () => {
    (__mockLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        roleArn: "arn:aws:iam::123456789012:role/wraps-email-role",
        externalId: "ext-123",
        region: "eu-west-1",
      },
    ]);

    const result = await getCredentials("account-eu-west-1");

    expect(result.region).toBe("eu-west-1");
  });

  it("returns credentials alongside region", async () => {
    (__mockLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        roleArn: "arn:aws:iam::123456789012:role/wraps-email-role",
        externalId: "ext-456",
        region: "ap-southeast-1",
      },
    ]);

    const result = await getCredentials("account-ap-southeast-1");

    expect(result.accessKeyId).toBe("AKIA-test");
    expect(result.secretAccessKey).toBe("secret-test");
    expect(result.sessionToken).toBe("token-test");
    expect(result.region).toBe("ap-southeast-1");
  });
});
