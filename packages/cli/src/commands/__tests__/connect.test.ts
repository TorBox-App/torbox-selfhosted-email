import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../utils/shared/json-output.js";

// Mock all external dependencies
vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      createOrSelectStack: vi.fn(),
    },
    installPulumiCli: vi.fn(),
  },
}));
vi.mock("@pulumi/pulumi/automation", () => ({
  LocalWorkspace: {
    createOrSelectStack: vi.fn(),
  },
  installPulumiCli: vi.fn(),
}));
vi.mock("@clack/prompts");
vi.mock("../../utils/shared/aws.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../utils/shared/aws.js")>();
  return {
    ...mod,
    validateAWSCredentials: vi.fn(),
    getAWSRegion: vi.fn(),
    checkRegion: vi.fn(),
  };
});
vi.mock("../../utils/shared/fs.js");
vi.mock("../../utils/shared/metadata.js");
vi.mock("../../utils/shared/pulumi.js");
vi.mock("../../utils/shared/prompts.js");
vi.mock("../../utils/shared/scanner.js");
vi.mock("../../infrastructure/email-stack.js");

import * as prompts from "@clack/prompts";
import { deployEmailStack } from "../../infrastructure/email-stack.js";
import * as aws from "../../utils/shared/aws.js";
import * as fsUtils from "../../utils/shared/fs.js";
import * as metadata from "../../utils/shared/metadata.js";
import * as promptUtils from "../../utils/shared/prompts.js";
import * as pulumiUtils from "../../utils/shared/pulumi.js";
import * as scanner from "../../utils/shared/scanner.js";
// Import after mocks
import { connect } from "../email/connect.js";

