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
vi.mock("@pulumi/pulumi", () => ({
  automation: { LocalWorkspace: { createOrSelectStack: vi.fn() } },
}));
vi.mock("@clack/prompts");
vi.mock("../../utils/shared/aws.js");
vi.mock("../../utils/shared/fs.js");
vi.mock("../../utils/shared/metadata.js");
vi.mock("../../utils/shared/pulumi.js");
vi.mock("../../utils/shared/config.js");
vi.mock("../../utils/shared/json-output.js");
vi.mock("../../utils/shared/region-resolver.js");
vi.mock("../../utils/shared/prompts.js");
// Reconcile makes a live Lambda call; mock it to a no-op so connect's unit
// test stays hermetic — leaving selfhostService.apiUrl exactly as the loaded
// metadata sets it (empty stays empty → abort; a set URL stays set). Keep
// normalizeApiUrl real so trailing-slash handling is exercised, not stubbed.
vi.mock("../../utils/selfhost/api-url.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/selfhost/api-url.js")>()),
  reconcileSelfhostApiUrl: vi.fn(),
}));
vi.mock("../../infrastructure/email-stack.js");
vi.mock("../../telemetry/events.js");

import * as prompts from "@clack/prompts";
import * as aws from "../../utils/shared/aws.js";
import * as config from "../../utils/shared/config.js";
import * as fsUtils from "../../utils/shared/fs.js";
import * as jsonOutput from "../../utils/shared/json-output.js";
import * as metadata from "../../utils/shared/metadata.js";
import * as pulumiUtils from "../../utils/shared/pulumi.js";
import * as regionResolver from "../../utils/shared/region-resolver.js";
import { connect } from "../platform/connect.js";

const iamMock = mockClient(IAMClient);

