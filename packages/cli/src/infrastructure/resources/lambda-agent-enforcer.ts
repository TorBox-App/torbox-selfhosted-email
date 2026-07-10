import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { getLambdaCode } from "./lambda.js";

/**
 * Agent enforcer Lambda configuration
 */
export type LambdaAgentEnforcerConfig = {
  region: string;
  accountId: string;
  /** Table name (env `POLICY_TABLE`) */
  policyTableName: pulumi.Output<string>;
  /** Table ARN — scopes the DynamoDB grant to this table only */
  policyTableArn: pulumi.Output<string>;
  /** Configuration set the enforcer sends through (env `CONFIG_SET`) */
  configSet: string;
  /** Wraps API base URL for the flagged-send webhook (env `WRAPS_API_URL`) */
  wrapsApiUrl: string;
  /** Shared secret for the enforcer→API webhook (env `WRAPS_AGENT_WEBHOOK_SECRET`) */
  webhookSecret: string;
};

/**
 * Agent enforcer Lambda resources output
 */
export type LambdaAgentEnforcerResources = {
  lambdaFunction: aws.lambda.Function;
};

/**
 * Deploy the agent enforcement Lambda.
 *
 * This Lambda is the only thing an agent credential can invoke. It holds
 * `ses:SendEmail` and enforces kill-switch → allowlist → caps before sending,
 * flagging anything out of policy to the Wraps API webhook.
 */
export async function deployAgentEnforcerLambda(
  config: LambdaAgentEnforcerConfig
): Promise<LambdaAgentEnforcerResources> {
  // Get Lambda code directory (pre-bundled in production, bundled on-the-fly in dev)
  const enforcerCode = await getLambdaCode("agent-enforcer");

  // IAM role for enforcer Lambda execution
  const lambdaRole = new aws.iam.Role("wraps-agent-enforcer-role", {
    name: "wraps-agent-enforcer-role",
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email-agents",
    },
  });

  // Attach basic Lambda execution policy (CloudWatch Logs)
  new aws.iam.RolePolicyAttachment("wraps-agent-enforcer-basic-execution", {
    role: lambdaRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });

  // Enforcer policy: SES send (breadth matches the existing send grant in
  // resources/iam.ts) + DynamoDB access scoped to the agent-policy table only.
  new aws.iam.RolePolicy("wraps-agent-enforcer-policy", {
    role: lambdaRole.name,
    policy: config.policyTableArn.apply((tableArn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            // Enforcer sends on the agent's behalf after passing policy checks
            Effect: "Allow",
            Action: "ses:SendEmail",
            Resource: "*",
          },
          {
            // Policy items, time-bucketed counters, and outcome items
            Effect: "Allow",
            Action: [
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
            ],
            Resource: tableArn,
          },
        ],
      })
    ),
  });

  const functionName = "wraps-agent-enforcer";

  // Create enforcer Lambda
  const lambdaFunction = new aws.lambda.Function(functionName, {
    name: functionName,
    runtime: "nodejs24.x",
    handler: "index.handler",
    role: lambdaRole.arn,
    code: new pulumi.asset.FileArchive(enforcerCode),
    timeout: 30,
    memorySize: 256,
    environment: {
      variables: {
        POLICY_TABLE: config.policyTableName,
        CONFIG_SET: config.configSet,
        WRAPS_API_URL: config.wrapsApiUrl,
        // Secret marker: keeps the value out of Pulumi state/CLI output in plain
        // text (SEC-8). The enforcer→API webhook authenticates with this.
        WRAPS_AGENT_WEBHOOK_SECRET: pulumi.secret(config.webhookSecret),
      },
    },
    tags: {
      ManagedBy: "wraps-cli",
      Service: "email-agents",
    },
  });

  return {
    lambdaFunction,
  };
}
