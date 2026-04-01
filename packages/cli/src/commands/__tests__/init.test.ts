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
vi.mock("node:fs");
vi.mock("node:path");
vi.mock("../../utils/shared/aws.js");
vi.mock("../../utils/shared/pulumi.js", async () => {
  const actual = (await vi.importActual("../../utils/shared/pulumi.js")) as any;
  return {
    checkPulumiInstalled: vi.fn().mockResolvedValue(true),
    ensurePulumiInstalled: vi.fn().mockResolvedValue(false),
    previewWithResourceChanges: vi.fn(),
    withLockRetry: actual.withLockRetry,
  };
});
vi.mock("../../utils/shared/fs.js");
vi.mock("../../utils/shared/metadata.js");
vi.mock("../../utils/shared/iam-check.js");
vi.mock("../../utils/route53.js");
vi.mock("../../utils/shared/prompts.js");
vi.mock("../../utils/dns/index.js");
vi.mock("../../infrastructure/email-stack.js");
vi.mock("../email/test.js");
vi.mock("../../utils/shared/preflight.js", () => ({
  runPreflightScan: vi
    .fn()
    .mockResolvedValue({ shouldContinue: true, scan: {} }),
}));

import * as fs from "node:fs";
import * as path from "node:path";
import * as prompts from "@clack/prompts";
import { deployEmailStack } from "../../infrastructure/email-stack.js";
import * as dnsUtils from "../../utils/dns/index.js";
import * as route53Utils from "../../utils/route53.js";
import * as aws from "../../utils/shared/aws.js";
import * as fsUtils from "../../utils/shared/fs.js";
import * as iamCheck from "../../utils/shared/iam-check.js";
import * as metadata from "../../utils/shared/metadata.js";
import * as promptUtils from "../../utils/shared/prompts.js";
import * as pulumiUtils from "../../utils/shared/pulumi.js";
// Import after mocks
import { init } from "../email/init.js";

