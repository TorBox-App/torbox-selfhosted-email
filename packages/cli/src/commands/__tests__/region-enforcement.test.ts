/**
 * Region enforcement regression test.
 *
 * The bug: when a user selects a region other than us-east-1 (e.g. us-west-1),
 * one or more AWS SDK clients instantiated during `wraps email init` are
 * created with `region: "us-east-1"` or `region: undefined` instead of the
 * user's selected region. This test reproduces the leak by spying on every
 * `@aws-sdk/client-*` constructor used by the init flow and asserting each
 * one received `region: "us-west-1"`. It also asserts that the Pulumi stack
 * is configured with `aws:region = us-west-1` and that `AWS_REGION` is set
 * to us-west-1 in the env passed to the Pulumi workspace.
 *
 * Intentionally does NOT mock internal CLI functions (no `vi.mock`
 * of `../../utils/shared/aws.js`). Mocks live only at SDK boundaries
 * (@aws-sdk/client-*) and Pulumi automation. This way, a real default
 * or hardcode inside aws.ts / iam-check.ts / preflight.ts / email-stack.ts
 * will surface as a region mismatch rather than being hidden by a whole-
 * module mock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -----------------------------------------------------------------------------
// Hoisted constructor-region spies. Recorded across every AWS SDK client
// instantiated during the init flow. Keyed by client-class name.
// -----------------------------------------------------------------------------

const { regionCalls, resetRegionCalls, makeFakeClient } = vi.hoisted(() => {
  const calls: Array<{ client: string; region: unknown }> = [];

  function reset() {
    calls.length = 0;
  }

  /**
   * Factory for a fake SDK client class. Records the `region` field from
   * whatever config the caller passes to `new Client(config)`, then returns
   * an object with a `send()` that returns a caller-supplied default.
   */
  function make(clientName: string, defaultResponse: unknown = {}) {
    return class FakeClient {
      config: { region: unknown };
      constructor(config: { region?: unknown } = {}) {
        this.config = { region: config?.region };
        calls.push({ client: clientName, region: config?.region });
      }
      // biome-ignore lint/suspicious/noExplicitAny: test double, shape is intentionally loose
      send(_cmd: any): Promise<any> {
        return Promise.resolve(defaultResponse);
      }
    };
  }

  return { regionCalls: calls, resetRegionCalls: reset, makeFakeClient: make };
});

// -----------------------------------------------------------------------------
// AWS SDK v3 mocks — every client the init flow might construct.
//
// Each factory returns a class-based stub so `new Client(...)` works, records
// the region, and responds with enough shape to let the flow progress.
// -----------------------------------------------------------------------------

