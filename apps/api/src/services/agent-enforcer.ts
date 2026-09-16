/**
 * Agent Enforcer Service
 *
 * Bridges the Wraps API to a customer's agent-enforcer Lambda + policy table,
 * always via STS AssumeRole (customer-owned rails, zero stored credentials):
 *
 * - `syncAgentPolicy`   — mirror a Neon agent row into the customer's
 *   `wraps-email-agent-policy` DynamoDB table as the `CONFIG#<agentId>` item
 *   (policy + kill flag) so the Lambda enforces the latest state.
 * - `executeApprovedSend` — replay an operator-approved send by invoking the
 *   enforcer Lambda with `{action:"execute", approvalId, payload}` and parsing
 *   the {@link EnforcerResponse} verdict.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  type AgentConfigItem,
  type AgentEmailPayload,
  configItemKey,
  type EnforcerRequest,
  type EnforcerResponse,
  type EnforcerStatus,
} from "@wraps/core";
import type { Agent, AgentApproval } from "@wraps/db";

import { awsDefaults } from "../lib/aws-defaults";
import { log } from "../lib/logger";
import { getCredentials } from "./credentials";

/** Single-table store written by the API and read by the enforcer Lambda. */
const POLICY_TABLE = "wraps-email-agent-policy";

const RE_NOT_FOUND = /ResourceNotFoundException/;
const RE_ACCESS_DENIED = /AccessDenied|AccessDeniedException|not authorized/i;
const RE_THROTTLED = /TooManyRequestsException|Throttl/i;
const RE_EXPIRED = /ExpiredToken|credentials/i;

/** The enforcer's terminal dispositions — anything else is malformed (SEC-10). */
const ENFORCER_STATUSES: ReadonlySet<EnforcerStatus> = new Set([
  "sent",
  "pending_approval",
  "blocked",
  "failed",
  "unknown",
]);

/**
 * Validate the parsed Lambda payload before it is trusted. The enforcer is the
 * customer's own function, but a malformed/compromised response must not flow a
 * bad `status` or a non-string `messageId` into Neon (SEC-10). Anything that
 * doesn't match the {@link EnforcerResponse} shape is treated as a failure.
 */
function toEnforcerResponse(raw: unknown): EnforcerResponse | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (
    typeof o.status !== "string" ||
    !ENFORCER_STATUSES.has(o.status as EnforcerStatus)
  ) {
    return null;
  }
  if (o.messageId !== undefined && typeof o.messageId !== "string") {
    return null;
  }
  if (o.reason !== undefined && typeof o.reason !== "string") {
    return null;
  }
  if (o.approvalId !== undefined && typeof o.approvalId !== "string") {
    return null;
  }
  return o as EnforcerResponse;
}

/**
 * Describe an AWS SDK error for operator-facing storage. AWS SDK v3 sometimes
 * surfaces `name: "Error"` with the real code only in the message, so both are
 * inspected.
 */
function describeAwsError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const haystack = `${name} ${message}`;

  if (RE_NOT_FOUND.test(haystack)) {
    return "Enforcer Lambda not found — run `wraps email agent create` to deploy it";
  }
  if (RE_ACCESS_DENIED.test(haystack)) {
    return "Access denied invoking the enforcer Lambda — reconnect the AWS account";
  }
  if (RE_THROTTLED.test(haystack)) {
    return "Enforcer Lambda throttled — try again shortly";
  }
  if (RE_EXPIRED.test(haystack)) {
    return "AWS credentials expired — reconnect the AWS account";
  }
  return message || "Unknown error invoking the enforcer";
}

/** Why a `syncAgentPolicy` push to the enforcer failed. */
export type SyncFailureCause =
  | "no_aws_account"
  | "account_not_configured"
  | "assume_role_denied"
  | "dynamodb_denied"
  | "policy_table_missing"
  | "unknown";

const SYNC_FAILURE_LEDE =
  "Agent config could not be pushed to the enforcer, so the agent cannot send until this succeeds.";
const UNKNOWN_MESSAGE_MAX_LENGTH = 300;

