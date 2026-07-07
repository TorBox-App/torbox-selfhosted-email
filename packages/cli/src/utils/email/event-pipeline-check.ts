/**
 * Hop-by-hop health check for the SES -> EventBridge -> SQS -> Lambda ->
 * DynamoDB event pipeline (plus the optional Wraps platform webhook leg).
 *
 * Used by `wraps email doctor` and, warn-only, right after a successful
 * `wraps email upgrade` deploy. Every AWS call is wrapped in its own
 * try/catch — a single hop's API error becomes a "warn" entry, it never
 * throws and never blocks the rest of the checks from running.
 */

import { isAWSNotFoundError } from "../shared/errors.js";
import { domainToConfigSetName } from "./config-set-slug.js";

const EVENT_DESTINATION_NAME = "wraps-email-eventbridge";
const CONFIG_SET_FALLBACK = "wraps-email-tracking";
const RULE_NAME = "wraps-email-events-to-sqs";
const QUEUE_NAME = "wraps-email-events";
const DLQ_NAME = "wraps-email-events-dlq";
const LAMBDA_FUNCTION_NAME = "wraps-email-event-processor";
const WEBHOOK_DESTINATION_NAME = "wraps-webhook-destination";
const WEBHOOK_CONNECTION_NAME = "wraps-webhook-connection";
const HISTORY_TABLE_NAME = "wraps-email-history";
const UPGRADE_HINT = "wraps email upgrade";

export type PipelineCheck = {
  hop: string;
  status: "pass" | "warn" | "fail";
  details: string;
};

export type CheckEventPipelineParams = {
  region: string;
  domains: string[];
  expectPlatformWebhook: boolean;
};

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isQueueNotFoundError(error: unknown): boolean {
  return (
    isAWSNotFoundError(error) ||
    (error instanceof Error && error.name === "QueueDoesNotExist")
  );
}

/**
 * Check a single SES configuration set for the wraps-email-eventbridge
 * event destination. When `optional` is true, a not-found result is not a
 * failure — it just means this config set isn't in use (returns null).
 */
async function checkConfigSet(
  configSetName: string,
  region: string,
  optional: boolean
): Promise<PipelineCheck | null> {
  const hop = `SES config set ${configSetName}`;
  try {
    const { SESv2Client, GetConfigurationSetEventDestinationsCommand } =
      await import("@aws-sdk/client-sesv2");
    const client = new SESv2Client({ region });
    const response = await client.send(
      new GetConfigurationSetEventDestinationsCommand({
        ConfigurationSetName: configSetName,
      })
    );
    const destination = response.EventDestinations?.find(
      (d) => d.Name === EVENT_DESTINATION_NAME
    );
    if (destination?.Enabled) {
      return {
        hop,
        status: "pass",
        details: `${EVENT_DESTINATION_NAME} enabled`,
      };
    }
    return {
      hop,
      status: "fail",
      details: `SES emits no events for ${configSetName} — redeploy with \`${UPGRADE_HINT}\``,
    };
  } catch (error) {
    if (isAWSNotFoundError(error)) {
      if (optional) {
        return null;
      }
      return {
        hop,
        status: "fail",
        details: `Configuration set not found — redeploy with \`${UPGRADE_HINT}\``,
      };
    }
    return {
      hop,
      status: "warn",
      details: `Could not check event destinations: ${summarizeError(error)}`,
    };
  }
}

async function checkRule(
  region: string
): Promise<{ check: PipelineCheck; exists: boolean }> {
  const hop = `EventBridge rule ${RULE_NAME}`;
  try {
    const { EventBridgeClient, DescribeRuleCommand } = await import(
      "@aws-sdk/client-eventbridge"
    );
    const client = new EventBridgeClient({ region });
    const response = await client.send(
      new DescribeRuleCommand({ Name: RULE_NAME })
    );
    if (response.State === "ENABLED") {
      return {
        exists: true,
        check: { hop, status: "pass", details: "Rule enabled" },
      };
    }
    return {
      exists: true,
      check: {
        hop,
        status: "fail",
        details: `Rule is ${response.State ?? "in an unknown state"} — run \`${UPGRADE_HINT}\` to re-enable`,
      },
    };
  } catch (error) {
    if (isAWSNotFoundError(error)) {
      return {
        exists: false,
        check: {
          hop,
          status: "fail",
          details: `Rule not found — SES events have nowhere to go; run \`${UPGRADE_HINT}\``,
        },
      };
    }
    return {
      exists: false,
      check: {
        hop,
        status: "warn",
        details: `Could not check rule: ${summarizeError(error)}`,
      },
    };
  }
}