vi.mock("@aws-sdk/client-sts", () => {
  const FakeSTS = makeFakeClient("STSClient", {
    Account: "123456789012",
    UserId: "AIDAI123456789",
    Arn: "arn:aws:iam::123456789012:user/test",
  });
  return {
    STSClient: FakeSTS,
    GetCallerIdentityCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-ses", () => {
  const FakeSES = makeFakeClient("SESClient", {
    Identities: [],
    VerificationAttributes: {},
  });
  return {
    SESClient: FakeSES,
    ListIdentitiesCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetIdentityVerificationAttributesCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    ListConfigurationSetsCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    DescribeConfigurationSetCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-sesv2", () => {
  const FakeSESv2 = makeFakeClient("SESv2Client", {
    ProductionAccessEnabled: true,
  });
  return {
    SESv2Client: FakeSESv2,
    GetAccountCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetConfigurationSetCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetConfigurationSetEventDestinationsCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetEmailIdentityCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-iam", () => {
  const FakeIAM = makeFakeClient("IAMClient", {
    EvaluationResults: [],
    Roles: [],
  });
  return {
    IAMClient: FakeIAM,
    SimulatePrincipalPolicyCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    ListRolesCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-sns", () => {
  const FakeSNS = makeFakeClient("SNSClient", { Topics: [] });
  return {
    SNSClient: FakeSNS,
    ListTopicsCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetTopicAttributesCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-dynamodb", () => {
  const FakeDynamo = makeFakeClient("DynamoDBClient", { TableNames: [] });
  return {
    DynamoDBClient: FakeDynamo,
    ListTablesCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    DescribeTableCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-lambda", () => {
  const FakeLambda = makeFakeClient("LambdaClient", { Functions: [] });
  return {
    LambdaClient: FakeLambda,
    ListFunctionsCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-acm", () => {
  const FakeACM = makeFakeClient("ACMClient", {});
  return {
    ACMClient: FakeACM,
    DescribeCertificateCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/client-route-53", () => {
  const FakeR53 = makeFakeClient("Route53Client", { HostedZones: [] });
  return {
    Route53Client: FakeR53,
    ListHostedZonesCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

// -----------------------------------------------------------------------------
// Non-SDK mocks — these are NOT the subject under test, only plumbing.
// We leave aws.ts, iam-check.ts, preflight.ts, scanner.ts, etc. UNMOCKED so
// any hardcoded `region: "us-east-1"` inside those modules surfaces as a
// region mismatch in the captured `regionCalls`.
// -----------------------------------------------------------------------------

// aws-detection is filesystem-heavy (SSO cache, AWS config files); stub it.
vi.mock("../../utils/shared/aws-detection.js", () => ({
  detectAWSState: vi.fn().mockResolvedValue({
    cliInstalled: true,
    cliVersion: "2.15.0",
    credentialsConfigured: true,
    credentialSource: "environment",
    profileName: "default",
    accountId: "123456789012",
    detectedProvider: null,
    region: "us-west-1",
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

// Pulumi automation — capture setConfig/envVars so we can assert the stack
// was configured for the user-selected region.
const pulumiCaptured: {
  setConfigCalls: Array<[string, { value: string }]>;
  workspaceEnvVars: Record<string, string> | null;
  stackName: string | null;
} = {
  setConfigCalls: [],
  workspaceEnvVars: null,
  stackName: null,
};

vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      createOrSelectStack: vi
        .fn()
        // biome-ignore lint/suspicious/noExplicitAny: test stub, loose shape
        .mockImplementation(async (args: any, opts: any) => {
          pulumiCaptured.stackName = args?.stackName ?? null;
          pulumiCaptured.workspaceEnvVars = opts?.envVars ?? null;
          return {
            workspace: {
              selectStack: vi.fn().mockResolvedValue(undefined),
            },
            setConfig: vi
              .fn()
              .mockImplementation(
                async (key: string, value: { value: string }) => {
                  pulumiCaptured.setConfigCalls.push([key, value]);
                }
              ),
            up: vi.fn().mockResolvedValue({
              outputs: {
                roleArn: {
                  value: "arn:aws:iam::123456789012:role/wraps-email-role",
                },
                configSetName: { value: "wraps-email-tracking" },
                dkimTokens: { value: ["token1", "token2", "token3"] },
                domain: { value: "example.com" },
                region: { value: "us-west-1" },
              },
            }),
          };
        }),
    },
    installPulumiCli: vi.fn(),
  },
}));

vi.mock("@pulumi/pulumi/automation", () => ({
  LocalWorkspace: {
    // biome-ignore lint/suspicious/noExplicitAny: test stub, loose shape
    createOrSelectStack: vi.fn().mockImplementation(async (_args: any) => ({
      workspace: { selectStack: vi.fn().mockResolvedValue(undefined) },
      setConfig: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue({ outputs: {} }),
    })),
    installPulumiCli: vi.fn(),
  },
}));

// Clack prompts — never prompt the user. All values come from init() options.
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
  isCancel: vi.fn().mockReturnValue(false),
  confirm: vi.fn().mockResolvedValue(false),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  select: vi.fn(),
  text: vi.fn(),
}));

// Prompts utility — we pass all options explicitly, but preflight etc. may
// reach into these for confirmations. Stub to non-interactive defaults.
vi.mock("../../utils/shared/prompts.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../utils/shared/prompts.js")
  >("../../utils/shared/prompts.js");
  return {
    ...actual,
    confirmDeploy: vi.fn().mockResolvedValue(true),
    promptProvider: vi.fn().mockResolvedValue("aws"),
    promptRegion: vi.fn().mockResolvedValue("us-west-1"),
    promptDomain: vi.fn().mockResolvedValue("example.com"),
    promptConfigPreset: vi.fn().mockResolvedValue("starter"),
    promptEstimatedVolume: vi.fn().mockResolvedValue("1k-10k"),
    promptVercelConfig: vi
      .fn()
      .mockResolvedValue({ teamSlug: "t", projectName: "p" }),
    promptMailFromSubdomain: vi.fn().mockResolvedValue("mail.example.com"),
    promptEmailArchiving: vi.fn().mockResolvedValue({ enabled: false }),
    promptDNSProvider: vi.fn().mockResolvedValue("manual"),
    promptDNSConfirmation: vi.fn().mockResolvedValue({
      shouldCreate: false,
      selectedCategories: new Set(),
    }),
    promptDNSRecordSelection: vi.fn().mockResolvedValue({
      shouldCreate: false,
      selectedCategories: new Set(),
    }),
    promptContinueManualDNS: vi.fn().mockResolvedValue(true),
  };
});

// Metadata (filesystem writes). Stub the writer so the test doesn't touch
// ~/.wraps. We leave createConnectionMetadata real so region propagation
// through metadata is exercised.
vi.mock("../../utils/shared/metadata.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../utils/shared/metadata.js")
  >("../../utils/shared/metadata.js");
  return {
    ...actual,
    loadConnectionMetadata: vi.fn().mockReturnValue(null),
    saveConnectionMetadata: vi.fn().mockResolvedValue(undefined),
  };
});

// Filesystem helpers (pulumi work dir).
vi.mock("../../utils/shared/fs.js", () => ({
  ensurePulumiWorkDir: vi.fn().mockResolvedValue(undefined),
  getPulumiWorkDir: vi.fn().mockReturnValue("/tmp/wraps-test"),
}));

// Pulumi CLI install check.
vi.mock("../../utils/shared/pulumi.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../utils/shared/pulumi.js")
  >("../../utils/shared/pulumi.js");
  return {
    ...actual,
    ensurePulumiInstalled: vi.fn().mockResolvedValue(false),
    previewWithResourceChanges: vi.fn().mockResolvedValue({
      changeSummary: {},
      resourceChanges: [],
    }),
    withLockRetry: (fn: () => Promise<unknown>) => fn(),
  };
});

// Email stack deploy — not what we're testing; we care about everything
// that happens before/around it on the region front. Return a minimal
// stack output.
vi.mock("../../infrastructure/email-stack.js", () => ({
  deployEmailStack: vi.fn().mockResolvedValue({
    roleArn: "arn:aws:iam::123456789012:role/wraps-email-role",
    configSetName: "wraps-email-tracking",
    region: "us-west-1",
    domain: "example.com",
    dkimTokens: ["t1", "t2", "t3"],
  }),
}));

// DNS detection — no real network calls.
vi.mock("../../utils/dns/index.js", () => ({
  detectAvailableDNSProviders: vi
    .fn()
    .mockResolvedValue([
      { provider: "manual", detected: true, hint: "manual" },
    ]),
  getDNSCredentials: vi.fn().mockResolvedValue({ valid: false, error: "none" }),
  createDNSRecordsForProvider: vi
    .fn()
    .mockResolvedValue({ success: true, recordsCreated: 0 }),
  getDNSProviderDisplayName: vi.fn().mockReturnValue("Manual"),
  getDNSProviderTokenUrl: vi.fn().mockReturnValue(""),
  buildEmailDNSRecords: vi.fn().mockReturnValue([]),
  formatManualDNSInstructions: vi.fn().mockReturnValue(""),
}));

// Route53 utils.
vi.mock("../../utils/route53.js", () => ({
  findHostedZone: vi.fn().mockResolvedValue(null),
  previewDNSChanges: vi.fn().mockResolvedValue({
    records: [],
    hasConflicts: false,
    conflictCount: 0,
    newCount: 0,
    updateCount: 0,
    noChangeCount: 0,
  }),
  createSelectedDNSRecords: vi.fn().mockResolvedValue(undefined),
}));

// JSON mode — keep at defaults, but we pass yes: true in options.

// Telemetry — no network.
vi.mock("../../telemetry/events.js", () => ({
  trackServiceInit: vi.fn(),
  trackServiceDeployed: vi.fn(),
  trackError: vi.fn(),
}));

// -----------------------------------------------------------------------------
// Import the command under test AFTER all mocks are declared.
// -----------------------------------------------------------------------------
import { init } from "../email/init.js";

describe("init() region enforcement", () => {
  const USER_REGION = "us-west-1";

  beforeEach(() => {
    resetRegionCalls();
    pulumiCaptured.setConfigCalls.length = 0;
    pulumiCaptured.workspaceEnvVars = null;
    pulumiCaptured.stackName = null;
    // Scrub AWS env so nothing accidentally defaults for us.
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.AWS_PROFILE;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("constructs no AWS SDK client with a hardcoded us-east-1 when the user selected a different region", async () => {
    await init({
      provider: "aws",
      region: USER_REGION,
      domain: "example.com",
      preset: "starter",
      yes: true,
      quick: true,
    });

    // Sanity: we should have constructed at least one SDK client.
    expect(regionCalls.length).toBeGreaterThan(0);

    // Global services (STS GetCallerIdentity, IAM control plane) are
    // identity/global — any region (including us-east-1 or undefined) is
    // acceptable on those clients since the endpoint is global.
    const GLOBAL_CLIENTS = new Set(["STSClient", "IAMClient"]);

    // Regional clients MUST be constructed with the user's selected region.
    // A literal "us-east-1" when the user picked "us-west-1" is the core bug.
    const leaks = regionCalls.filter((c) => {
      if (GLOBAL_CLIENTS.has(c.client)) {
        return false;
      }
      return c.region !== USER_REGION;
    });

    expect(
      leaks,
      `Found ${leaks.length} SDK client(s) with a region leak. ` +
        `Regional services must use region=${USER_REGION}; a hardcoded ` +
        `"us-east-1" anywhere is a bug:\n` +
        leaks
          .map(
            (l) => `  - ${l.client} constructed with region=${String(l.region)}`
          )
          .join("\n") +
        `\n\nFull region call log:\n` +
        regionCalls
          .map((c) => `  - ${c.client} region=${String(c.region)}`)
          .join("\n")
    ).toHaveLength(0);
  });

  it("configures the Pulumi stack with the user-selected region", async () => {
    await init({
      provider: "aws",
      region: USER_REGION,
      domain: "example.com",
      preset: "starter",
      yes: true,
      quick: true,
    });

    // The stack name MUST include the user region.
    expect(pulumiCaptured.stackName).toBe(`wraps-123456789012-${USER_REGION}`);

    // `aws:region` config must equal user region.
    const awsRegionConfig = pulumiCaptured.setConfigCalls.find(
      ([key]) => key === "aws:region"
    );
    expect(awsRegionConfig, "aws:region config was never set").toBeDefined();
    expect(awsRegionConfig?.[1].value).toBe(USER_REGION);

    // Workspace AWS_REGION env var must equal user region.
    expect(pulumiCaptured.workspaceEnvVars?.AWS_REGION).toBe(USER_REGION);
  });
});
