import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts");
vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      selectStack: vi.fn().mockRejectedValue(new Error("no stack named")),
    },
  },
}));
vi.mock("../../utils/shared/scanner.js", () => ({
  scanAWSResources: vi.fn(),
  filterWrapsResources: vi.fn(),
}));
vi.mock("../../utils/shared/aws.js", () => ({
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    arn: "arn:aws:iam::123456789012:user/test",
  }),
}));
vi.mock("../../utils/shared/metadata.js", () => ({
  loadConnectionMetadata: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../utils/shared/pulumi.js", () => ({
  ensurePulumiInstalled: vi.fn().mockResolvedValue(false),
}));
vi.mock("../../utils/shared/fs.js", () => ({
  ensurePulumiWorkDir: vi.fn(),
  getPulumiWorkDir: vi.fn().mockReturnValue("/tmp/pulumi"),
}));
vi.mock("../../telemetry/events.js", () => ({
  trackCommand: vi.fn(),
}));
vi.mock("../../utils/shared/json-output.js", () => ({
  isJsonMode: vi.fn().mockReturnValue(false),
  jsonSuccess: vi.fn(),
}));

// Shared send mocks so we can assert across all instances
const mockSesSend = vi.fn().mockResolvedValue({});
const mockSnsSend = vi.fn().mockResolvedValue({});
const mockDynamoSend = vi.fn().mockResolvedValue({});
const mockLambdaSend = vi.fn().mockResolvedValue({});
const mockIamSend = vi
  .fn()
  .mockResolvedValue({ PolicyNames: [], AttachedPolicies: [] });

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: class {
    send = mockSesSend;
  },
  DeleteConfigurationSetCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: class {
    send = mockSnsSend;
  },
  DeleteTopicCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {
    send = mockDynamoSend;
  },
  DeleteTableCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class {
    send = mockLambdaSend;
  },
  DeleteFunctionCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/client-iam", () => ({
  IAMClient: class {
    send = mockIamSend;
  },
  ListRolePoliciesCommand: class {
    constructor(public input: unknown) {}
  },
  ListAttachedRolePoliciesCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteRolePolicyCommand: class {
    constructor(public input: unknown) {}
  },
  DetachRolePolicyCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteRoleCommand: class {
    constructor(public input: unknown) {}
  },
}));

import * as prompts from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import type { AWSResourceScan } from "../../utils/shared/scanner.js";
import {
  filterWrapsResources,
  scanAWSResources,
} from "../../utils/shared/scanner.js";

const mockScanFn = scanAWSResources as ReturnType<typeof vi.fn>;
const mockFilterFn = filterWrapsResources as ReturnType<typeof vi.fn>;