describe("connect command", () => {
  let mockSpinner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    message: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock spinner
    mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    };

    // Mock prompts module
    vi.mocked(prompts.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(prompts.intro).mockImplementation(() => {});
    vi.mocked(prompts.cancel).mockImplementation(() => {});
    vi.mocked(prompts.isCancel).mockReturnValue(false);
    vi.mocked(prompts.log).info = vi.fn();
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).warn = vi.fn();

    // Mock AWS utilities
    vi.mocked(aws.validateAWSCredentials).mockResolvedValue({
      accountId: "123456789012",
      userId: "AIDACKCEVSQ6C2EXAMPLE",
      arn: "arn:aws:iam::123456789012:user/test",
    });
    vi.mocked(aws.getAWSRegion).mockResolvedValue("us-east-1");

    // Mock Pulumi utilities
    vi.mocked(pulumiUtils.ensurePulumiInstalled).mockResolvedValue(false);

    // Mock filesystem utilities
    vi.mocked(fsUtils.ensurePulumiWorkDir).mockResolvedValue(undefined);
    vi.mocked(fsUtils.getPulumiWorkDir).mockReturnValue("/mock/.wraps/pulumi");

    // Mock metadata utilities
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(null);
    vi.mocked(metadata.saveConnectionMetadata).mockResolvedValue(undefined);
    vi.mocked(metadata.createConnectionMetadata).mockImplementation(
      (accountId, region, provider, emailConfig, preset) =>
        ({
          accountId,
          region,
          provider,
          timestamp: new Date().toISOString(),
          services: {
            email: {
              config: emailConfig,
              preset,
            },
          },
        }) as any
    );

    // Mock scanner utilities
    vi.mocked(scanner.scanAWSResources).mockResolvedValue({
      identities: [
        { name: "example.com", verified: true, type: "Domain" },
        { name: "test@example.com", verified: false, type: "EmailAddress" },
      ],
      configurationSets: [
        {
          name: "existing-config",
          eventDestinations: [],
        },
      ],
      topics: [],
      tables: [],
      functions: [],
      roles: [],
    });

    // Mock prompt utilities
    vi.mocked(promptUtils.promptProvider).mockResolvedValue("vercel");
    vi.mocked(promptUtils.promptRegion).mockResolvedValue("us-east-1");
    vi.mocked(promptUtils.promptConfigPreset).mockResolvedValue("starter");
    vi.mocked(promptUtils.promptSelectIdentities).mockResolvedValue([
      "example.com",
    ]);
    vi.mocked(promptUtils.promptVercelConfig).mockResolvedValue({
      teamSlug: "my-team",
      projectName: "my-project",
    });
    vi.mocked(promptUtils.confirmConnect).mockResolvedValue(true);

    // Mock deployEmailStack
    vi.mocked(deployEmailStack).mockResolvedValue({
      roleArn: "arn:aws:iam::123456789012:role/wraps-email-role",
      configSetName: "wraps-email-tracking",
      region: "us-east-1",
    } as any);
  });

  // Helper function to setup Pulumi mocking
  async function setupPulumiMock() {
    const pulumi = await import("@pulumi/pulumi");
    const pulumiAutomation = await import("@pulumi/pulumi/automation");

    const mockStack = {
      workspace: {
        selectStack: vi.fn().mockResolvedValue(undefined),
      },
      setConfig: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue({
        outputs: {
          roleArn: { value: "arn:aws:iam::123456789012:role/wraps-email-role" },
          configSetName: { value: "wraps-email-tracking" },
          region: { value: "us-east-1" },
        },
      }),
    } as any;

    const createOrSelectStackMock = vi.fn().mockImplementation(async (args) => {
      if (args.program) {
        await args.program();
      }
      return mockStack;
    });

    vi.mocked(
      pulumi.automation.LocalWorkspace.createOrSelectStack
    ).mockImplementation(createOrSelectStackMock);
    vi.mocked(
      pulumiAutomation.LocalWorkspace.createOrSelectStack
    ).mockImplementation(createOrSelectStackMock);

    return mockStack;
  }

  describe("Core Flow Tests", () => {
    it("should validate AWS credentials", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(aws.validateAWSCredentials).toHaveBeenCalled();
    });

    it("should check Pulumi installation", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(pulumiUtils.ensurePulumiInstalled).toHaveBeenCalled();
    });

    it("should prevent re-connection when connection exists", async () => {
      await setupPulumiMock();
      vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
        provider: "vercel",
        region: "us-east-1",
        timestamp: new Date().toISOString(),
      } as any);

      await expect(connect({ yes: true })).rejects.toThrow();
    });

    it("should scan AWS resources", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(scanner.scanAWSResources).toHaveBeenCalledWith("us-east-1");
    });

    it("should exit if no SES identities found", async () => {
      await setupPulumiMock();
      vi.mocked(scanner.scanAWSResources).mockResolvedValue({
        identities: [],
        configurationSets: [],
        topics: [],
        tables: [],
        functions: [],
        roles: [],
      });

      await expect(connect({ yes: true })).rejects.toThrow();
    });

    it("should prompt for provider when not provided", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(promptUtils.promptProvider).toHaveBeenCalled();
    });

    it("should prompt for region when not provided", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(promptUtils.promptRegion).toHaveBeenCalled();
    });

    it("should use provided options instead of prompting", async () => {
      await setupPulumiMock();
      await connect({
        provider: "aws",
        region: "us-west-2",
        yes: true,
      });

      expect(promptUtils.promptProvider).not.toHaveBeenCalled();
      expect(promptUtils.promptRegion).not.toHaveBeenCalled();
    });

    it("should prompt for identity selection", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(promptUtils.promptSelectIdentities).toHaveBeenCalledWith([
        { name: "example.com", verified: true },
        { name: "test@example.com", verified: false },
      ]);
    });

    it("should exit if no identities selected", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptSelectIdentities).mockResolvedValue([]);

      await expect(connect({ yes: true })).rejects.toThrow();
    });

    it("should deploy email stack", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(deployEmailStack).toHaveBeenCalled();
    });

    it("should save connection metadata after deployment", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(metadata.saveConnectionMetadata).toHaveBeenCalled();
    });

    it("should prompt for Vercel config when provider is Vercel", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptProvider).mockResolvedValue("vercel");

      await connect({ yes: true });

      expect(promptUtils.promptVercelConfig).toHaveBeenCalled();
    });

    it("should not prompt for Vercel config when provider is AWS", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptProvider).mockResolvedValue("aws");

      await connect({ yes: true });

      expect(promptUtils.promptVercelConfig).not.toHaveBeenCalled();
    });

    it("should confirm connection when --yes flag not provided", async () => {
      await setupPulumiMock();
      await connect({});

      expect(promptUtils.confirmConnect).toHaveBeenCalled();
    });

    it("should skip confirmation when --yes flag is provided", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(promptUtils.confirmConnect).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle invalid AWS credentials", async () => {
      vi.mocked(aws.validateAWSCredentials).mockRejectedValue(
        new Error("InvalidClientTokenId")
      );

      await expect(connect({ yes: true })).rejects.toThrow();
    });

    it("should handle deployment errors", async () => {
      await setupPulumiMock();
      vi.mocked(deployEmailStack).mockRejectedValue(
        new Error("Deployment failed")
      );

      await expect(connect({ yes: true })).rejects.toThrow();
    });

    it("should handle user cancellation", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.confirmConnect).mockResolvedValue(false);

      await expect(connect({})).rejects.toThrow();
    });

    it("should handle Pulumi lock error", async () => {
      await setupPulumiMock();
      const mockStack = {
        workspace: { selectStack: vi.fn() },
        setConfig: vi.fn(),
        up: vi
          .fn()
          .mockRejectedValue(
            new Error("the stack is currently locked by 1 lock(s)")
          ),
      };

      const pulumi = await import("@pulumi/pulumi");
      vi.mocked(
        pulumi.automation.LocalWorkspace.createOrSelectStack
      ).mockResolvedValue(mockStack as any);

      await expect(connect({ yes: true })).rejects.toThrow(/locked/);
    });
  });

  describe("Scan Results Tests", () => {
    it("should display verified identities", async () => {
      await setupPulumiMock();
      await connect({ yes: true });

      expect(scanner.scanAWSResources).toHaveBeenCalled();
      // Verified identities should be shown in info message
    });

    it("should handle mixed verified and unverified identities", async () => {
      await setupPulumiMock();
      vi.mocked(scanner.scanAWSResources).mockResolvedValue({
        identities: [
          { name: "verified.com", verified: true, type: "Domain" },
          { name: "unverified.com", verified: false, type: "Domain" },
        ],
        configurationSets: [],
        topics: [],
        tables: [],
        functions: [],
        roles: [],
      });

      await connect({ yes: true });

      expect(promptUtils.promptSelectIdentities).toHaveBeenCalledWith([
        { name: "verified.com", verified: true },
        { name: "unverified.com", verified: false },
      ]);
    });

    it("should handle scanning errors gracefully", async () => {
      await setupPulumiMock();
      vi.mocked(scanner.scanAWSResources).mockRejectedValue(
        new Error("Access denied")
      );

      await expect(connect({ yes: true })).rejects.toThrow();
    });

    it("should show SES permission error when scanner reports access denied", async () => {
      await setupPulumiMock();
      vi.mocked(scanner.scanAWSResources).mockResolvedValue({
        identities: [],
        configurationSets: [],
        topics: [],
        tables: [],
        functions: [],
        roles: [],
        scanErrors: { identities: "AccessDeniedException" },
      } as any);

      await expect(connect({ yes: true })).rejects.toThrow(/permission/i);
    });

    it("should suggest other regions when identities found elsewhere", async () => {
      await setupPulumiMock();

      // Primary scan in us-east-1: no identities
      vi.mocked(scanner.scanAWSResources).mockResolvedValue({
        identities: [],
        configurationSets: [],
        topics: [],
        tables: [],
        functions: [],
        roles: [],
      } as any);

      // Multi-region scan finds identities in eu-west-1
      vi.mocked(scanner.scanSESIdentities).mockResolvedValue([
        { name: "example.com", verified: true, type: "Domain" },
      ]);

      // Should call scanSESIdentities for other regions
      await expect(connect({ region: "us-east-1", yes: true })).rejects.toThrow();

      // Should have scanned at least one other region
      expect(scanner.scanSESIdentities).toHaveBeenCalled();
    });
  });

  describe("Unverified Identity Warning", () => {
    it("should warn when selected identities include unverified ones", async () => {
      await setupPulumiMock();
      vi.mocked(scanner.scanAWSResources).mockResolvedValue({
        identities: [
          { name: "verified.com", verified: true, type: "Domain" },
          { name: "unverified.com", verified: false, type: "Domain" },
        ],
        configurationSets: [],
        topics: [],
        tables: [],
        functions: [],
        roles: [],
      } as any);

      // User selects the unverified identity
      vi.mocked(promptUtils.promptSelectIdentities).mockResolvedValue([
        "unverified.com",
      ]);

      await connect({ yes: true });

      // Should warn about unverified identities
      expect(prompts.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("unverified.com")
      );
    });

    it("should not warn when all selected identities are verified", async () => {
      await setupPulumiMock();
      vi.mocked(scanner.scanAWSResources).mockResolvedValue({
        identities: [
          { name: "verified.com", verified: true, type: "Domain" },
          { name: "unverified.com", verified: false, type: "Domain" },
        ],
        configurationSets: [],
        topics: [],
        tables: [],
        functions: [],
        roles: [],
      } as any);

      vi.mocked(promptUtils.promptSelectIdentities).mockResolvedValue([
        "verified.com",
      ]);

      // Clear warn mock to isolate our check
      vi.mocked(prompts.log.warn).mockClear();

      await connect({ yes: true });

      // Should NOT warn about unverified identities
      const warnCalls = vi.mocked(prompts.log.warn).mock.calls;
      const unverifiedWarns = warnCalls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("not yet verified")
      );
      expect(unverifiedWarns).toHaveLength(0);
    });
  });

  describe("Provider-Specific Tests", () => {
    it("should handle Vercel provider setup", async () => {
      await setupPulumiMock();
      await connect({ provider: "vercel", yes: true });

      expect(promptUtils.promptVercelConfig).toHaveBeenCalled();
    });

    it("should handle AWS native provider setup", async () => {
      await setupPulumiMock();
      await connect({ provider: "aws", yes: true });

      expect(promptUtils.promptVercelConfig).not.toHaveBeenCalled();
    });

    it("should handle Railway provider setup", async () => {
      await setupPulumiMock();
      await connect({ provider: "railway", yes: true });

      expect(promptUtils.promptVercelConfig).not.toHaveBeenCalled();
    });
  });

  describe("State Management Tests", () => {
    it("should save metadata with correct fields", async () => {
      await setupPulumiMock();
      await connect({
        provider: "vercel",
        region: "us-west-2",
        yes: true,
      });

      expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "vercel",
          accountId: "123456789012",
          services: expect.objectContaining({
            email: expect.objectContaining({
              preset: "starter",
            }),
          }),
        })
      );
    });

    it("should include Vercel config in metadata when applicable", async () => {
      await setupPulumiMock();
      await connect({ provider: "vercel", yes: true });

      expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          vercel: {
            teamSlug: "my-team",
            projectName: "my-project",
          },
        })
      );
    });

    it("should include pulumiStackName in metadata", async () => {
      await setupPulumiMock();
      await connect({ region: "eu-central-1", yes: true });

      expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          services: expect.objectContaining({
            email: expect.objectContaining({
              pulumiStackName: "wraps-123456789012-eu-central-1",
            }),
          }),
        })
      );
    });
  });

  describe("Preview Mode Tests", () => {
    it("should run preview without deploying infrastructure", async () => {
      const pulumi = await import("@pulumi/pulumi");
      const pulumiAutomation = await import("@pulumi/pulumi/automation");

      const mockStack = {
        workspace: { selectStack: vi.fn() },
        setConfig: vi.fn().mockResolvedValue(undefined),
        up: vi.fn(),
      } as any;

      const createOrSelectStackMock = vi
        .fn()
        .mockImplementation(async (args) => {
          if (args.program) await args.program();
          return mockStack;
        });

      vi.mocked(
        pulumi.automation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);
      vi.mocked(
        pulumiAutomation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);

      vi.mocked(pulumiUtils.previewWithResourceChanges).mockResolvedValue({
        changeSummary: { create: 5 },
        resourceChanges: [],
      } as any);

      await connect({ preview: true, yes: true });

      // Should call previewWithResourceChanges, NOT stack.up()
      expect(pulumiUtils.previewWithResourceChanges).toHaveBeenCalled();
      expect(mockStack.up).not.toHaveBeenCalled();

      // Should NOT save metadata
      expect(metadata.saveConnectionMetadata).not.toHaveBeenCalled();
    });

    it("should skip confirmation prompt in preview mode", async () => {
      const pulumi = await import("@pulumi/pulumi");
      const pulumiAutomation = await import("@pulumi/pulumi/automation");

      const mockStack = {
        workspace: { selectStack: vi.fn() },
        setConfig: vi.fn().mockResolvedValue(undefined),
        up: vi.fn(),
      } as any;

      const createOrSelectStackMock = vi
        .fn()
        .mockImplementation(async (args) => {
          if (args.program) await args.program();
          return mockStack;
        });

      vi.mocked(
        pulumi.automation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);
      vi.mocked(
        pulumiAutomation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);

      vi.mocked(pulumiUtils.previewWithResourceChanges).mockResolvedValue({
        changeSummary: { create: 3 },
        resourceChanges: [],
      } as any);

      await connect({ preview: true });

      // Should NOT prompt for confirmation
      expect(promptUtils.confirmConnect).not.toHaveBeenCalled();
    });
  });

  describe("Preview Error Handling", () => {
    it("should throw stack locked error in preview mode", async () => {
      const pulumi = await import("@pulumi/pulumi");
      const pulumiAutomation = await import("@pulumi/pulumi/automation");

      const mockStack = {
        workspace: { selectStack: vi.fn() },
        setConfig: vi.fn().mockResolvedValue(undefined),
      } as any;

      const createOrSelectStackMock = vi
        .fn()
        .mockImplementation(async (args) => {
          if (args.program) await args.program();
          return mockStack;
        });

      vi.mocked(
        pulumi.automation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);
      vi.mocked(
        pulumiAutomation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);

      vi.mocked(pulumiUtils.previewWithResourceChanges).mockRejectedValue(
        new Error("the stack is currently locked by 1 lock(s)")
      );

      await expect(connect({ preview: true, yes: true })).rejects.toThrow(
        /locked/
      );
    });

    it("should throw descriptive error on preview failure", async () => {
      const pulumi = await import("@pulumi/pulumi");
      const pulumiAutomation = await import("@pulumi/pulumi/automation");

      const mockStack = {
        workspace: { selectStack: vi.fn() },
        setConfig: vi.fn().mockResolvedValue(undefined),
      } as any;

      const createOrSelectStackMock = vi
        .fn()
        .mockImplementation(async (args) => {
          if (args.program) await args.program();
          return mockStack;
        });

      vi.mocked(
        pulumi.automation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);
      vi.mocked(
        pulumiAutomation.LocalWorkspace.createOrSelectStack
      ).mockImplementation(createOrSelectStackMock);

      vi.mocked(pulumiUtils.previewWithResourceChanges).mockRejectedValue(
        new Error("Some unexpected preview error")
      );

      await expect(connect({ preview: true, yes: true })).rejects.toThrow(
        /Preview failed/
      );
    });
  });

  describe("JSON output", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      setJsonMode(true);
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      setJsonMode(false);
      consoleLogSpy.mockRestore();
    });

    it("should output JSON envelope on successful connect", async () => {
      await setupPulumiMock();
      await connect({ yes: true, json: true });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.command === "email.connect";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.success).toBe(true);
      expect(output.command).toBe("email.connect");
      expect(output.data).toBeDefined();
      expect(output.data.roleArn).toBeDefined();
      expect(output.data.region).toBeDefined();
    });
  });
});
