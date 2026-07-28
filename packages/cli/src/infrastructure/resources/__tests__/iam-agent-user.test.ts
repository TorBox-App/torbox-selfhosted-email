import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Plan 147: the enforcer invoke grant used to be hardcoded to the platform's
 * `wraps-console-access-role`, so a self-hosted control plane (which assumes
 * `wraps-selfhost-console-access-role`) never got the grant and the approval
 * flow's execute step failed with an IAM denial — silently, because a missing
 * role is skipped with a warning rather than failing the stack.
 *
 * These tests pin BOTH the fix and the thing the fix must not break: the
 * platform grant keeps the pre-existing Pulumi logical name
 * `wraps-agent-invoke`. Pulumi keys state by logical name, so renaming it (or
 * handing it to the self-hosted role) would make every deployed customer stack
 * destroy and recreate the policy on its next upgrade.
 */

type MockRolePolicyArgs = {
  role: string;
  policy: string;
};

type PolicyDocument = {
  Version: string;
  Statement: Array<Record<string, unknown>>;
};

const pulumiState = vi.hoisted(() => {
  const createdRolePolicies: Array<{
    logicalName: string;
    args: MockRolePolicyArgs;
  }> = [];

  class MockRolePolicy {
    constructor(logicalName: string, args: MockRolePolicyArgs) {
      const duplicate = createdRolePolicies.some(
        (existing) => existing.logicalName === logicalName
      );
      if (duplicate) {
        // Mirrors Pulumi's duplicate-URN failure: two resources of the same
        // type may not share a logical name within one stack.
        throw new Error(`duplicate resource URN: ${logicalName}`);
      }
      createdRolePolicies.push({ logicalName, args });
    }
  }

  return { createdRolePolicies, MockRolePolicy };
});

vi.mock("@pulumi/aws", () => ({
  iam: {
    RolePolicy: pulumiState.MockRolePolicy,
  },
}));

vi.mock("../../shared/resource-checks.js", () => ({
  roleExists: vi.fn(),
}));

import { roleExists } from "../../shared/resource-checks.js";
import { attachConsoleRoleInvoke } from "../iam-agent-user.js";

const PLATFORM_ROLE = "wraps-console-access-role";
const SELFHOST_ROLE = "wraps-selfhost-console-access-role";

const enforcerArn = {
  apply: <U>(fn: (arn: string) => U): U =>
    fn("arn:aws:lambda:us-east-1:123456789012:function:wraps-agent-enforcer"),
};

function callAttach() {
  return attachConsoleRoleInvoke({
    // The real signature takes a `pulumi.Output<string>`; the test double only
    // needs `.apply`.
    enforcerArn: enforcerArn as unknown as Parameters<
      typeof attachConsoleRoleInvoke
    >[0]["enforcerArn"],
  });
}

function mockRoles(present: string[]) {
  vi.mocked(roleExists).mockImplementation((roleName: string) =>
    Promise.resolve(present.includes(roleName))
  );
}

describe("attachConsoleRoleInvoke", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pulumiState.createdRolePolicies.length = 0;
    vi.mocked(roleExists).mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // silence expected warnings
    });
  });

  it("grants only the platform role when only it exists", async () => {
    mockRoles([PLATFORM_ROLE]);

    await callAttach();

    expect(pulumiState.createdRolePolicies).toHaveLength(1);
    expect(pulumiState.createdRolePolicies[0]?.logicalName).toBe(
      "wraps-agent-invoke"
    );
    expect(pulumiState.createdRolePolicies[0]?.args.role).toBe(PLATFORM_ROLE);

    const policy = JSON.parse(
      pulumiState.createdRolePolicies[0]?.args.policy ?? "{}"
    ) as PolicyDocument;
    expect(policy).toEqual({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: "lambda:InvokeFunction",
          Resource:
            "arn:aws:lambda:us-east-1:123456789012:function:wraps-agent-enforcer",
        },
      ],
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("grants the self-hosted role when only it exists", async () => {
    mockRoles([SELFHOST_ROLE]);

    await callAttach();

    expect(pulumiState.createdRolePolicies).toHaveLength(1);
    expect(pulumiState.createdRolePolicies[0]?.logicalName).toBe(
      "wraps-agent-invoke-selfhost"
    );
    expect(pulumiState.createdRolePolicies[0]?.args.role).toBe(SELFHOST_ROLE);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("grants both roles, under distinct logical names, when both exist", async () => {
    mockRoles([PLATFORM_ROLE, SELFHOST_ROLE]);

    await callAttach();

    expect(pulumiState.createdRolePolicies).toHaveLength(2);
    expect(
      pulumiState.createdRolePolicies.map((entry) => ({
        logicalName: entry.logicalName,
        role: entry.args.role,
      }))
    ).toEqual([
      { logicalName: "wraps-agent-invoke", role: PLATFORM_ROLE },
      { logicalName: "wraps-agent-invoke-selfhost", role: SELFHOST_ROLE },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns once, naming both roles, when neither exists", async () => {
    mockRoles([]);

    await callAttach();

    expect(pulumiState.createdRolePolicies).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const message = String(warnSpy.mock.calls[0]?.[0]);
    expect(message).toContain(PLATFORM_ROLE);
    expect(message).toContain(SELFHOST_ROLE);
    // Both hints must name commands the CLI actually routes (`cli.ts`
    // `platform` → connect and `selfhost` → connect). There is no
    // `--selfhosted` flag on `platform connect`.
    expect(message).toContain("wraps platform connect");
    expect(message).toContain("wraps selfhost connect");
  });
});
