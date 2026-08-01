import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
  UpdateAssumeRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Do NOT vi.mock("@aws-sdk/client-iam") — mockClient patches the prototype directly.
vi.mock("@clack/prompts");
vi.mock("../../utils/shared/aws.js");
vi.mock("../../utils/shared/metadata.js");
vi.mock("../../utils/shared/json-output.js");
vi.mock("../../utils/shared/region-resolver.js");
vi.mock("../../telemetry/events.js");

import * as prompts from "@clack/prompts";
import * as aws from "../../utils/shared/aws.js";
import * as metadata from "../../utils/shared/metadata.js";
import * as regionResolver from "../../utils/shared/region-resolver.js";
import { updateRole } from "../platform/update-role.js";

const iamMock = mockClient(IAMClient);

const CUSTOMER_ACCOUNT_ID = "123456789012";
const WRAPS_PLATFORM_ACCOUNT_ID = "905130073023";

/**
 * Built fresh per test rather than shared by reference: commands in this
 * codebase assign onto the object `loadConnectionMetadata` returns, and a
 * module-level fixture makes later tests pass for the wrong reason.
 */
const baseMetadata = () => ({
  version: "1.0.0",
  accountId: CUSTOMER_ACCOUNT_ID,
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2026-07-28T00:00:00.000Z",
  services: {
    sms: { config: { sendingEnabled: true }, preset: "production" },
  },
});

/** Both control planes have issued an identity for this account. */
const bothIdentities = () => ({
  ...baseMetadata(),
  platform: { externalId: "plat-ext-1", connectionId: "plat-conn-1" },
  selfhostPlatform: { externalId: "sh-ext-1", connectionId: "sh-conn-1" },
});

/** Both identities AND a deployed self-hosted control plane on this machine. */
const bothIdentitiesWithSelfhostDeployed = () => {
  const base = bothIdentities();
  return {
    ...base,
    services: {
      ...base.services,
      selfhost: {
        deployedAt: "2026-07-28T00:00:00.000Z",
        pulumiStackName: "wraps-selfhost-123456789012-us-east-1",
        apiUrl: "https://abc123.lambda-url.us-east-1.on.aws",
        config: {
          databaseUrl: "postgres://user:pass@db.example.com:5432/wraps",
          betterAuthSecret: "deadbeefcafe1234",
          unsubscribeSecret: "feedfacecafe1234",
          licenseKey: "v1.scale.2027-01-01.abc",
          appUrl: "https://app.example.com",
        },
      },
    },
  };
};

const trustPolicyFromUpdate = () => {
  const updateCalls = iamMock.commandCalls(UpdateAssumeRolePolicyCommand);
  expect(updateCalls).toHaveLength(1);
  // biome-ignore lint/style/noNonNullAssertion: the SDK input is always set here
  return JSON.parse(updateCalls[0].args[0].input.PolicyDocument!);
};

/** Every action granted by the inline policy the command writes, flattened. */
const grantedActionsFromPut = (): string[] => {
  const putCalls = iamMock.commandCalls(PutRolePolicyCommand);
  expect(putCalls).toHaveLength(1);
  // biome-ignore lint/style/noNonNullAssertion: the SDK input is always set here
  const doc = JSON.parse(putCalls[0].args[0].input.PolicyDocument!);
  return doc.Statement.flatMap((s: { Action: string[] }) => s.Action);
};

