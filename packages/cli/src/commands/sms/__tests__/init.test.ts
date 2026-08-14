import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all external dependencies — mirrors commands/__tests__/init.test.ts's
// approach for the email init command.
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
vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  text: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("../../../utils/shared/aws.js");
vi.mock("../../../utils/shared/pulumi.js", async () => {
  const actual = (await vi.importActual(
    "../../../utils/shared/pulumi.js"
  )) as any;
  return {
    ensurePulumiInstalled: vi.fn().mockResolvedValue(false),
    previewWithResourceChanges: vi.fn().mockResolvedValue({
      changeSummary: {},
      resourceChanges: [],
    }),
    withLockRetry: actual.withLockRetry,
  };
});
vi.mock("../../../utils/shared/fs.js");
vi.mock("../../../utils/shared/metadata.js");
vi.mock("../../../infrastructure/sms-stack.js", () => ({
  deploySMSStack: vi.fn().mockResolvedValue({}),
  createSMSEventDestinationWithSDK: vi.fn(),
  createSMSPhonePoolWithSDK: vi.fn(),
  createSMSProtectConfigurationWithSDK: vi.fn(),
}));
vi.mock("../../../utils/sms/costs.js", () => ({
  getSMSCostSummary: vi.fn().mockReturnValue("$1/mo"),
}));

import * as pulumi from "@pulumi/pulumi";
import * as pulumiAutomation from "@pulumi/pulumi/automation";
import { deploySMSStack } from "../../../infrastructure/sms-stack.js";
import * as aws from "../../../utils/shared/aws.js";
import * as fsUtils from "../../../utils/shared/fs.js";
import * as metadata from "../../../utils/shared/metadata.js";
import { getSMSCostSummary } from "../../../utils/sms/costs.js";
import { init, parseCountries, parseVolume } from "../init.js";

describe("parseCountries", () => {
  it("parses, trims, and uppercases a comma-separated list", () => {
    expect(parseCountries("us, ca")).toEqual(["US", "CA"]);
  });

  it("throws SMS_INVALID_COUNTRIES on a non-2-letter code", () => {
    expect(() => parseCountries("USA")).toThrowError(
      expect.objectContaining({ code: "SMS_INVALID_COUNTRIES" })
    );
  });

  it("throws SMS_INVALID_COUNTRIES on an empty string", () => {
    expect(() => parseCountries("")).toThrowError(
      expect.objectContaining({ code: "SMS_INVALID_COUNTRIES" })
    );
  });
});

describe("parseVolume", () => {
  it("parses a positive integer string", () => {
    expect(parseVolume("10000")).toBe(10_000);
  });

  it("throws SMS_INVALID_VOLUME on a non-numeric string", () => {
    expect(() => parseVolume("abc")).toThrowError(
      expect.objectContaining({ code: "SMS_INVALID_VOLUME" })
    );
  });

  it("throws SMS_INVALID_VOLUME on zero", () => {
    expect(() => parseVolume("0")).toThrowError(
      expect.objectContaining({ code: "SMS_INVALID_VOLUME" })
    );
  });
});

describe("sms init — countries/volume flag precedence", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    vi.mocked(aws.validateAWSCredentials).mockResolvedValue({
      accountId: "123456789012",
      userId: "AIDACKCEVSQ6C2EXAMPLE",
      arn: "arn:aws:iam::123456789012:user/test",
    } as never);
    vi.mocked(aws.getAWSRegion).mockResolvedValue("us-east-1");

    vi.mocked(fsUtils.ensurePulumiWorkDir).mockReturnValue(undefined as never);
    vi.mocked(fsUtils.getPulumiWorkDir).mockReturnValue("/mock/.wraps/pulumi");

    vi.mocked(metadata.loadConnectionMetadata).mockReturnValue(null as never);

    const clack = await import("@clack/prompts");
    vi.mocked(clack.isCancel).mockReturnValue(false);

    const mockStack = {
      workspace: { selectStack: vi.fn().mockResolvedValue(undefined) },
      setConfig: vi.fn().mockResolvedValue(undefined),
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
  });

  it('defaults to ["US"] / 100 under --quick without invoking any clack prompt', async () => {
    const clack = await import("@clack/prompts");

    await init({
      provider: "aws",
      region: "us-east-1",
      quick: true,
      preview: true,
    });

    expect(clack.select).not.toHaveBeenCalled();
    expect(clack.multiselect).not.toHaveBeenCalled();
    expect(clack.confirm).not.toHaveBeenCalled();

    expect(deploySMSStack).toHaveBeenCalledWith(
      expect.objectContaining({
        smsConfig: expect.objectContaining({
          protectConfiguration: expect.objectContaining({
            allowedCountries: ["US"],
          }),
        }),
      })
    );
    expect(vi.mocked(getSMSCostSummary).mock.calls[0][1]).toBe(100);
  });

  it("an explicit --countries flag beats --quick", async () => {
    await init({
      provider: "aws",
      region: "us-east-1",
      quick: true,
      countries: "GB",
      preview: true,
    });

    expect(deploySMSStack).toHaveBeenCalledWith(
      expect.objectContaining({
        smsConfig: expect.objectContaining({
          protectConfiguration: expect.objectContaining({
            allowedCountries: ["GB"],
          }),
        }),
      })
    );
  });

  it("an explicit --volume flag beats --quick", async () => {
    await init({
      provider: "aws",
      region: "us-east-1",
      quick: true,
      volume: "10000",
      preview: true,
    });

    expect(vi.mocked(getSMSCostSummary).mock.calls[0][1]).toBe(10_000);
  });
});