// SMS-only + selfhost: no email means Pulumi EventBridge is skipped,
// isolating the IAM trust policy assertion.
const SELFHOST_SMS_METADATA = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2026-05-26T00:00:00.000Z",
  services: {
    sms: { config: { sendingEnabled: true }, preset: "production" },
    selfhost: {
      deployedAt: "2026-05-26T00:00:00.000Z",
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

const NON_SELFHOST_SMS_METADATA = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2026-05-26T00:00:00.000Z",
  services: {
    sms: { config: { sendingEnabled: true }, preset: "production" },
  },
};

describe("platform connect - selfhost trust policy", () => {
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
      accountId: "123456789012",
      userId: "AIDACKCEVSQ6C2EXAMPLE",
      arn: "arn:aws:iam::123456789012:user/test",
    });

    vi.mocked(regionResolver.resolveRegionForCommand).mockResolvedValue(
      "us-east-1"
    );
    vi.mocked(pulumiUtils.ensurePulumiInstalled).mockResolvedValue(false);
    vi.mocked(fsUtils.ensurePulumiWorkDir).mockResolvedValue(undefined);
    vi.mocked(fsUtils.getPulumiWorkDir).mockReturnValue("/mock/.wraps/pulumi");

    // SaaS connects build their request URL from this; production always
    // returns a real string, so give the auto-mock a sane default.
    vi.mocked(config.getApiBaseUrl).mockReturnValue("https://api.wraps.dev");
    vi.mocked(config.resolveTokenAsync).mockResolvedValue("test-token-123");
    vi.mocked(config.readAuthConfig).mockResolvedValue({
      auth: {
        token: "test-token-123",
        tokenType: "session" as const,
        organizations: [{ id: "org-1", name: "Test Org", slug: "test-org" }],
      },
    });

    // Self-hosted connect resolves a per-instance session, not the SaaS slot.
    vi.mocked(config.resolveSelfhostToken).mockResolvedValue("sh-token-123");
    vi.mocked(config.readSelfhostAuth).mockResolvedValue({
      token: "sh-token-123",
      tokenType: "session" as const,
      organizations: [{ id: "sh-org-1", name: "Self Org", slug: "self-org" }],
    });

    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      SELFHOST_SMS_METADATA as any
    );
    vi.mocked(metadata.saveConnectionMetadata).mockResolvedValue(undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            connectionId: "conn-abc-123",
            externalId: "ext-xyz-456",
            webhookSecret: "webhook-secret-789",
          }),
      })
    );

    // Role does not exist → CreateRole path
    iamMock.on(GetRoleCommand).rejects(
      Object.assign(new Error("NoSuchEntity"), {
        name: "NoSuchEntityException",
      })
    );
    iamMock.on(CreateRoleCommand).resolves({});
    iamMock.on(PutRolePolicyCommand).resolves({});
    iamMock.on(UpdateAssumeRolePolicyCommand).resolves({});
  });

  it("uses the customer account as trusted principal when selfhost metadata is present", async () => {
    await connect({ yes: true });

    const createCalls = iamMock.commandCalls(CreateRoleCommand);
    expect(createCalls).toHaveLength(1);
    const trustPolicy = JSON.parse(
      createCalls[0].args[0].input.AssumeRolePolicyDocument!
    );
    expect(trustPolicy.Statement[0].Principal.AWS).toBe(
      "arn:aws:iam::123456789012:root"
    );
  });

  it("uses Wraps platform account as trusted principal when no selfhost metadata", async () => {
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      NON_SELFHOST_SMS_METADATA as any
    );

    await connect({ yes: true });

    const createCalls = iamMock.commandCalls(CreateRoleCommand);
    expect(createCalls).toHaveLength(1);
    const trustPolicy = JSON.parse(
      createCalls[0].args[0].input.AssumeRolePolicyDocument!
    );
    expect(trustPolicy.Statement[0].Principal.AWS).toBe(
      "arn:aws:iam::905130073023:root"
    );
  });

  it("registers the connection against the self-hosted API URL when selfhosted", async () => {
    await connect({ yes: true, selfhosted: true });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://abc123.lambda-url.us-east-1.on.aws/v1/connections"
    );
  });

  it("strips the trailing slash from a Lambda Function URL before appending the path", async () => {
    // Regression: real Lambda Function URLs always end in `/`, so a naive
    // `${apiUrl}/v1/connections` yields `//v1/connections` which Elysia 404s.
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
      ...SELFHOST_SMS_METADATA,
      services: {
        ...SELFHOST_SMS_METADATA.services,
        selfhost: {
          ...SELFHOST_SMS_METADATA.services.selfhost,
          apiUrl: "https://abc123.lambda-url.us-east-1.on.aws/",
        },
      },
    } as any);

    await connect({ yes: true, selfhosted: true });

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://abc123.lambda-url.us-east-1.on.aws/v1/connections"
    );
  });

  it("uses the self-hosted session token and org, not the SaaS slot", async () => {
    // Regression: a logged-in SaaS session must not leak into a selfhost
    // connect. The org/token come from the per-instance self-hosted session.
    await connect({ yes: true, selfhosted: true });

    const fetchMock = vi.mocked(fetch);
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sh-token-123");
    expect(headers["X-Organization-Id"]).toBe("sh-org-1");
  });

  it("aborts without registering when the self-hosted apiUrl is empty", async () => {
    // An interrupted `selfhost deploy` leaves the service present but with an
    // empty apiUrl — connecting must fail fast, not POST to a malformed URL.
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
      ...SELFHOST_SMS_METADATA,
      services: {
        ...SELFHOST_SMS_METADATA.services,
        selfhost: { ...SELFHOST_SMS_METADATA.services.selfhost, apiUrl: "" },
      },
    } as any);

    const exitError = new Error("process.exit");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw exitError;
    }) as never);

    await expect(connect({ yes: true, selfhosted: true })).rejects.toBe(
      exitError
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("registers against the Wraps Platform API when not selfhosted", async () => {
    vi.mocked(config.getApiBaseUrl).mockReturnValue("https://api.wraps.dev");

    await connect({ yes: true });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.wraps.dev/v1/connections");
  });

  it("aborts a selfhost connect when no auth token is present", async () => {
    // Self-hosted has no manual copy/paste fallback — it must require login
    // against the instance itself, independent of any SaaS session.
    vi.mocked(config.resolveSelfhostToken).mockResolvedValue(null);

    const exitError = new Error("process.exit");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw exitError;
    }) as never);

    await expect(connect({ yes: true, selfhosted: true })).rejects.toBe(
      exitError
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("emits a structured NOT_AUTHENTICATED error in JSON mode", async () => {
    // `--json` consumers must get a parseable error, not human prose.
    vi.mocked(config.resolveSelfhostToken).mockResolvedValue(null);
    vi.mocked(jsonOutput.isJsonMode).mockReturnValue(true);

    const exitError = new Error("process.exit");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw exitError;
    }) as never);

    await expect(
      connect({ yes: true, selfhosted: true, json: true })
    ).rejects.toBe(exitError);

    expect(vi.mocked(jsonOutput.jsonError)).toHaveBeenCalledWith(
      "platform.connect",
      expect.objectContaining({ code: "NOT_AUTHENTICATED" })
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("uses customer account when updating trust policy on an existing role with selfhost metadata", async () => {
    // Role exists → UpdateAssumeRolePolicy path
    iamMock.on(GetRoleCommand).resolves({
      Role: { RoleName: "wraps-console-access-role" } as any,
    });

    await connect({ yes: true });

    const updateCalls = iamMock.commandCalls(UpdateAssumeRolePolicyCommand);
    expect(updateCalls).toHaveLength(1);
    const trustPolicy = JSON.parse(
      updateCalls[0].args[0].input.PolicyDocument!
    );
    expect(trustPolicy.Statement[0].Principal.AWS).toBe(
      "arn:aws:iam::123456789012:root"
    );
  });
});