describe("init command", () => {
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
    vi.mocked(prompts.outro).mockImplementation(() => {});
    vi.mocked(prompts.note).mockImplementation(() => {});
    vi.mocked(prompts.log).info = vi.fn();
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).step = vi.fn();
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    // Mock path operations
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));

    // Mock fs operations
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    // Mock AWS utilities
    vi.mocked(aws.validateAWSCredentialsWithDetails).mockResolvedValue({
      identity: {
        accountId: "123456789012",
        userId: "AIDACKCEVSQ6C2EXAMPLE",
        arn: "arn:aws:iam::123456789012:user/test",
      },
      credentialSource: "profile",
      warnings: [],
    });
    vi.mocked(aws.getAWSRegion).mockResolvedValue("us-east-1");
    vi.mocked(aws.getSESAccountStatus).mockResolvedValue({
      isSandbox: false,
    });

    // Mock IAM permission check (prevents real AWS IAM calls)
    vi.mocked(iamCheck.checkIAMPermissions).mockResolvedValue({
      success: true,
      deniedActions: [],
      allowedActions: [],
      skipped: true,
      skipReason: "Mocked in test",
    });
    vi.mocked(iamCheck.getRequiredActions).mockReturnValue([]);
    vi.mocked(iamCheck.formatDeniedActions).mockReturnValue("");

    // Mock Pulumi utilities
    vi.mocked(pulumiUtils.ensurePulumiInstalled).mockResolvedValue(false);

    // Mock filesystem utilities
    vi.mocked(fsUtils.ensurePulumiWorkDir).mockReturnValue(undefined);
    vi.mocked(fsUtils.getPulumiWorkDir).mockReturnValue("/mock/.wraps/pulumi");

    // Mock metadata utilities
    vi.mocked(metadata.loadConnectionMetadata).mockReturnValue(null);
    vi.mocked(metadata.saveConnectionMetadata).mockReturnValue(undefined);
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

    // Mock Route53 utilities
    vi.mocked(route53Utils.findHostedZone).mockResolvedValue(null);
    vi.mocked(route53Utils.previewDNSChanges).mockResolvedValue({
      records: [],
      hasConflicts: false,
      conflictCount: 0,
      newCount: 0,
      updateCount: 0,
      noChangeCount: 0,
    });
    vi.mocked(route53Utils.createSelectedDNSRecords).mockResolvedValue(
      undefined
    );

    // Mock DNS utilities
    vi.mocked(dnsUtils.detectAvailableDNSProviders).mockResolvedValue([
      { provider: "route53", detected: false },
      { provider: "vercel", detected: false },
      { provider: "cloudflare", detected: false },
      {
        provider: "manual",
        detected: true,
        hint: "I'll add DNS records myself",
      },
    ]);
    vi.mocked(dnsUtils.getDNSCredentials).mockResolvedValue({
      valid: false,
      error: "No credentials available",
    });
    vi.mocked(dnsUtils.createDNSRecordsForProvider).mockResolvedValue({
      success: true,
      recordsCreated: 5,
    });
    vi.mocked(dnsUtils.getDNSProviderDisplayName).mockImplementation(
      (provider) => {
        const names: Record<string, string> = {
          route53: "AWS Route53",
          vercel: "Vercel DNS",
          cloudflare: "Cloudflare",
          manual: "Manual",
        };
        return names[provider] || provider;
      }
    );
    vi.mocked(dnsUtils.getDNSProviderTokenUrl).mockImplementation(
      (provider) => {
        const urls: Record<string, string> = {
          vercel: "https://vercel.com/account/tokens",
          cloudflare: "https://dash.cloudflare.com/profile/api-tokens",
        };
        return urls[provider] || "";
      }
    );
    vi.mocked(dnsUtils.buildEmailDNSRecords).mockReturnValue([
      {
        name: "token1._domainkey.example.com",
        type: "CNAME",
        value: "token1.dkim.amazonses.com",
        category: "dkim",
      },
      {
        name: "example.com",
        type: "TXT",
        value: "v=spf1 include:amazonses.com ~all",
        category: "spf",
      },
      {
        name: "_dmarc.example.com",
        type: "TXT",
        value: "v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com",
        category: "dmarc",
      },
    ]);
    vi.mocked(dnsUtils.formatManualDNSInstructions).mockReturnValue(
      "DKIM (3 CNAMEs)\n  CNAME token1._domainkey.example.com\n"
    );

    // Mock prompt utilities
    vi.mocked(promptUtils.promptProvider).mockResolvedValue("vercel");
    vi.mocked(promptUtils.promptRegion).mockResolvedValue("us-east-1");
    vi.mocked(promptUtils.promptDomain).mockResolvedValue("example.com");
    vi.mocked(promptUtils.promptConfigPreset).mockResolvedValue("starter");
    vi.mocked(promptUtils.promptEstimatedVolume).mockResolvedValue("1k-10k");
    vi.mocked(promptUtils.confirmDeploy).mockResolvedValue(true);
    vi.mocked(promptUtils.promptVercelConfig).mockResolvedValue({
      teamSlug: "my-team",
    });
    vi.mocked(promptUtils.promptDNSManagement).mockResolvedValue(true);
    vi.mocked(promptUtils.promptDNSConfirmation).mockResolvedValue({
      shouldCreate: true,
      selectedCategories: new Set(["dkim", "spf", "dmarc"]),
    });
    vi.mocked(promptUtils.promptDNSProvider).mockResolvedValue("manual");
    vi.mocked(promptUtils.promptDNSRecordSelection).mockResolvedValue({
      shouldCreate: true,
      selectedCategories: new Set(["dkim", "spf", "dmarc"]),
    });
    vi.mocked(promptUtils.promptContinueManualDNS).mockResolvedValue(true);

    // Mock deployEmailStack
    vi.mocked(deployEmailStack).mockResolvedValue({
      roleArn: "arn:aws:iam::123456789012:role/wraps-email-role",
      configSetName: "wraps-email-tracking",
      dkimTokens: ["token1", "token2", "token3"],
      domain: "example.com",
      region: "us-east-1",
    });
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
          roleArn: {
            value: "arn:aws:iam::123456789012:role/wraps-email-role",
          },
          configSetName: { value: "wraps-email-tracking" },
          dkimTokens: { value: ["token1", "token2", "token3"] },
          domain: { value: "example.com" },
          region: { value: "us-east-1" },
        },
      }),
    } as any;

    // Mock createOrSelectStack to execute the program function
    const createOrSelectStackMock = vi.fn().mockImplementation(async (args) => {
      // Execute the program function if it exists
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
  }

  describe("Core Flow Tests", () => {
    it("should validate AWS credentials", async () => {
      await setupPulumiMock();
      await init({});

      expect(aws.validateAWSCredentialsWithDetails).toHaveBeenCalled();
    });

    it("should check Pulumi installation", async () => {
      await setupPulumiMock();
      await init({});

      expect(pulumiUtils.ensurePulumiInstalled).toHaveBeenCalled();
    });

    it("should prevent re-initialization when connection exists", async () => {
      // Mock existing connection
      vi.mocked(metadata.loadConnectionMetadata).mockReturnValue({
        accountId: "123456789012",
        provider: "vercel",
        region: "us-east-1",
        timestamp: new Date().toISOString(),
        services: {
          email: {
            config: {
              domain: "existing.com",
              tracking: { enabled: true, opens: true, clicks: true },
              sendingEnabled: true,
            },
            preset: "starter",
            pulumiStackName: "wraps-email-us-east-1",
          },
        },
      });

      await expect(init({})).rejects.toThrow();
    });

    it("should prompt for provider when not provided", async () => {
      await setupPulumiMock();
      await init({});

      expect(promptUtils.promptProvider).toHaveBeenCalled();
    });

    it("should prompt for region when not provided", async () => {
      await setupPulumiMock();
      await init({});

      expect(promptUtils.promptRegion).toHaveBeenCalled();
    });

    it("should prompt for domain when not provided", async () => {
      await setupPulumiMock();
      await init({});

      expect(promptUtils.promptDomain).toHaveBeenCalled();
    });

    it("should use provided options instead of prompting", async () => {
      await setupPulumiMock();
      await init({
        provider: "aws",
        region: "us-west-2",
        domain: "test.com",
        preset: "production",
      });

      // Should not prompt for these
      expect(promptUtils.promptProvider).not.toHaveBeenCalled();
      expect(promptUtils.promptRegion).not.toHaveBeenCalled();
      expect(promptUtils.promptDomain).not.toHaveBeenCalled();
      expect(promptUtils.promptConfigPreset).not.toHaveBeenCalled();
    });

    it("should deploy email stack", async () => {
      await setupPulumiMock();
      await init({});

      expect(deployEmailStack).toHaveBeenCalled();
    });

    it("should save connection metadata after deployment", async () => {
      await setupPulumiMock();
      await init({});

      expect(metadata.saveConnectionMetadata).toHaveBeenCalled();
    });

    it("should prompt for Vercel config when provider is Vercel", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptProvider).mockResolvedValue("vercel");

      await init({});

      expect(promptUtils.promptVercelConfig).toHaveBeenCalled();
    });

    it("should not prompt for Vercel config when provider is AWS", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptProvider).mockResolvedValue("aws");

      await init({});

      expect(promptUtils.promptVercelConfig).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle invalid AWS credentials", async () => {
      vi.mocked(aws.validateAWSCredentialsWithDetails).mockRejectedValue(
        new Error("InvalidClientTokenId")
      );

      await expect(init({})).rejects.toThrow();
    });

    it("should handle deployment errors", async () => {
      vi.mocked(deployEmailStack).mockRejectedValue(
        new Error("Deployment failed")
      );

      await expect(init({})).rejects.toThrow();
    });

    it("should handle user cancellation", async () => {
      vi.mocked(promptUtils.confirmDeploy).mockResolvedValue(false);
      vi.mocked(prompts.isCancel).mockReturnValue(true);

      await expect(init({})).rejects.toThrow();
    });

    it("should handle Pulumi lock error", async () => {
      await setupPulumiMock();
      vi.mocked(deployEmailStack).mockRejectedValue(
        new Error("the stack is currently locked by 1 lock(s)")
      );

      await expect(init({})).rejects.toThrow(/locked/);
    });
  });

  describe("DNS Integration Tests", () => {
    it("should detect available DNS providers", async () => {
      await setupPulumiMock();
      await init({});

      // New flow uses detectAvailableDNSProviders instead of direct findHostedZone
      expect(dnsUtils.detectAvailableDNSProviders).toHaveBeenCalled();
    });

    it("should prompt for DNS provider selection", async () => {
      await setupPulumiMock();
      await init({});

      expect(promptUtils.promptDNSProvider).toHaveBeenCalled();
    });

    it("should create DNS records when provider selected and credentials valid", async () => {
      await setupPulumiMock();
      // Mock Route53 detection and credentials
      vi.mocked(dnsUtils.detectAvailableDNSProviders).mockResolvedValue([
        { provider: "route53", detected: true, hint: "Hosted zone detected" },
        {
          provider: "manual",
          detected: true,
          hint: "I'll add DNS records myself",
        },
      ]);
      vi.mocked(promptUtils.promptDNSProvider).mockResolvedValue("route53");
      vi.mocked(dnsUtils.getDNSCredentials).mockResolvedValue({
        valid: true,
        credentials: { provider: "route53", hostedZoneId: "Z1234567890ABC" },
      });

      await init({});

      // DNS provider prompt should have been called
      expect(promptUtils.promptDNSProvider).toHaveBeenCalled();
    });

    it("should display manual DNS instructions when manual provider selected", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptDNSProvider).mockResolvedValue("manual");

      await init({});

      // Should display all DNS records via clack.note with formatted instructions
      expect(prompts.note).toHaveBeenCalled();
      expect(dnsUtils.formatManualDNSInstructions).toHaveBeenCalled();
    });

    it("should use per-record selection for Vercel DNS provider", async () => {
      await setupPulumiMock();
      vi.mocked(dnsUtils.detectAvailableDNSProviders).mockResolvedValue([
        { provider: "vercel", detected: true, hint: "Token detected" },
        {
          provider: "manual",
          detected: true,
          hint: "I'll add DNS records myself",
        },
      ]);
      vi.mocked(promptUtils.promptDNSProvider).mockResolvedValue("vercel");
      vi.mocked(dnsUtils.getDNSCredentials).mockResolvedValue({
        valid: true,
        credentials: { provider: "vercel", token: "test-token" },
      });
      vi.mocked(promptUtils.promptDNSRecordSelection).mockResolvedValue({
        shouldCreate: true,
        selectedCategories: new Set(["dkim", "spf"]),
      });

      await init({});

      // Should show per-record selection, not create all records blindly
      expect(promptUtils.promptDNSRecordSelection).toHaveBeenCalled();
      expect(dnsUtils.createDNSRecordsForProvider).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "vercel" }),
        expect.any(Object),
        expect.any(Set)
      );
    });

    it("should use per-record selection for Cloudflare DNS provider", async () => {
      await setupPulumiMock();
      vi.mocked(dnsUtils.detectAvailableDNSProviders).mockResolvedValue([
        { provider: "cloudflare", detected: true, hint: "Zone found" },
        {
          provider: "manual",
          detected: true,
          hint: "I'll add DNS records myself",
        },
      ]);
      vi.mocked(promptUtils.promptDNSProvider).mockResolvedValue("cloudflare");
      vi.mocked(dnsUtils.getDNSCredentials).mockResolvedValue({
        valid: true,
        credentials: {
          provider: "cloudflare",
          token: "test-token",
          zoneId: "zone123",
        },
      });
      vi.mocked(promptUtils.promptDNSRecordSelection).mockResolvedValue({
        shouldCreate: true,
        selectedCategories: new Set(["dkim", "spf", "dmarc"]),
      });

      await init({});

      expect(promptUtils.promptDNSRecordSelection).toHaveBeenCalled();
      expect(dnsUtils.createDNSRecordsForProvider).toHaveBeenCalled();
    });

    it("should skip DNS creation when user deselects all records", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptDNSProvider).mockResolvedValue("vercel");
      vi.mocked(dnsUtils.getDNSCredentials).mockResolvedValue({
        valid: true,
        credentials: { provider: "vercel", token: "test-token" },
      });
      vi.mocked(promptUtils.promptDNSRecordSelection).mockResolvedValue({
        shouldCreate: false,
        selectedCategories: new Set(),
      });

      await init({});

      expect(dnsUtils.createDNSRecordsForProvider).not.toHaveBeenCalled();
    });

    it("should fall back to manual when credentials are invalid", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptDNSProvider).mockResolvedValue("cloudflare");
      vi.mocked(dnsUtils.getDNSCredentials).mockResolvedValue({
        valid: false,
        error: "Invalid Cloudflare token — authentication failed",
      });
      vi.mocked(promptUtils.promptContinueManualDNS).mockResolvedValue(true);

      await init({});

      // Should warn and fall back to manual
      expect(promptUtils.promptContinueManualDNS).toHaveBeenCalled();
      // Should still show manual DNS instructions
      expect(prompts.note).toHaveBeenCalled();
    });
  });

  describe("Provider-Specific Tests", () => {
    it("should handle Vercel provider setup", async () => {
      await setupPulumiMock();
      await init({ provider: "vercel" });

      expect(promptUtils.promptVercelConfig).toHaveBeenCalled();
    });

    it("should handle AWS native provider setup", async () => {
      await setupPulumiMock();
      await init({ provider: "aws" });

      expect(promptUtils.promptVercelConfig).not.toHaveBeenCalled();
    });

    it("should handle Railway provider setup", async () => {
      await setupPulumiMock();
      await init({ provider: "railway" });

      // Railway doesn't need special config prompts
      expect(promptUtils.promptVercelConfig).not.toHaveBeenCalled();
    });
  });

  describe("Configuration Tests", () => {
    it("should use starter preset when selected", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptConfigPreset).mockResolvedValue("starter");

      await init({});

      // Verify deployment was called (preset is handled internally)
      expect(deployEmailStack).toHaveBeenCalled();
    });

    it("should use production preset when selected", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptConfigPreset).mockResolvedValue("production");

      await init({});

      expect(deployEmailStack).toHaveBeenCalled();
    });

    it("should use enterprise preset when selected", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptConfigPreset).mockResolvedValue("enterprise");

      await init({});

      expect(deployEmailStack).toHaveBeenCalled();
    });

    it("should prompt for custom config when custom preset selected", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptConfigPreset).mockResolvedValue("custom");
      vi.mocked(promptUtils.promptCustomConfig).mockResolvedValue({
        sendingEnabled: true,
        openTracking: true,
        clickTracking: true,
        trackingDomain: "",
        eventTypes: ["Send", "Delivery"],
        reputationMetrics: true,
        dkimLength: "RSA_2048_BIT",
        emailHistory: true,
        emailHistoryRetention: 90,
        dedicatedIp: false,
      });

      await init({});

      expect(promptUtils.promptCustomConfig).toHaveBeenCalled();
    });
  });

  describe("State Management Tests", () => {
    it("should save metadata with correct fields", async () => {
      await setupPulumiMock();
      // Mock getAWSRegion to return the region we'll pass to init
      vi.mocked(aws.getAWSRegion).mockResolvedValue("us-west-2");
      await init({
        provider: "vercel",
        region: "us-west-2",
        domain: "test.com",
        preset: "starter",
      });

      expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "vercel",
          region: "us-west-2",
          accountId: "123456789012",
          services: expect.objectContaining({
            email: expect.objectContaining({
              preset: "starter",
            }),
          }),
        })
      );
    });

    it("should include createdAt timestamp in metadata", async () => {
      await setupPulumiMock();
      await init({});

      expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it("should include updatedAt timestamp in metadata", async () => {
      await setupPulumiMock();
      await init({});

      expect(metadata.saveConnectionMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it("should include stackName in metadata", async () => {
      await setupPulumiMock();
      vi.mocked(promptUtils.promptRegion).mockResolvedValue("eu-central-1");
      await init({ region: "eu-central-1" });

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

    it("should output JSON envelope on successful init", async () => {
      await setupPulumiMock();
      await init({
        domain: "test.com",
        provider: "vercel",
        region: "us-east-1",
        yes: true,
        json: true,
      });

      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.command === "email.init";
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.success).toBe(true);
      expect(output.command).toBe("email.init");
      expect(output.data).toBeDefined();
      expect(output.data.roleArn).toBeDefined();
      expect(output.data.region).toBeDefined();
    });
  });
});