/**
 * Classify why `syncAgentPolicy` failed, so the operator-facing warning
 * follows the evidence instead of guessing. `syncAgentPolicy` can fail three
 * ways, in order: no linked AWS account (thrown locally), `getCredentials` →
 * `sts:AssumeRole` (a deleted role, a changed trust policy, or an
 * `sts:ExternalId` mismatch), or the DynamoDB `PutCommand` (missing
 * `dynamodb:PutItem`, or a missing/torn-down policy table).
 *
 * Built from POSITIVE matches only — never `error.name !== "X"`. AWS SDK v3
 * is asymmetric here: a name that matches is trustworthy, but a name that
 * does not match proves nothing, because the SDK sometimes returns
 * `name: "Error"` with the real exception type only in `error.message` (see
 * `describeAwsError` above). A negative name check would wrongly rule out a
 * cause the message actually confirms.
 *
 * Order matters: STS returns the bare code `AccessDenied` and DynamoDB
 * returns `AccessDeniedException` — the STS check must run first, or a
 * substring match on `AccessDenied` would misclassify every DynamoDB denial
 * as an STS one (`AccessDeniedException` contains `AccessDenied`).
 *
 * The `unknown` fallback must never invent a cause — it quotes what AWS
 * actually said instead.
 *
 * Returns both `warning` (the generic `SYNC_FAILURE_LEDE` + the cause-specific
 * sentence — used as-is by callers with no lede of their own, e.g.
 * `/policy-sync`) and `detail` (the cause-specific sentence ALONE, with no
 * lede — for callers that prepend their own route-specific lede, e.g. `/kill`
 * and `PATCH /:id/policy`). A caller that concatenates its own lede with
 * `warning` instead of `detail` ends up with two ledes making contradictory
 * claims about whether the agent can still send — always use `detail` there.
 */
export function classifySyncFailure(error: unknown): {
  cause: SyncFailureCause;
  warning: string;
  detail: string;
} {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);

  let cause: SyncFailureCause;
  let detail: string;

  if (message.includes("has no linked AWS account")) {
    cause = "no_aws_account";
    detail =
      "The agent is not linked to an AWS account yet; finish `wraps email agent create`.";
  } else if (message.includes("not found or not configured")) {
    cause = "account_not_configured";
    detail =
      "No connected AWS account with a role ARN was found for this organization. Run `wraps platform connect`.";
  } else if (
    name === "AccessDenied" ||
    message.includes("sts:AssumeRole") ||
    message.includes("AssumeRole")
  ) {
    cause = "assume_role_denied";
    detail =
      "Wraps could not assume the console access role in your AWS account. This is usually an `sts:ExternalId` mismatch between the role's trust policy and this connection. Run `wraps platform update-role` (CLI 3.11.0 or newer — older versions update permissions without repairing the trust policy), then retry.";
  } else if (
    name === "ResourceNotFoundException" ||
    message.includes("ResourceNotFoundException")
  ) {
    cause = "policy_table_missing";
    detail =
      "The `wraps-email-agent-policy` table does not exist in this account or region. Deploy the email stack with `wraps email init`.";
  } else if (
    name === "AccessDeniedException" ||
    message.includes("dynamodb:PutItem")
  ) {
    cause = "dynamodb_denied";
    detail =
      "The console access role is most likely missing `dynamodb:PutItem` on `wraps-email-agent-policy`; redeploy the email stack with `wraps email config` to apply the grant, then retry.";
  } else {
    cause = "unknown";
    const truncatedMessage =
      message.length > UNKNOWN_MESSAGE_MAX_LENGTH
        ? `${message.slice(0, UNKNOWN_MESSAGE_MAX_LENGTH)}…`
        : message;
    detail = `AWS reported: \`${name || "Error"}: ${truncatedMessage}\`. Retry, and if it persists contact support with that message.`;
  }

  return { cause, warning: `${SYNC_FAILURE_LEDE} ${detail}`, detail };
}

function docClientFor(creds: Awaited<ReturnType<typeof getCredentials>>) {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      ...awsDefaults,
      region: creds.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    })
  );
}