async function checkQueueExists(
  queueName: string,
  region: string,
  failDetails: string
): Promise<PipelineCheck> {
  const hop = `SQS queue ${queueName}`;
  try {
    const { SQSClient, GetQueueUrlCommand } = await import(
      "@aws-sdk/client-sqs"
    );
    const client = new SQSClient({ region });
    await client.send(new GetQueueUrlCommand({ QueueName: queueName }));
    return { hop, status: "pass", details: "Queue exists" };
  } catch (error) {
    if (isQueueNotFoundError(error)) {
      return { hop, status: "fail", details: failDetails };
    }
    return {
      hop,
      status: "warn",
      details: `Could not check queue: ${summarizeError(error)}`,
    };
  }
}

/**
 * Duplicate ARN detection — the same target ARN registered on the rule
 * more than once (observed in the incident: 3x the same SQS ARN).
 */
function findDuplicateTargetChecks(
  targets: Array<{ Id?: string; Arn?: string }>
): PipelineCheck[] {
  const idsByArn = new Map<string, string[]>();
  for (const target of targets) {
    if (!target.Arn) {
      continue;
    }
    const ids = idsByArn.get(target.Arn) ?? [];
    ids.push(target.Id ?? "unknown");
    idsByArn.set(target.Arn, ids);
  }

  const checks: PipelineCheck[] = [];
  for (const [arn, ids] of idsByArn) {
    if (ids.length > 1) {
      checks.push({
        hop: "EventBridge rule targets",
        status: "warn",
        details: `Duplicate targets for ${arn}: ${ids.join(", ")}`,
      });
    }
  }
  return checks;
}

/** The SQS target must exist on the rule and point at a real queue. */
function checkSqsTargetOnRule(
  targets: Array<{ Arn?: string }>,
  region: string
): Promise<PipelineCheck> {
  const failDetails = `events are being dropped — run \`${UPGRADE_HINT}\` to recreate the queue`;
  const sqsTarget = targets.find((t) => t.Arn?.split(":")[2] === "sqs");
  if (!sqsTarget) {
    return Promise.resolve({
      hop: `SQS queue ${QUEUE_NAME}`,
      status: "fail",
      details: `No SQS target on rule — ${failDetails}`,
    });
  }
  return checkQueueExists(QUEUE_NAME, region, failDetails);
}

/** Platform webhook target presence must match metadata expectations. */
function checkPlatformWebhookTargetPresence(
  webhookTargetPresent: boolean,
  expectPlatformWebhook: boolean
): PipelineCheck | null {
  if (expectPlatformWebhook && !webhookTargetPresent) {
    return {
      hop: "Platform webhook target",
      status: "fail",
      details: `platform webhook target missing but metadata says connected — dashboard receives no events; run \`${UPGRADE_HINT}\``,
    };
  }
  if (!expectPlatformWebhook && webhookTargetPresent) {
    return {
      hop: "Platform webhook target",
      status: "warn",
      details:
        "Webhook target exists on the rule but metadata has no webhookSecret — stack/metadata mismatch, possibly a lost metadata file",
    };
  }
  if (expectPlatformWebhook && webhookTargetPresent) {
    return {
      hop: "Platform webhook target",
      status: "pass",
      details: "Platform webhook target present",
    };
  }
  return null;
}

/**
 * List the rule's targets and evaluate: duplicate targets, whether the SQS
 * target exists and points at a real queue, and whether a platform webhook
 * target is present or absent as expected by `expectPlatformWebhook`.
 */
async function checkRuleTargets(
  region: string,
  expectPlatformWebhook: boolean
): Promise<{ checks: PipelineCheck[]; webhookTargetPresent: boolean }> {
  try {
    const { EventBridgeClient, ListTargetsByRuleCommand } = await import(
      "@aws-sdk/client-eventbridge"
    );
    const client = new EventBridgeClient({ region });
    const response = await client.send(
      new ListTargetsByRuleCommand({ Rule: RULE_NAME })
    );
    const targets = response.Targets ?? [];

    const checks: PipelineCheck[] = [...findDuplicateTargetChecks(targets)];
    checks.push(await checkSqsTargetOnRule(targets, region));

    const webhookTargetPresent = targets.some((t) =>
      t.Arn?.includes(WEBHOOK_DESTINATION_NAME)
    );
    const webhookCheck = checkPlatformWebhookTargetPresence(
      webhookTargetPresent,
      expectPlatformWebhook
    );
    if (webhookCheck) {
      checks.push(webhookCheck);
    }

    return { checks, webhookTargetPresent };
  } catch (error) {
    return {
      checks: [
        {
          hop: "EventBridge rule targets",
          status: "warn",
          details: `Could not list rule targets: ${summarizeError(error)}`,
        },
      ],
      webhookTargetPresent: false,
    };
  }
}