describe("emailDoctor", () => {
  let mockSpinner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    message: ReturnType<typeof vi.fn>;
  };
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    };

    vi.mocked(prompts.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(prompts.intro).mockImplementation(() => {});
    vi.mocked(prompts.outro).mockImplementation(() => {});
    vi.mocked(prompts.log).info = vi.fn();
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).warn = vi.fn();
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    // Restore default implementations for shared SDK mocks after clearAllMocks
    mockSesSend.mockResolvedValue({});
    mockSnsSend.mockResolvedValue({});
    mockDynamoSend.mockResolvedValue({});
    mockLambdaSend.mockResolvedValue({});
    mockIamSend.mockResolvedValue({ PolicyNames: [], AttachedPolicies: [] });

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should display found wraps-* resources with pass status", async () => {
    const filteredScan: AWSResourceScan = {
      identities: [{ name: "example.com", type: "Domain", verified: true }],
      configurationSets: [
        { name: "wraps-email-config-set", eventDestinations: [] },
      ],
      snsTopics: [],
      dynamoTables: [{ name: "wraps-email-events", status: "ACTIVE" }],
      lambdaFunctions: [],
      iamRoles: [
        {
          name: "wraps-email-role",
          arn: "arn:aws:iam::123456789012:role/wraps-email-role",
          assumeRolePolicyDocument: "",
        },
      ],
    };

    mockScanFn.mockResolvedValue(filteredScan);
    mockFilterFn.mockReturnValue(filteredScan);

    const { emailDoctor } = await import("../email/doctor.js");
    await emailDoctor({});

    const allOutput = consoleLogSpy.mock.calls
      .map((c) => c.join(" "))
      .join("\n");
    expect(allOutput).toContain("wraps-email-config-set");
    expect(allOutput).toContain("wraps-email-role");
    expect(allOutput).toContain("wraps-email-events");
  });

  it("should report orphaned resources when no Pulumi stack exists", async () => {
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

    mockScanFn.mockResolvedValue(filteredScan);
    mockFilterFn.mockReturnValue(filteredScan);

    const { emailDoctor } = await import("../email/doctor.js");
    await emailDoctor({});

    const allOutput = consoleLogSpy.mock.calls
      .map((c) => c.join(" "))
      .join("\n");
    expect(allOutput).toContain("orphan");
  });

  it("should delete orphaned resources when --cleanup and user confirms", async () => {
    const filteredScan: AWSResourceScan = {
      identities: [],
      configurationSets: [
        { name: "wraps-email-config-set", eventDestinations: [] },
      ],
      snsTopics: [
        {
          name: "wraps-email-bounce",
          arn: "arn:aws:sns:us-east-1:123:wraps-email-bounce",
        },
      ],
      dynamoTables: [],
      lambdaFunctions: [],
      iamRoles: [],
    };

    mockScanFn.mockResolvedValue(filteredScan);
    mockFilterFn.mockReturnValue(filteredScan);

    vi.mocked(prompts.confirm).mockResolvedValue(true as never);

    const { emailDoctor } = await import("../email/doctor.js");
    await emailDoctor({ cleanup: true });

    expect(vi.mocked(prompts.confirm)).toHaveBeenCalled();

    // Verify SES delete was called with the right config set name
    expect(mockSesSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { ConfigurationSetName: "wraps-email-config-set" },
      })
    );

    // Verify SNS delete was called with the right topic ARN
    expect(mockSnsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { TopicArn: "arn:aws:sns:us-east-1:123:wraps-email-bounce" },
      })
    );
  });

  it("should detach managed policies before deleting IAM roles during cleanup", async () => {
    const filteredScan: AWSResourceScan = {
      identities: [],
      configurationSets: [],
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

    mockScanFn.mockResolvedValue(filteredScan);
    mockFilterFn.mockReturnValue(filteredScan);
    vi.mocked(prompts.confirm).mockResolvedValue(true as never);

    // IAM send call order: ListRolePolicies, DeleteRolePolicy, ListAttachedRolePolicies, DetachRolePolicy, DeleteRole
    mockIamSend
      .mockResolvedValueOnce({ PolicyNames: ["wraps-inline-policy"] }) // ListRolePolicies
      .mockResolvedValueOnce({}) // DeleteRolePolicy (inline)
      .mockResolvedValueOnce({
        AttachedPolicies: [{ PolicyArn: "arn:aws:iam::123:policy/managed" }],
      }) // ListAttachedRolePolicies
      .mockResolvedValueOnce({}) // DetachRolePolicy
      .mockResolvedValueOnce({}); // DeleteRole

    const { emailDoctor } = await import("../email/doctor.js");
    await emailDoctor({ cleanup: true });

    // Should have called send 5 times for this role:
    // 1. ListRolePolicies, 2. DeleteRolePolicy (inline), 3. ListAttachedRolePolicies,
    // 4. DetachRolePolicy (managed), 5. DeleteRole
    expect(mockIamSend).toHaveBeenCalledTimes(5);
  });

  it("should warn when --cleanup is passed but a Pulumi stack exists", async () => {
    // Override the Pulumi mock to simulate an existing stack
    vi.mocked(
      pulumi.automation.LocalWorkspace.selectStack
    ).mockResolvedValueOnce({} as never);

    const filteredScan: AWSResourceScan = {
      identities: [],
      configurationSets: [
        { name: "wraps-email-config-set", eventDestinations: [] },
      ],
      snsTopics: [],
      dynamoTables: [],
      lambdaFunctions: [],
      iamRoles: [],
    };

    mockScanFn.mockResolvedValue(filteredScan);
    mockFilterFn.mockReturnValue(filteredScan);

    const { emailDoctor } = await import("../email/doctor.js");
    await emailDoctor({ cleanup: true });

    // Should NOT prompt for confirmation (cleanup is not applicable)
    expect(vi.mocked(prompts.confirm)).not.toHaveBeenCalled();

    // Should warn the user about using destroy instead
    expect(vi.mocked(prompts.log.warn)).toHaveBeenCalledWith(
      expect.stringContaining("wraps email destroy")
    );
  });
});
