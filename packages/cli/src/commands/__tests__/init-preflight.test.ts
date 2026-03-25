import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts");
vi.mock("../../utils/shared/scanner.js", () => ({
  scanAWSResources: vi.fn(),
  filterWrapsResources: vi.fn(),
  checkWrapsResourcesExist: vi.fn(),
}));

import * as prompts from "@clack/prompts";
import { runPreflightScan } from "../../utils/shared/preflight.js";
import type { AWSResourceScan } from "../../utils/shared/scanner.js";
import {
  checkWrapsResourcesExist,
  filterWrapsResources,
  scanAWSResources,
} from "../../utils/shared/scanner.js";

const mockScan = scanAWSResources as ReturnType<typeof vi.fn>;
const mockFilter = filterWrapsResources as ReturnType<typeof vi.fn>;
const mockCheck = checkWrapsResourcesExist as ReturnType<typeof vi.fn>;

describe("init pre-flight scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prompts.log).info = vi.fn();
    vi.mocked(prompts.log).warn = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.isCancel).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should warn when wraps-* resources already exist and prompt user", async () => {
    // Raw scan includes non-wraps resources
    const rawScan: AWSResourceScan = {
      identities: [],
      configurationSets: [
        { name: "wraps-email-config-set", eventDestinations: [] },
        { name: "other-config-set", eventDestinations: [] },
      ],
      snsTopics: [],
      dynamoTables: [],
      lambdaFunctions: [],
      iamRoles: [
        {
          name: "wraps-email-role",
          arn: "arn:aws:iam::123456789012:role/wraps-email-role",
          assumeRolePolicyDocument: "",
        },
        {
          name: "other-role",
          arn: "arn:aws:iam::123456789012:role/other-role",
          assumeRolePolicyDocument: "",
        },
      ],
    };

    // Filtered scan only has wraps-* resources
    const filteredScan: AWSResourceScan = {
      identities: [],
      configurationSets: [
        { name: "wraps-email-config-set", eventDestinations: [] },
      ],
      snsTopics: [],
      dynamoTables: [],
      lambdaFunctions: [],
      iamRoles: [
        {
          name: "wraps-email-role",
          arn: "arn:aws:iam::123456789012:role/wraps-email-role",
          assumeRolePolicyDocument: "",
        },
      ],
    };

    mockScan.mockResolvedValue(rawScan);
    mockFilter.mockReturnValue(filteredScan);
    mockCheck.mockReturnValue({
      hasConfigSet: true,
      hasSNSTopics: false,
      hasDynamoTable: false,
      hasLambdaFunctions: false,
      hasIAMRole: true,
    });

    // User confirms to continue
    vi.mocked(prompts.confirm).mockResolvedValue(true as never);

    const result = await runPreflightScan("us-east-1", "example.com");

    // filterWrapsResources return value must be passed to checkWrapsResourcesExist
    expect(mockFilter).toHaveBeenCalledWith(rawScan);
    expect(mockCheck).toHaveBeenCalledWith(filteredScan);

    // Should have warned about existing resources
    expect(vi.mocked(prompts.log.warn)).toHaveBeenCalledWith(
      expect.stringContaining("Existing Wraps resources detected")
    );

    // Should have prompted to continue
    expect(vi.mocked(prompts.confirm)).toHaveBeenCalled();

    // User chose to continue
    expect(result.shouldContinue).toBe(true);
  });

  it("should warn when domain exists as unverified SES identity", async () => {
    const scan: AWSResourceScan = {
      identities: [{ name: "example.com", type: "Domain", verified: false }],
      configurationSets: [],
      snsTopics: [],
      dynamoTables: [],
      lambdaFunctions: [],
      iamRoles: [],
    };

    mockScan.mockResolvedValue(scan);
    mockFilter.mockReturnValue({
      ...scan,
      identities: [],
    });
    mockCheck.mockReturnValue({
      hasConfigSet: false,
      hasSNSTopics: false,
      hasDynamoTable: false,
      hasLambdaFunctions: false,
      hasIAMRole: false,
    });

    vi.mocked(prompts.confirm).mockResolvedValue(true as never);

    const result = await runPreflightScan("us-east-1", "example.com");

    expect(vi.mocked(prompts.log.warn)).toHaveBeenCalledWith(
      expect.stringContaining("example.com")
    );

    expect(result.shouldContinue).toBe(true);
  });

  it("should return shouldContinue true when no conflicts found", async () => {
    const emptyScan: AWSResourceScan = {
      identities: [],
      configurationSets: [],
      snsTopics: [],
      dynamoTables: [],
      lambdaFunctions: [],
      iamRoles: [],
    };

    mockScan.mockResolvedValue(emptyScan);
    mockFilter.mockReturnValue(emptyScan);
    mockCheck.mockReturnValue({
      hasConfigSet: false,
      hasSNSTopics: false,
      hasDynamoTable: false,
      hasLambdaFunctions: false,
      hasIAMRole: false,
    });

    const result = await runPreflightScan("us-east-1", "example.com");

    // No prompt needed
    expect(vi.mocked(prompts.confirm)).not.toHaveBeenCalled();
    expect(result.shouldContinue).toBe(true);
  });
});
