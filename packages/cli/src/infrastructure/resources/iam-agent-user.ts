import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import { getDefaultRegion } from "../../constants.js";
import { roleExists } from "../shared/resource-checks.js";

const CONSOLE_ACCESS_ROLE = "wraps-console-access-role";

/**
 * Check if IAM user exists (for Pulumi import-vs-create).
 * Mirrors the probe in resources/smtp-credentials.ts.
 */
async function userExists(userName: string): Promise<boolean> {
  try {
    const { IAMClient, GetUserCommand } = await import("@aws-sdk/client-iam");
    const iam = new IAMClient({
      region: getDefaultRegion(),
    });
    await iam.send(new GetUserCommand({ UserName: userName }));
    return true;
  } catch (error) {
    const iamError = error as Error & { Code?: string };
    if (
      error instanceof Error &&
      (iamError.name === "NoSuchEntityException" ||
        iamError.Code === "NoSuchEntity")
    ) {
      return false;
    }
    return false;
  }
}

/**
 * Agent IAM user configuration
 */
export type AgentUserConfig = {
  /** Agent name — becomes the `wraps-agent-{name}` user */
  name: string;
  /**
   * Qualified enforcer alias ARN this credential may invoke. Pinning the grant
   * to the per-agent alias (not the unqualified function) binds the invoke
   * identity: the enforcer derives the caller agent from the alias qualifier,
   * so a leaked credential can only ever act as its own agent (SEC-2).
   */
  enforcerArn: pulumi.Output<string>;
};

/**
 * Agent IAM user resources output
 */
export type AgentUserResources = {
  iamUser: aws.iam.User;
  accessKey: aws.iam.AccessKey;
};

/**
 * Create a per-agent IAM user + access key.
 *
 * The identity policy grants `lambda:InvokeFunction` on the enforcer ARN and
 * nothing else — the credential can never reach SES directly. Access-key
 * secret is exposed as a Pulumi `Output` (shown once by the command layer),
 * mirroring the smtp-credentials pattern.
 */
export async function createAgentUser(
  config: AgentUserConfig
): Promise<AgentUserResources> {
  const userName = `wraps-agent-${config.name}`;

  const exists = await userExists(userName);

  const iamUser = exists
    ? new aws.iam.User(
        userName,
        {
          name: userName,
          tags: {
            ManagedBy: "wraps-cli",
            Service: "email-agents",
            Purpose: "Scoped agent send credential",
          },
        },
        { import: userName }
      )
    : new aws.iam.User(userName, {
        name: userName,
        tags: {
          ManagedBy: "wraps-cli",
          Service: "email-agents",
          Purpose: "Scoped agent send credential",
        },
      });

  // Identity policy: invoke the per-agent enforcer alias ONLY (qualified ARN).
  // No ses:* — the leash. The unqualified function stays reachable only by the
  // platform console role (execute path).
  new aws.iam.UserPolicy(`wraps-agent-${config.name}-invoke`, {
    user: iamUser.name,
    policy: config.enforcerArn.apply((arn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "lambda:InvokeFunction",
            Resource: arn,
          },
        ],
      })
    ),
  });

  const accessKey = new aws.iam.AccessKey(`wraps-agent-${config.name}-key`, {
    user: iamUser.name,
  });

  return {
    iamUser,
    accessKey,
  };
}

/**
 * Grant the platform-connect role (`wraps-console-access-role`) permission to
 * invoke the enforcer — this is what lets the approval flow execute sends via
 * assume-role.
 *
 * Skipped with a warning (never a hard failure) when the role is absent, so a
 * stack without platform connect still deploys. The create command (Chunk 5)
 * hard-stops earlier when platform connect is required for the approval flow.
 */
export async function attachConsoleRoleInvoke(config: {
  enforcerArn: pulumi.Output<string>;
}): Promise<void> {
  const exists = await roleExists(CONSOLE_ACCESS_ROLE);
  if (!exists) {
    console.warn(
      `⚠ Role ${CONSOLE_ACCESS_ROLE} not found — skipping enforcer invoke grant.\n` +
        "  Run 'wraps platform connect' first so the approval flow can execute sends."
    );
    return;
  }

  new aws.iam.RolePolicy("wraps-agent-invoke", {
    role: CONSOLE_ACCESS_ROLE,
    policy: config.enforcerArn.apply((arn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "lambda:InvokeFunction",
            Resource: arn,
          },
        ],
      })
    ),
  });
}
