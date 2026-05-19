import { beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      createOrSelectStack: vi.fn(),
    },
  },
}));

vi.mock("@clack/prompts");
vi.mock("../../utils/shared/aws.js");
vi.mock("../../utils/shared/pulumi.js");
vi.mock("../../utils/shared/fs.js");
vi.mock("../../utils/shared/metadata.js", async () => {
  const actual = await vi.importActual("../../utils/shared/metadata.js");
  return {
    ...actual,
    loadConnectionMetadata: vi.fn(),
    saveConnectionMetadata: vi.fn(),
  };
});
vi.mock("../../utils/selfhost/neon.js", async () => {
  const actual = await vi.importActual("../../utils/selfhost/neon.js");
  return { ...actual, provisionNeonProject: vi.fn() };
});
vi.mock("../../telemetry/events.js");

import * as prompts from "@clack/prompts";
import * as aws from "../../utils/shared/aws.js";
import * as fsUtils from "../../utils/shared/fs.js";
import * as metadata from "../../utils/shared/metadata.js";
import * as neon from "../../utils/selfhost/neon.js";
import * as pulumiUtils from "../../utils/shared/pulumi.js";
import { selfhostDeploy } from "../selfhost/deploy.js";

const MOCK_PULUMI_OUTPUTS = {
  outputs: {
    apiUrl: { value: "https://abc123.lambda-url.us-east-1.on.aws" },
    lambdaArn: {
      value:
        "arn:aws:lambda:us-east-1:123456789012:function:wraps-selfhost-api",
    },
    lambdaRoleArn: {
      value: "arn:aws:iam::123456789012:role/wraps-selfhost-lambda-role",
    },
    rateLimitTableName: { value: "wraps-selfhost-rate-limit" },
    batchQueueUrl: {
      value:
        "https://sqs.us-east-1.amazonaws.com/123456789012/wraps-selfhost-batch",
    },
    batchQueueArn: {
      value: "arn:aws:sqs:us-east-1:123456789012:wraps-selfhost-batch",
    },
    workflowQueueUrl: {
      value:
        "https://sqs.us-east-1.amazonaws.com/123456789012/wraps-selfhost-workflow",
    },
    workflowQueueArn: {
      value: "arn:aws:sqs:us-east-1:123456789012:wraps-selfhost-workflow",
    },
    schedulerRoleArn: {
      value:
        "arn:aws:iam::123456789012:role/wraps-selfhost-scheduler-role",
    },
    schedulerGroupName: { value: "wraps-selfhost-schedulers" },
  },
};

describe("selfhostDeploy", () => {
  let mockSpinner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    message: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    setJsonMode(false);

    mockSpinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };

    vi.mocked(prompts.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(prompts.intro).mockImplementation(() => {});
    vi.mocked(prompts.outro).mockImplementation(() => {});
    vi.mocked(prompts.note).mockImplementation(() => {});
    vi.mocked(prompts.log).info = vi.fn();
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).warn = vi.fn();
    vi.mocked(prompts.log).step = vi.fn();
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    vi.mocked(aws.validateAWSCredentialsWithDetails).mockResolvedValue({
      identity: {
        accountId: "123456789012",
        userId: "AIDACKCEVSQ6C2EXAMPLE",
        arn: "arn:aws:iam::123456789012:user/test",
      },
      warnings: [],
      credentialSource: "environment",
    } as any);

    vi.mocked(pulumiUtils.ensurePulumiInstalled).mockResolvedValue(false);
    vi.mocked(pulumiUtils.withLockRetry).mockResolvedValue(
      MOCK_PULUMI_OUTPUTS as any
    );

    vi.mocked(fsUtils.ensurePulumiWorkDir).mockResolvedValue(undefined as any);
    vi.mocked(fsUtils.getPulumiWorkDir).mockReturnValue("/mock/.wraps/pulumi");

    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(null);
    vi.mocked(metadata.saveConnectionMetadata).mockResolvedValue(undefined);

    vi.mocked(neon.provisionNeonProject).mockResolvedValue({
      id: "neon-project-id-123",
      name: "wraps-selfhost-123456789012-us-east-1",
      connectionString: "postgres://neon-user:neon-pass@neon-host/neon-db",
    });

    const pulumi = await import("@pulumi/pulumi");
    const mockStack = {
      workspace: { selectStack: vi.fn().mockResolvedValue(undefined) },
      setConfig: vi.fn().mockResolvedValue(undefined),
      up: vi.fn(),
    };
    vi.mocked(
      pulumi.automation.LocalWorkspace.createOrSelectStack
    ).mockResolvedValue(mockStack as any);
  });

  describe("when --database-url is provided", () => {
    it("skips Neon provisioning and uses the provided database URL", async () => {
      const customDbUrl =
        "postgres://custom-user:custom-pass@custom-host:5432/mydb";

      await selfhostDeploy({
        region: "us-east-1",
        databaseUrl: customDbUrl,
        licenseKey: "v1.scale.2027-01-01.abc123",
        appUrl: "https://app.torbox.app",
        yes: true,
      });

      expect(neon.provisionNeonProject).not.toHaveBeenCalled();
    });

    it("saves the provided database URL in the deployment config", async () => {
      const customDbUrl =
        "postgres://custom-user:custom-pass@custom-host:5432/mydb";

      await selfhostDeploy({
        region: "us-east-1",
        databaseUrl: customDbUrl,
        licenseKey: "v1.scale.2027-01-01.abc123",
        appUrl: "https://app.torbox.app",
        yes: true,
      });

      expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          services: expect.objectContaining({
            selfhost: expect.objectContaining({
              config: expect.objectContaining({
                databaseUrl: customDbUrl,
              }),
            }),
          }),
        })
      );
    });
  });

  describe("when --database-url is absent", () => {
    it("provisions a Neon project using the provided API key", async () => {
      await selfhostDeploy({
        region: "us-east-1",
        neonApiKey: "neon_api_key_123",
        licenseKey: "v1.scale.2027-01-01.abc123",
        appUrl: "https://app.torbox.app",
        yes: true,
      });

      expect(neon.provisionNeonProject).toHaveBeenCalledWith(
        "neon_api_key_123",
        expect.stringContaining("wraps-selfhost"),
        expect.any(Object)
      );
    });
  });
});