async function checkWebhookDestination(region: string): Promise<PipelineCheck> {
  const hop = `EventBridge API destination ${WEBHOOK_DESTINATION_NAME}`;
  try {
    const { EventBridgeClient, DescribeApiDestinationCommand } = await import(
      "@aws-sdk/client-eventbridge"
    );
    const client = new EventBridgeClient({ region });
    const response = await client.send(
      new DescribeApiDestinationCommand({ Name: WEBHOOK_DESTINATION_NAME })
    );
    if (response.ApiDestinationState === "ACTIVE") {
      return { hop, status: "pass", details: "Active" };
    }
    return {
      hop,
      status: "fail",
      details: `API destination is ${response.ApiDestinationState ?? "in an unknown state"} — re-run \`${UPGRADE_HINT}\` to re-authorize`,
    };
  } catch (error) {
    if (isAWSNotFoundError(error)) {
      return {
        hop,
        status: "fail",
        details: `API destination not found — re-run \`${UPGRADE_HINT}\``,
      };
    }
    return {
      hop,
      status: "warn",
      details: `Could not check API destination: ${summarizeError(error)}`,
    };
  }
}

async function checkWebhookConnection(region: string): Promise<PipelineCheck> {
  const hop = `EventBridge connection ${WEBHOOK_CONNECTION_NAME}`;
  try {
    const { EventBridgeClient, DescribeConnectionCommand } = await import(
      "@aws-sdk/client-eventbridge"
    );
    const client = new EventBridgeClient({ region });
    const response = await client.send(
      new DescribeConnectionCommand({ Name: WEBHOOK_CONNECTION_NAME })
    );
    if (response.ConnectionState === "AUTHORIZED") {
      return { hop, status: "pass", details: "Authorized" };
    }
    return {
      hop,
      status: "fail",
      details: `Connection is ${response.ConnectionState ?? "in an unknown state"} — re-run \`${UPGRADE_HINT}\` to re-authorize`,
    };
  } catch (error) {
    if (isAWSNotFoundError(error)) {
      return {
        hop,
        status: "fail",
        details: `Connection not found — re-run \`${UPGRADE_HINT}\``,
      };
    }
    return {
      hop,
      status: "warn",
      details: `Could not check connection: ${summarizeError(error)}`,
    };
  }
}

async function checkDLQ(region: string): Promise<PipelineCheck> {
  const hop = `SQS DLQ ${DLQ_NAME}`;
  try {
    const { SQSClient, GetQueueUrlCommand, GetQueueAttributesCommand } =
      await import("@aws-sdk/client-sqs");
    const client = new SQSClient({ region });
    const urlResponse = await client.send(
      new GetQueueUrlCommand({ QueueName: DLQ_NAME })
    );
    const attrResponse = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: urlResponse.QueueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      })
    );
    const count = Number(
      attrResponse.Attributes?.ApproximateNumberOfMessages ?? "0"
    );
    if (count > 0) {
      return {
        hop,
        status: "warn",
        details: `${count} dead-lettered event(s) — investigate before they age out`,
      };
    }
    return { hop, status: "pass", details: "Empty" };
  } catch (error) {
    if (isQueueNotFoundError(error)) {
      return {
        hop,
        status: "fail",
        details: `Dead-letter queue missing — run \`${UPGRADE_HINT}\` to recreate it`,
      };
    }
    return {
      hop,
      status: "warn",
      details: `Could not check DLQ: ${summarizeError(error)}`,
    };
  }
}