function lambdaClientFor(creds: Awaited<ReturnType<typeof getCredentials>>) {
  return new LambdaClient({
    ...awsDefaults,
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Mirror an agent's policy + kill flag into the customer's DynamoDB policy
 * table so the enforcer Lambda sees the latest state on its next invocation.
 *
 * @param agentRow - The agent whose CONFIG item should be written.
 * @throws {Error} If the agent has no linked AWS account (never deployed).
 * @throws AWS SDK errors from STS AssumeRole or DynamoDB PutItem.
 */
export async function syncAgentPolicy(agentRow: Agent): Promise<void> {
  if (!agentRow.awsAccountId) {
    throw new Error(
      `Agent ${agentRow.id} has no linked AWS account — cannot sync policy`
    );
  }

  const creds = await getCredentials(
    agentRow.awsAccountId,
    agentRow.organizationId
  );
  const doc = docClientFor(creds);
  const key = configItemKey(agentRow.id);

  // The enforcer pins `payload.from` to this address (SEC-3), so the CONFIG
  // item must carry the agent's own verified sender identity (convention 3).
  const config: AgentConfigItem = {
    killed: agentRow.status === "KILLED",
    emailAddress: agentRow.emailAddress,
    policy: agentRow.policy,
  };

  await doc.send(
    new PutCommand({
      TableName: POLICY_TABLE,
      Item: {
        pk: key.pk,
        sk: key.sk,
        ...config,
      },
    })
  );
}

/**
 * Replay an operator-approved send by invoking the enforcer Lambda. The Lambda
 * re-checks the kill switch before sending (kill wins races), so policy
 * outcomes come back as a successful {@link EnforcerResponse} rather than a
 * thrown error.
 *
 * @param approval - The approved queue row (carries the send payload).
 * @param agentRow - The owning agent (carries the enforcer ARN + AWS account).
 * @returns The parsed enforcer verdict; `{status:"failed"}` on transport error.
 */
export async function executeApprovedSend(
  approval: AgentApproval,
  agentRow: Agent
): Promise<EnforcerResponse> {
  if (!(agentRow.awsAccountId && agentRow.enforcerFunctionArn)) {
    return {
      status: "failed",
      reason: "Agent is not deployed (missing enforcer ARN or AWS account)",
    };
  }

  const payload: AgentEmailPayload = {
    from: approval.payload.from,
    to: approval.payload.to,
    subject: approval.payload.subject,
    html: approval.payload.html ?? "",
    text: approval.payload.text ?? "",
    ...(approval.payload.replyTo ? { replyTo: approval.payload.replyTo } : {}),
    ...(approval.payload.inReplyTo
      ? { inReplyTo: approval.payload.inReplyTo }
      : {}),
    ...(approval.payload.references
      ? { references: approval.payload.references }
      : {}),
  };

  const request: EnforcerRequest = {
    action: "execute",
    agentId: agentRow.id,
    approvalId: approval.id,
    payload,
  };

  try {
    const creds = await getCredentials(
      agentRow.awsAccountId,
      agentRow.organizationId
    );
    const lambda = lambdaClientFor(creds);

    const result = await lambda.send(
      new InvokeCommand({
        FunctionName: agentRow.enforcerFunctionArn,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify(request)),
      })
    );

    if (result.FunctionError) {
      const detail = result.Payload
        ? new TextDecoder().decode(result.Payload)
        : result.FunctionError;
      return { status: "failed", reason: `Enforcer error: ${detail}` };
    }

    if (!result.Payload) {
      return { status: "failed", reason: "Enforcer returned no payload" };
    }

    const parsed = toEnforcerResponse(
      JSON.parse(new TextDecoder().decode(result.Payload))
    );
    if (!parsed) {
      return {
        status: "failed",
        reason: "Enforcer returned a malformed response",
      };
    }

    return parsed;
  } catch (error) {
    log.error("executeApprovedSend failed", error, {
      agentId: agentRow.id,
      approvalId: approval.id,
    });
    return { status: "failed", reason: describeAwsError(error) };
  }
}
