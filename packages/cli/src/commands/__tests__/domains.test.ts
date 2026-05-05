import {
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  ListEmailIdentitiesCommand,
  PutEmailIdentityConfigurationSetAttributesCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { domainToConfigSetName } from "../../utils/email/config-set-slug";
import {
  addDomain,
  getDkim,
  listDomains,
  removeDomain,
  verifyDomain,
} from "../email/domains";

const sesClientMock = mockClient(SESv2Client);

// Mock process.exit
const mockExit = vi
  .spyOn(process, "exit")
  .mockImplementation((() => {}) as any);

// Mock @clack/prompts
vi.mock("@clack/prompts");

// Mock utils
vi.mock("../../utils/shared/aws", () => ({
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    arn: "arn:aws:iam::123456789012:user/test",
    userId: "AIDATEST",
  }),
}));

vi.mock("../../utils/shared/metadata", () => ({
  findConnectionsWithService: vi.fn().mockResolvedValue([
    {
      accountId: "123456789012",
      region: "us-east-1",
      services: {
        email: {
          config: { domain: "primary.com" },
          dnsProvider: undefined,
        },
      },
    },
  ]),
  loadConnectionMetadata: vi.fn().mockResolvedValue({
    version: "1.0.0",
    accountId: "123456789012",
    region: "us-east-1",
    provider: "vercel",
    timestamp: new Date().toISOString(),
    services: {
      email: {
        config: { domain: "primary.com" },
        deployedAt: new Date().toISOString(),
      },
    },
  }),
  saveConnectionMetadata: vi.fn().mockResolvedValue(undefined),
  addDomainToMetadata: vi.fn(),
  removeDomainFromMetadata: vi.fn(),
  getDomainFromMetadata: vi.fn().mockReturnValue(null),
  getAllTrackedDomains: vi.fn().mockReturnValue([]),
}));

vi.mock("../../utils/dns/index", () => ({
  detectAvailableDNSProviders: vi
    .fn()
    .mockResolvedValue([{ provider: "manual", detected: true }]),
  getDNSCredentials: vi.fn().mockResolvedValue({
    valid: true,
    credentials: { provider: "manual" },
  }),
  createDNSRecordsForProvider: vi.fn().mockResolvedValue({
    success: true,
    recordsCreated: 0,
  }),
  buildEmailDNSRecords: vi.fn().mockReturnValue([]),
  formatDNSRecordsForDisplay: vi.fn().mockReturnValue([]),
  getDNSProviderDisplayName: vi.fn().mockReturnValue("Manual"),
}));

vi.mock("../../utils/shared/prompts", () => ({
  promptSubdomainSuggestions: vi.fn().mockResolvedValue("sub.primary.com"),
  promptDomainPurpose: vi.fn().mockResolvedValue("transactional"),
  promptMailFromSubdomain: vi.fn().mockResolvedValue("mail.test.com"),
  promptDNSProvider: vi.fn().mockResolvedValue("manual"),
}));