describe("platform update-role - console role selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    iamMock.reset();

    const mockSpinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };
    vi.mocked(prompts.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(prompts.intro).mockImplementation(() => {});
    vi.mocked(prompts.outro).mockImplementation(() => {});
    vi.mocked(prompts.isCancel).mockReturnValue(false);
    vi.mocked(prompts.log).info = vi.fn();
    vi.mocked(prompts.log).success = vi.fn();
    vi.mocked(prompts.log).error = vi.fn();
    vi.mocked(prompts.log).warn = vi.fn();
    vi.mocked(prompts.log).step = vi.fn();

    vi.mocked(aws.validateAWSCredentials).mockResolvedValue({
      accountId: CUSTOMER_ACCOUNT_ID,
      userId: "AIDACKCEVSQ6C2EXAMPLE",
      arn: `arn:aws:iam::${CUSTOMER_ACCOUNT_ID}:user/test`,
    });
    vi.mocked(regionResolver.resolveRegionForCommand).mockResolvedValue(
      "us-east-1"
    );
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      bothIdentities() as never
    );

    // Role exists → PutRolePolicy + UpdateAssumeRolePolicy (repair) path.
    iamMock.on(GetRoleCommand).resolves({});
    iamMock.on(CreateRoleCommand).resolves({});
    iamMock.on(PutRolePolicyCommand).resolves({});
    iamMock.on(UpdateAssumeRolePolicyCommand).resolves({});
  });

  it("targets the self-hosted role when --selfhosted is passed", async () => {
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      bothIdentities() as never
    );

    await updateRole({ selfhosted: true, force: true });

    const getCalls = iamMock.commandCalls(GetRoleCommand);
    expect(getCalls).toHaveLength(1);
    expect(getCalls[0].args[0].input.RoleName).toBe(
      "wraps-selfhost-console-access-role"
    );

    const putCalls = iamMock.commandCalls(PutRolePolicyCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input.RoleName).toBe(
      "wraps-selfhost-console-access-role"
    );
  });

  it("trusts the customer's own AWS account when --selfhosted is passed", async () => {
    // Self-hosters run the dashboard in their own account; trusting the Wraps
    // platform account would leave their control plane unable to AssumeRole.
    await updateRole({ selfhosted: true, force: true });

    const trustPolicy = trustPolicyFromUpdate();
    expect(trustPolicy.Statement[0].Principal.AWS).toBe(
      `arn:aws:iam::${CUSTOMER_ACCOUNT_ID}:root`
    );
    expect(trustPolicy.Statement[0].Principal.AWS).not.toContain(
      WRAPS_PLATFORM_ACCOUNT_ID
    );
    expect(
      trustPolicy.Statement[0].Condition.StringEquals["sts:ExternalId"]
    ).toBe("sh-ext-1");
  });

  it("uses the self-hosted external ID, not the platform's", async () => {
    // The regression this command existed to cause: each plane issues its own
    // externalId, and writing the platform's into the self-hosted role's trust
    // policy produces a role the self-hosted plane can never assume.
    await updateRole({ selfhosted: true, force: true });

    const trustPolicy = trustPolicyFromUpdate();
    const externalId =
      trustPolicy.Statement[0].Condition.StringEquals["sts:ExternalId"];
    expect(externalId).toBe("sh-ext-1");
    expect(externalId).not.toBe("plat-ext-1");
  });

  it("leaves platform behavior unchanged when no flag is passed", async () => {
    await updateRole({ force: true });

    const getCalls = iamMock.commandCalls(GetRoleCommand);
    expect(getCalls[0].args[0].input.RoleName).toBe(
      "wraps-console-access-role"
    );

    const trustPolicy = trustPolicyFromUpdate();
    expect(trustPolicy.Statement[0].Principal.AWS).toBe(
      `arn:aws:iam::${WRAPS_PLATFORM_ACCOUNT_ID}:root`
    );
    expect(
      trustPolicy.Statement[0].Condition.StringEquals["sts:ExternalId"]
    ).toBe("plat-ext-1");
  });

  it("does not flip the selection just because selfhost metadata is present", async () => {
    // Plan 134's incident encoded as a test: the selection must key off the
    // explicit --selfhosted flag, NEVER off metadata presence. A developer
    // machine that has run `wraps selfhost deploy` would otherwise have every
    // ordinary update-role silently rewrite the platform role to trust the
    // customer account, revoking app.wraps.dev's access.
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      bothIdentitiesWithSelfhostDeployed() as never
    );

    await updateRole({ force: true });

    const getCalls = iamMock.commandCalls(GetRoleCommand);
    expect(getCalls[0].args[0].input.RoleName).toBe(
      "wraps-console-access-role"
    );

    const putCalls = iamMock.commandCalls(PutRolePolicyCommand);
    expect(putCalls[0].args[0].input.RoleName).toBe(
      "wraps-console-access-role"
    );

    const trustPolicy = trustPolicyFromUpdate();
    expect(trustPolicy.Statement[0].Principal.AWS).toBe(
      `arn:aws:iam::${WRAPS_PLATFORM_ACCOUNT_ID}:root`
    );
    expect(
      trustPolicy.Statement[0].Condition.StringEquals["sts:ExternalId"]
    ).toBe("plat-ext-1");
  });

  it("grants ses:ListConfigurationSets alongside the config-set Get actions", async () => {
    // The dashboard's config-set scan calls ListConfigurationSets to discover
    // set names before Get-ing each one. The policy granted only the Get pair,
    // so the scan raised AccessDeniedException for every customer — and the
    // caller swallowed that specific error, so it never surfaced. Get without
    // List is unreachable: assert the whole trio ships together.
    await updateRole({ force: true });

    const actions = grantedActionsFromPut();
    expect(actions).toContain("ses:ListConfigurationSets");
    expect(actions).toContain("ses:GetConfigurationSet");
    expect(actions).toContain("ses:GetConfigurationSetEventDestinations");
  });

  it("grants ses:ListConfigurationSets on the self-hosted role too", async () => {
    await updateRole({ selfhosted: true, force: true });

    expect(grantedActionsFromPut()).toContain("ses:ListConfigurationSets");
  });
});
