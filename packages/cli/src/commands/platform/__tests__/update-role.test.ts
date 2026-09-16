/**
 * Unit tests for `wraps platform update-role`.
 *
 * Plan 333: `--yes` must behave like `--force` (both skip the confirm), and
 * the command must report what it actually did — specifically, a silent skip
 * of the trust-policy repair (when no externalId is stored for this control
 * plane) must become a visible warning and an honest summary line, not a
 * clean "updated" that looks identical to a real repair. That silent-skip
 * case is the CLI 3.9.0 regression this plan exists to guard against.
 *
 * Boundaries mocked: AWS IAM SDK, clack prompts, telemetry, AWS credential
 * validation, region resolution, and connection metadata I/O. The real
 * `updateRole` control flow (including `buildConsolePolicyDocument`) runs
 * against those mocks. JSON output is real (`json-output.js` is not mocked)
 * so envelopes can be parsed straight off `console.log`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../../utils/shared/json-output.js";

const { iamSendMock } = vi.hoisted(() => ({ iamSendMock: vi.fn() }));

vi.mock("@aws-sdk/client-iam", () => {
  class Command {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class GetRoleCommand extends Command {}
  class CreateRoleCommand extends Command {}
  class PutRolePolicyCommand extends Command {}
  class UpdateAssumeRolePolicyCommand extends Command {}
  class IAMClient {
    send = iamSendMock;
  }
  return {
    IAMClient,
    GetRoleCommand,
    CreateRoleCommand,
    PutRolePolicyCommand,
    UpdateAssumeRolePolicyCommand,
  };
});

vi.mock("@clack/prompts");
vi.mock("../../../telemetry/events.js");
vi.mock("../../../utils/shared/aws.js");
vi.mock("../../../utils/shared/metadata.js");
vi.mock("../../../utils/shared/region-resolver.js");

import { UpdateAssumeRolePolicyCommand } from "@aws-sdk/client-iam";
import * as clack from "@clack/prompts";
import * as aws from "../../../utils/shared/aws.js";
import * as metadata from "../../../utils/shared/metadata.js";
import * as regionResolver from "../../../utils/shared/region-resolver.js";
import { updateRole } from "../update-role.js";

const ACCOUNT_ID = "123456789012";
const REGION = "us-east-1";

class ExitError extends Error {
  constructor(public code?: number) {
    super(`process.exit(${code})`);
  }
}

function baseMetadata(overrides: Record<string, unknown> = {}) {
  return {
    version: "1.0.0",
    accountId: ACCOUNT_ID,
    region: REGION,
    provider: "aws",
    timestamp: "2026-07-13T00:00:00.000Z",
    platform: { externalId: "ext-123", connectionId: "conn-1" },
    services: {
      email: {
        preset: "production",
        config: { sendingEnabled: true, domain: "example.com" },
      },
    },
    ...overrides,
  };
}

describe("wraps platform update-role", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setJsonMode(false);
    iamSendMock.mockReset();
    iamSendMock.mockResolvedValue({});

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitError(code);
    }) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    } as never);
    vi.mocked(clack.log).info = vi.fn();
    vi.mocked(clack.log).success = vi.fn();
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.log).warn = vi.fn();
    vi.mocked(clack.log).step = vi.fn();

    vi.mocked(aws.validateAWSCredentials).mockResolvedValue({
      accountId: ACCOUNT_ID,
      userId: "AIDATEST",
      arn: `arn:aws:iam::${ACCOUNT_ID}:user/test`,
    } as never);

    vi.mocked(regionResolver.resolveRegionForCommand).mockResolvedValue(REGION);

    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      baseMetadata() as never
    );
  });

  afterEach(() => {
    setJsonMode(false);
  });

  function jsonEnvelopes(): any[] {
    return consoleLogSpy.mock.calls
      .map((c) => {
        try {
          return JSON.parse(c[0] as string);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  it("--yes skips the confirm and the IAM calls proceed", async () => {
    await updateRole({ yes: true });

    expect(clack.confirm).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(iamSendMock).toHaveBeenCalled();
  });

  it("--force still skips the confirm (regression guard for the --yes alias)", async () => {
    await updateRole({ force: true });

    expect(clack.confirm).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(iamSendMock).toHaveBeenCalled();
  });

  it("neither --yes nor --force → confirms before proceeding", async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true);

    await updateRole({});

    expect(clack.confirm).toHaveBeenCalledTimes(1);
    expect(iamSendMock).toHaveBeenCalled();
  });

  it("update path WITH a stored externalId → repairs the trust policy and reports it", async () => {
    await updateRole({ yes: true });

    const repaired = iamSendMock.mock.calls.some(
      ([cmd]) => cmd instanceof UpdateAssumeRolePolicyCommand
    );
    expect(repaired).toBe(true);
    expect(clack.log.warn).not.toHaveBeenCalled();

    const logText = consoleLogSpy.mock.calls.flat().map(String).join("\n");
    expect(logText).toContain("trust policy: repaired");
  });

  it("update path WITHOUT a stored externalId → does NOT touch the trust policy, warns, and reports it unchanged", async () => {
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      baseMetadata({ platform: {} }) as never
    );

    await updateRole({ yes: true });

    const repaired = iamSendMock.mock.calls.some(
      ([cmd]) => cmd instanceof UpdateAssumeRolePolicyCommand
    );
    expect(repaired).toBe(false);

    expect(clack.log.warn).toHaveBeenCalled();
    const warnText = vi
      .mocked(clack.log.warn)
      .mock.calls.flat()
      .map(String)
      .join("\n");
    expect(warnText).toContain("not");
    expect(warnText.toLowerCase()).toContain("externalid");

    const logText = consoleLogSpy.mock.calls.flat().map(String).join("\n");
    expect(logText).toContain("trust policy: unchanged");
  });

  it("JSON mode, WITH a stored externalId → envelope carries trustPolicyRepaired: true", async () => {
    setJsonMode(true);

    await updateRole({ yes: true, json: true });

    const env = jsonEnvelopes().find(
      (e) => e.command === "platform.update-role"
    );
    expect(env.success).toBe(true);
    expect(env.data.permissionsUpdated).toBe(true);
    expect(env.data.trustPolicyRepaired).toBe(true);
    expect(env.data.externalIdPresent).toBe(true);
  });

  it("JSON mode, WITHOUT a stored externalId → envelope carries trustPolicyRepaired: false", async () => {
    setJsonMode(true);
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue(
      baseMetadata({ platform: {} }) as never
    );

    await updateRole({ yes: true, json: true });

    const env = jsonEnvelopes().find(
      (e) => e.command === "platform.update-role"
    );
    expect(env.success).toBe(true);
    expect(env.data.permissionsUpdated).toBe(true);
    expect(env.data.trustPolicyRepaired).toBe(false);
    expect(env.data.externalIdPresent).toBe(false);

    const repaired = iamSendMock.mock.calls.some(
      ([cmd]) => cmd instanceof UpdateAssumeRolePolicyCommand
    );
    expect(repaired).toBe(false);
  });
});