describe("Domain Management Commands", () => {
  let mockSpinner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    message: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    sesClientMock.reset();
    vi.clearAllMocks();
    mockExit.mockClear();

    // Mock spinner
    mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    };

    const clack = await import("@clack/prompts");
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.mocked(clack.note).mockImplementation(() => {});
    vi.mocked(clack.log).info = vi.fn();
    vi.mocked(clack.log).warn = vi.fn();
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
  });

  describe("addDomain", () => {
    it("should add a new domain successfully", async () => {
      // Mock domain doesn't exist (first call), then return DKIM tokens (second call)
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: {
            Tokens: ["token1", "token2", "token3"],
            Status: "PENDING",
          },
        });

      // Mock successful creation
      sesClientMock.on(CreateEmailIdentityCommand).resolves({});

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(false as never);

      await addDomain({ domain: "test.com", yes: true });

      // Verify CreateEmailIdentityCommand was called with config set
      const createCalls = sesClientMock.commandCalls(
        CreateEmailIdentityCommand
      );
      expect(createCalls.length).toBe(1);
      expect(createCalls[0].args[0].input).toMatchObject({
        EmailIdentity: "test.com",
        ConfigurationSetName: domainToConfigSetName("test.com"),
        DkimSigningAttributes: {
          NextSigningKeyLength: "RSA_2048_BIT",
        },
      });
    });

    it("should adopt existing SES domain into metadata without creating new identity", async () => {
      // Domain already exists in SES — return identity on first call, DKIM on second
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["token1", "token2", "token3"],
          Status: "SUCCESS",
        },
      });

      sesClientMock
        .on(PutEmailIdentityConfigurationSetAttributesCommand)
        .resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(false as never);

      const metadata = await import("../../utils/shared/metadata");

      await addDomain({ domain: "existing.com", yes: true });

      // Should NOT have tried to create a new SES identity
      const createCalls = sesClientMock.commandCalls(
        CreateEmailIdentityCommand
      );
      expect(createCalls.length).toBe(0);

      // Should have saved to metadata
      expect(metadata.addDomainToMetadata).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          domain: "existing.com",
        })
      );
      expect(metadata.saveConnectionMetadata).toHaveBeenCalled();
    });

    it("should associate config set on adopted existing domain", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["token1"],
          Status: "SUCCESS",
        },
      });

      sesClientMock
        .on(PutEmailIdentityConfigurationSetAttributesCommand)
        .resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      await addDomain({ domain: "existing.com", yes: true });

      const configSetCalls = sesClientMock.commandCalls(
        PutEmailIdentityConfigurationSetAttributesCommand
      );
      expect(configSetCalls.length).toBe(1);
      expect(configSetCalls[0].args[0].input).toMatchObject({
        EmailIdentity: "existing.com",
        ConfigurationSetName: domainToConfigSetName("existing.com"),
      });
    });

    it("should set up MAIL FROM on adopted existing domain", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["token1"],
          Status: "SUCCESS",
        },
      });

      sesClientMock
        .on(PutEmailIdentityConfigurationSetAttributesCommand)
        .resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      await addDomain({ domain: "existing.com", yes: true });

      // Should have called PutEmailIdentityMailFromAttributes
      const mailFromCalls = sesClientMock.commandCalls(
        PutEmailIdentityMailFromAttributesCommand
      );
      expect(mailFromCalls.length).toBe(1);
      expect(mailFromCalls[0].args[0].input).toMatchObject({
        EmailIdentity: "existing.com",
        MailFromDomain: "mail.existing.com",
        BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
      });
    });

    it("should show adoption message for existing SES domain", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["token1"],
          Status: "SUCCESS",
        },
      });

      sesClientMock
        .on(PutEmailIdentityConfigurationSetAttributesCommand)
        .resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(false as never);

      await addDomain({ domain: "existing.com", yes: true });

      // Should show adoption info message
      expect(clack.log.info).toHaveBeenCalledWith(
        expect.stringContaining("already exists in SES")
      );
      expect(clack.log.info).toHaveBeenCalledWith(
        expect.stringContaining("adopting into Wraps")
      );
    });

    it("should use DKIM tokens from existing domain for DNS setup", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["existing-tok1", "existing-tok2", "existing-tok3"],
          Status: "SUCCESS",
        },
      });

      sesClientMock
        .on(PutEmailIdentityConfigurationSetAttributesCommand)
        .resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      const dns = await import("../../utils/dns/index");

      await addDomain({ domain: "existing.com", yes: true });

      // Should have passed DKIM tokens to DNS record builder
      expect(dns.buildEmailDNSRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "existing.com",
          dkimTokens: ["existing-tok1", "existing-tok2", "existing-tok3"],
        })
      );
    });

    it("should handle AWS errors", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock.on(GetEmailIdentityCommand).rejectsOnce(notFoundError);

      sesClientMock
        .on(CreateEmailIdentityCommand)
        .rejects(new Error("AWS Service Error"));

      await expect(
        addDomain({ domain: "test.com", yes: true })
      ).rejects.toThrow("AWS Service Error");
    });
  });

  describe("listDomains", () => {
    it("should list all domains successfully", async () => {
      sesClientMock.on(ListEmailIdentitiesCommand).resolves({
        EmailIdentities: [
          {
            IdentityType: "DOMAIN",
            IdentityName: "domain1.com",
          },
          {
            IdentityType: "DOMAIN",
            IdentityName: "domain2.com",
          },
          {
            IdentityType: "EMAIL_ADDRESS",
            IdentityName: "test@example.com",
          },
        ],
      });

      sesClientMock
        .on(GetEmailIdentityCommand, { EmailIdentity: "domain1.com" })
        .resolves({
          VerifiedForSendingStatus: true,
          DkimAttributes: {
            Status: "SUCCESS",
          },
        })
        .on(GetEmailIdentityCommand, { EmailIdentity: "domain2.com" })
        .resolves({
          VerifiedForSendingStatus: false,
          DkimAttributes: {
            Status: "PENDING",
          },
        });

      await listDomains();

      const listCalls = sesClientMock.commandCalls(ListEmailIdentitiesCommand);
      expect(listCalls.length).toBe(1);
    });

    it("should handle no domains found", async () => {
      sesClientMock.on(ListEmailIdentitiesCommand).resolves({
        EmailIdentities: [],
      });

      const clack = await import("@clack/prompts");

      await listDomains();

      expect(clack.outro).toHaveBeenCalledWith("No domains found in SES");
    });

    it("should filter out email addresses", async () => {
      sesClientMock.on(ListEmailIdentitiesCommand).resolves({
        EmailIdentities: [
          {
            IdentityName: "domain.com",
          },
          {
            IdentityName: "test@example.com",
          },
        ],
      });

      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: { Status: "SUCCESS" },
      });

      await listDomains();

      // Should only query domain.com, not the email address
      const getCalls = sesClientMock.commandCalls(GetEmailIdentityCommand);
      expect(getCalls.length).toBe(1);
      expect(getCalls[0].args[0].input.EmailIdentity).toBe("domain.com");
    });

    it("should handle errors fetching domain details gracefully", async () => {
      sesClientMock.on(ListEmailIdentitiesCommand).resolves({
        EmailIdentities: [
          {
            IdentityType: "DOMAIN",
            IdentityName: "error-domain.com",
          },
        ],
      });

      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejects(new Error("Access denied"));

      // Should not throw, should handle gracefully
      await expect(listDomains()).resolves.not.toThrow();
    });
  });

  describe("getDkim", () => {
    it("should get DKIM tokens successfully", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        DkimAttributes: {
          Tokens: ["token1", "token2", "token3"],
          Status: "SUCCESS",
        },
      });

      await getDkim({ domain: "test.com" });

      const getCalls = sesClientMock.commandCalls(GetEmailIdentityCommand);
      expect(getCalls.length).toBe(1);
      expect(getCalls[0].args[0].input.EmailIdentity).toBe("test.com");
    });

    it("should handle pending DKIM verification", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        DkimAttributes: {
          Tokens: ["token1", "token2"],
          Status: "PENDING",
        },
      });

      await getDkim({ domain: "test.com" });

      // Should complete without error
      expect(sesClientMock.commandCalls(GetEmailIdentityCommand).length).toBe(
        1
      );
    });

    it("should handle domain not found", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock.on(GetEmailIdentityCommand).rejects(notFoundError);

      // Function will return early after calling process.exit()
      await getDkim({ domain: "nonexistent.com" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle no DKIM tokens", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        DkimAttributes: {
          Tokens: [],
          Status: "PENDING",
        },
      });

      const clack = await import("@clack/prompts");

      await getDkim({ domain: "test.com" });

      expect(clack.outro).toHaveBeenCalledWith(
        expect.stringContaining("No DKIM tokens")
      );
    });
  });

  describe("removeDomain", () => {
    it("should remove domain with confirmation", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
      });

      sesClientMock.on(DeleteEmailIdentityCommand).resolves({});

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(true as never);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      // getDomainFromMetadata returns null (not primary), so no guard
      await removeDomain({ domain: "test.com" });

      const deleteCalls = sesClientMock.commandCalls(
        DeleteEmailIdentityCommand
      );
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0].args[0].input.EmailIdentity).toBe("test.com");
    });

    it("should skip confirmation with --force flag", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
      });

      sesClientMock.on(DeleteEmailIdentityCommand).resolves({});

      const clack = await import("@clack/prompts");

      await removeDomain({ domain: "test.com", force: true });

      // confirm should not be called when force=true
      expect(clack.confirm).not.toHaveBeenCalled();

      const deleteCalls = sesClientMock.commandCalls(
        DeleteEmailIdentityCommand
      );
      expect(deleteCalls.length).toBe(1);
    });

    it("should cancel when user declines confirmation", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
      });

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(false as never);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await removeDomain({ domain: "test.com" });

      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled");
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should handle user cancels prompt", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
      });

      const clack = await import("@clack/prompts");
      const cancelSymbol = Symbol("cancel");
      vi.mocked(clack.confirm).mockResolvedValue(cancelSymbol as never);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      await removeDomain({ domain: "test.com" });

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should handle domain not found", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock.on(GetEmailIdentityCommand).rejects(notFoundError);

      // Function will return early after calling process.exit()
      await removeDomain({ domain: "nonexistent.com", force: true });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("addDomain - metadata and MAIL FROM", () => {
    it("should save domain to metadata after creation", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: {
            Tokens: ["token1", "token2", "token3"],
            Status: "PENDING",
          },
        });

      sesClientMock.on(CreateEmailIdentityCommand).resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(false as never);

      const metadata = await import("../../utils/shared/metadata");

      await addDomain({ domain: "test.com", yes: true });

      // Verify addDomainToMetadata was called with correct entry
      expect(metadata.addDomainToMetadata).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          domain: "test.com",
          mailFromDomain: "mail.test.com",
          addedAt: expect.any(String),
        })
      );

      // Verify saveConnectionMetadata was called
      expect(metadata.saveConnectionMetadata).toHaveBeenCalled();
    });

    it("should set up MAIL FROM in non-interactive mode", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: {
            Tokens: ["token1"],
            Status: "PENDING",
          },
        });

      sesClientMock.on(CreateEmailIdentityCommand).resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(false as never);

      await addDomain({ domain: "test.com", yes: true });

      // Verify PutEmailIdentityMailFromAttributesCommand was called
      const mailFromCalls = sesClientMock.commandCalls(
        PutEmailIdentityMailFromAttributesCommand
      );
      expect(mailFromCalls.length).toBe(1);
      expect(mailFromCalls[0].args[0].input).toMatchObject({
        EmailIdentity: "test.com",
        MailFromDomain: "mail.test.com",
        BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
      });
    });

    it("should exit when no email infrastructure exists", async () => {
      const metadata = await import("../../utils/shared/metadata");
      vi.mocked(metadata.findConnectionsWithService).mockResolvedValueOnce([]);

      await addDomain({ domain: "test.com", yes: true });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("removeDomain - primary domain guard", () => {
    it("should block removing primary domain without --force", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
      });

      const metadata = await import("../../utils/shared/metadata");
      vi.mocked(metadata.getDomainFromMetadata).mockReturnValueOnce({
        isPrimary: true,
      });

      await removeDomain({ domain: "primary.com" });

      expect(mockExit).toHaveBeenCalledWith(1);

      // Should NOT have called DeleteEmailIdentityCommand
      const deleteCalls = sesClientMock.commandCalls(
        DeleteEmailIdentityCommand
      );
      expect(deleteCalls.length).toBe(0);
    });

    it("should allow removing primary domain with --force", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
      });
      sesClientMock.on(DeleteEmailIdentityCommand).resolves({});

      const metadata = await import("../../utils/shared/metadata");
      vi.mocked(metadata.getDomainFromMetadata).mockReturnValueOnce({
        isPrimary: true,
      });

      await removeDomain({ domain: "primary.com", force: true });

      const deleteCalls = sesClientMock.commandCalls(
        DeleteEmailIdentityCommand
      );
      expect(deleteCalls.length).toBe(1);
    });

    it("should call removeDomainFromMetadata and save after removal", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
      });
      sesClientMock.on(DeleteEmailIdentityCommand).resolves({});

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(true as never);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const metadata = await import("../../utils/shared/metadata");

      await removeDomain({ domain: "sub.primary.com" });

      expect(metadata.removeDomainFromMetadata).toHaveBeenCalledWith(
        expect.any(Object),
        "sub.primary.com"
      );
      expect(metadata.saveConnectionMetadata).toHaveBeenCalled();
    });
  });

  describe("verifyDomain", () => {
    it("should verify domain DNS records successfully", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: {
          Tokens: ["token1", "token2"],
          Status: "SUCCESS",
        },
      });

      // Mock DNS resolver
      const mockResolver = {
        resolveCname: vi.fn().mockResolvedValue(["token1.dkim.amazonses.com"]),
        resolveTxt: vi
          .fn()
          .mockResolvedValueOnce([["v=spf1 include:amazonses.com ~all"]])
          .mockResolvedValueOnce([["v=DMARC1; p=none;"]]),
        setServers: vi.fn(),
      };

      vi.doMock("node:dns/promises", () => ({
        Resolver: vi.fn(() => mockResolver),
      }));

      await verifyDomain({ domain: "test.com" });

      const getCalls = sesClientMock.commandCalls(GetEmailIdentityCommand);
      expect(getCalls.length).toBeGreaterThan(0);
    });

    it("should handle domain not found in SES", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock.on(GetEmailIdentityCommand).rejects(notFoundError);

      // Function will return early after calling process.exit()
      await verifyDomain({ domain: "nonexistent.com" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("addDomain - per-domain config sets", () => {
    const defaultEventBusArn =
      "arn:aws:events:us-east-1:123456789012:event-bus/default";

    it("Unit 6: new domain: CreateConfigurationSetCommand called with derived name before CreateEmailIdentityCommand", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: {
            Tokens: ["tok1", "tok2", "tok3"],
            Status: "PENDING",
          },
        });

      sesClientMock.on(CreateConfigurationSetCommand).resolves({});
      sesClientMock
        .on(CreateConfigurationSetEventDestinationCommand)
        .resolves({});
      sesClientMock.on(CreateEmailIdentityCommand).resolves({});

      await addDomain({ domain: "test.com", yes: true });

      const configSetCalls = sesClientMock.commandCalls(
        CreateConfigurationSetCommand
      );
      expect(configSetCalls.length).toBeGreaterThanOrEqual(1);
      expect(configSetCalls[0].args[0].input).toMatchObject({
        ConfigurationSetName: domainToConfigSetName("test.com"),
      });

      const allCalls = sesClientMock.calls();
      const configSetIdx = allCalls.findIndex(
        (c) => c.args[0] instanceof CreateConfigurationSetCommand
      );
      const identityIdx = allCalls.findIndex(
        (c) => c.args[0] instanceof CreateEmailIdentityCommand
      );
      expect(configSetIdx).toBeGreaterThanOrEqual(0);
      expect(identityIdx).toBeGreaterThanOrEqual(0);
      expect(configSetIdx).toBeLessThan(identityIdx);
    });

    it("Unit 7: new domain: CreateConfigurationSetEventDestinationCommand called with Enabled: true", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: {
            Tokens: ["tok1", "tok2", "tok3"],
            Status: "PENDING",
          },
        });

      sesClientMock.on(CreateConfigurationSetCommand).resolves({});
      sesClientMock
        .on(CreateConfigurationSetEventDestinationCommand)
        .resolves({});
      sesClientMock.on(CreateEmailIdentityCommand).resolves({});

      await addDomain({ domain: "test.com", yes: true });

      const destCalls = sesClientMock.commandCalls(
        CreateConfigurationSetEventDestinationCommand
      );
      expect(destCalls.length).toBeGreaterThanOrEqual(1);
      expect(destCalls[0].args[0].input).toMatchObject({
        ConfigurationSetName: domainToConfigSetName("test.com"),
        EventDestination: {
          Enabled: true,
          EventBridgeDestination: { EventBusArn: defaultEventBusArn },
        },
      });
    });

    it("Unit 8: new domain: CreateEmailIdentityCommand called with derived ConfigurationSetName", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: {
            Tokens: ["tok1", "tok2", "tok3"],
            Status: "PENDING",
          },
        });

      sesClientMock.on(CreateConfigurationSetCommand).resolves({});
      sesClientMock
        .on(CreateConfigurationSetEventDestinationCommand)
        .resolves({});
      sesClientMock.on(CreateEmailIdentityCommand).resolves({});

      await addDomain({ domain: "test.com", yes: true });

      const createCalls = sesClientMock.commandCalls(
        CreateEmailIdentityCommand
      );
      expect(createCalls.length).toBe(1);
      expect(createCalls[0].args[0].input).toMatchObject({
        EmailIdentity: "test.com",
        ConfigurationSetName: domainToConfigSetName("test.com"),
      });
    });

    it("Unit 9: transactional purpose: event destination excludes OPEN and CLICK", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: { Tokens: ["tok1"], Status: "PENDING" },
        });

      sesClientMock.on(CreateConfigurationSetCommand).resolves({});
      sesClientMock
        .on(CreateConfigurationSetEventDestinationCommand)
        .resolves({});
      sesClientMock.on(CreateEmailIdentityCommand).resolves({});

      const prompts = await import("../../utils/shared/prompts");
      vi.mocked(prompts.promptDomainPurpose).mockResolvedValueOnce(
        "transactional"
      );

      await addDomain({ domain: "test.com", yes: false });

      const destCalls = sesClientMock.commandCalls(
        CreateConfigurationSetEventDestinationCommand
      );
      expect(destCalls.length).toBeGreaterThanOrEqual(1);
      const eventTypes =
        destCalls[0].args[0].input.EventDestination?.MatchingEventTypes ?? [];
      expect(eventTypes).not.toContain("OPEN");
      expect(eventTypes).not.toContain("CLICK");
    });

    it("Unit 10: marketing purpose: event destination includes OPEN and CLICK", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: { Tokens: ["tok1"], Status: "PENDING" },
        });

      sesClientMock.on(CreateConfigurationSetCommand).resolves({});
      sesClientMock
        .on(CreateConfigurationSetEventDestinationCommand)
        .resolves({});
      sesClientMock.on(CreateEmailIdentityCommand).resolves({});

      const prompts = await import("../../utils/shared/prompts");
      vi.mocked(prompts.promptDomainPurpose).mockResolvedValueOnce("marketing");

      const clack = await import("@clack/prompts");
      vi.mocked(clack.confirm).mockResolvedValue(false as never);

      await addDomain({ domain: "test.com", yes: false });

      const destCalls = sesClientMock.commandCalls(
        CreateConfigurationSetEventDestinationCommand
      );
      expect(destCalls.length).toBeGreaterThanOrEqual(1);
      const eventTypes =
        destCalls[0].args[0].input.EventDestination?.MatchingEventTypes ?? [];
      expect(eventTypes).toContain("OPEN");
      expect(eventTypes).toContain("CLICK");
    });

    it("Unit 11: adopted domain: CreateConfigurationSetCommand + event destination called before PutEmailIdentityConfigurationSetAttributesCommand", async () => {
      sesClientMock.on(GetEmailIdentityCommand).resolves({
        VerifiedForSendingStatus: true,
        DkimAttributes: { Tokens: ["tok1"], Status: "SUCCESS" },
      });

      sesClientMock.on(CreateConfigurationSetCommand).resolves({});
      sesClientMock
        .on(CreateConfigurationSetEventDestinationCommand)
        .resolves({});
      sesClientMock
        .on(PutEmailIdentityConfigurationSetAttributesCommand)
        .resolves({});
      sesClientMock.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

      await addDomain({ domain: "existing.com", yes: true });

      const configSetCalls = sesClientMock.commandCalls(
        CreateConfigurationSetCommand
      );
      expect(configSetCalls.length).toBeGreaterThanOrEqual(1);
      expect(configSetCalls[0].args[0].input).toMatchObject({
        ConfigurationSetName: domainToConfigSetName("existing.com"),
      });

      const allCalls = sesClientMock.calls();
      const csIdx = allCalls.findIndex(
        (c) => c.args[0] instanceof CreateConfigurationSetCommand
      );
      const putIdx = allCalls.findIndex(
        (c) =>
          c.args[0] instanceof PutEmailIdentityConfigurationSetAttributesCommand
      );
      expect(csIdx).toBeGreaterThanOrEqual(0);
      expect(putIdx).toBeGreaterThanOrEqual(0);
      expect(csIdx).toBeLessThan(putIdx);

      const putCalls = sesClientMock.commandCalls(
        PutEmailIdentityConfigurationSetAttributesCommand
      );
      expect(putCalls[0].args[0].input).toMatchObject({
        EmailIdentity: "existing.com",
        ConfigurationSetName: domainToConfigSetName("existing.com"),
      });
    });

    it("Unit 12: config set creation failure: error bubbles and metadata not updated", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock.on(GetEmailIdentityCommand).rejectsOnce(notFoundError);

      const configSetError = new Error(
        "ConfigurationSetAlreadyExistsException"
      );
      configSetError.name = "ConfigurationSetAlreadyExistsException";
      sesClientMock.on(CreateConfigurationSetCommand).rejects(configSetError);

      const metadata = await import("../../utils/shared/metadata");

      await expect(
        addDomain({ domain: "fail.com", yes: true })
      ).rejects.toThrow();

      expect(metadata.saveConnectionMetadata).not.toHaveBeenCalled();
    });

    it("Unit 13: AlreadyExistsException on config set is swallowed (idempotent re-run)", async () => {
      const notFoundError = new Error("Not found");
      notFoundError.name = "NotFoundException";
      sesClientMock
        .on(GetEmailIdentityCommand)
        .rejectsOnce(notFoundError)
        .resolvesOnce({
          DkimAttributes: {
            Tokens: ["tok1", "tok2", "tok3"],
            Status: "PENDING",
          },
        });

      const alreadyExistsError = new Error("Already exists");
      alreadyExistsError.name = "AlreadyExistsException";
      sesClientMock
        .on(CreateConfigurationSetCommand)
        .rejects(alreadyExistsError);
      sesClientMock
        .on(CreateConfigurationSetEventDestinationCommand)
        .resolves({});
      sesClientMock.on(CreateEmailIdentityCommand).resolves({});

      await expect(
        addDomain({ domain: "test.com", yes: true })
      ).resolves.not.toThrow();
    });
  });
});