async function checkEventSourceMapping(region: string): Promise<PipelineCheck> {
  const hop = `Lambda event source mapping ${LAMBDA_FUNCTION_NAME}`;
  try {
    const { LambdaClient, ListEventSourceMappingsCommand } = await import(
      "@aws-sdk/client-lambda"
    );
    const client = new LambdaClient({ region });
    const response = await client.send(
      new ListEventSourceMappingsCommand({ FunctionName: LAMBDA_FUNCTION_NAME })
    );
    const mapping = response.EventSourceMappings?.find((m) =>
      m.EventSourceArn?.endsWith(`:${QUEUE_NAME}`)
    );
    if (!mapping) {
      return {
        hop,
        status: "fail",
        details: `No event source mapping from ${QUEUE_NAME} — Lambda never runs; run \`${UPGRADE_HINT}\``,
      };
    }
    if (mapping.State === "Enabled") {
      return { hop, status: "pass", details: "Mapping enabled" };
    }
    return {
      hop,
      status: "fail",
      details: `Mapping is ${mapping.State ?? "in an unknown state"} — run \`${UPGRADE_HINT}\` to re-enable`,
    };
  } catch (error) {
    if (isAWSNotFoundError(error)) {
      return {
        hop,
        status: "fail",
        details: `Lambda function not found — run \`${UPGRADE_HINT}\``,
      };
    }
    return {
      hop,
      status: "warn",
      details: `Could not check event source mapping: ${summarizeError(error)}`,
    };
  }
}

async function checkHistoryTable(region: string): Promise<PipelineCheck> {
  const hop = `DynamoDB table ${HISTORY_TABLE_NAME}`;
  try {
    const { DynamoDBClient, DescribeTableCommand } = await import(
      "@aws-sdk/client-dynamodb"
    );
    const client = new DynamoDBClient({ region });
    const response = await client.send(
      new DescribeTableCommand({ TableName: HISTORY_TABLE_NAME })
    );
    const status = response.Table?.TableStatus;
    if (status === "ACTIVE") {
      return { hop, status: "pass", details: "Active" };
    }
    return {
      hop,
      status: "fail",
      details: `Table status is ${status ?? "unknown"} — event log may be unavailable; run \`${UPGRADE_HINT}\``,
    };
  } catch (error) {
    if (isAWSNotFoundError(error)) {
      return {
        hop,
        status: "fail",
        details: `Table not found — event history is not being recorded; run \`${UPGRADE_HINT}\``,
      };
    }
    return {
      hop,
      status: "warn",
      details: `Could not check table: ${summarizeError(error)}`,
    };
  }
}

/**
 * Run every hop of the SES event pipeline health check, in pipeline order.
 * Never throws — every AWS call is isolated so one hop's failure can't
 * prevent the rest from being evaluated.
 */
export async function checkEventPipeline(
  params: CheckEventPipelineParams
): Promise<PipelineCheck[]> {
  const { region, domains, expectPlatformWebhook } = params;
  const checks: PipelineCheck[] = [];

  // 1. SES configuration set(s) — one per domain, plus an opportunistic
  // probe of the domain-less fallback name when domains are configured.
  const uniqueConfigSetNames = Array.from(
    new Set(domains.map((d) => domainToConfigSetName(d)))
  );
  if (uniqueConfigSetNames.length === 0) {
    const check = await checkConfigSet(CONFIG_SET_FALLBACK, region, false);
    if (check) {
      checks.push(check);
    }
  } else {
    for (const name of uniqueConfigSetNames) {
      const check = await checkConfigSet(name, region, false);
      if (check) {
        checks.push(check);
      }
    }
    const fallbackCheck = await checkConfigSet(
      CONFIG_SET_FALLBACK,
      region,
      true
    );
    if (fallbackCheck) {
      checks.push(fallbackCheck);
    }
  }

  // 2. EventBridge rule.
  const ruleResult = await checkRule(region);
  checks.push(ruleResult.check);

  // 3. Rule targets (duplicates, SQS target, platform webhook target).
  let webhookTargetPresent = false;
  if (ruleResult.exists) {
    const targetsResult = await checkRuleTargets(region, expectPlatformWebhook);
    checks.push(...targetsResult.checks);
    webhookTargetPresent = targetsResult.webhookTargetPresent;
  }

  // 4. Webhook API destination + connection (only relevant if a webhook
  // target actually exists on the rule).
  if (webhookTargetPresent) {
    checks.push(await checkWebhookDestination(region));
    checks.push(await checkWebhookConnection(region));
  }

  // 5. Dead-letter queue.
  checks.push(await checkDLQ(region));

  // 6. Lambda event source mapping.
  checks.push(await checkEventSourceMapping(region));

  // 7. DynamoDB event history table.
  checks.push(await checkHistoryTable(region));

  return checks;
}
