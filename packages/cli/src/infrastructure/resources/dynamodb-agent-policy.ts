import * as aws from "@pulumi/aws";
import { tableExists } from "../shared/resource-checks.js";

/**
 * Agent policy table configuration
 */
export type AgentPolicyTableConfig = {
  region: string;
};

const TABLE_NAME = "wraps-email-agent-policy";

/**
 * Create the DynamoDB table backing agent enforcement.
 *
 * Single generic `pk`/`sk` string keys hold every item kind the enforcer
 * Lambda writes: `CONFIG#<agentId>` policy items, `HOUR#…`/`DAY#…` counters
 * (TTL cleanup via `expiresAt`), and `OUTCOME#<approvalId>` results.
 *
 * Existence-guarded so redeploys import the live table instead of colliding.
 */
export async function createAgentPolicyTable(
  config: AgentPolicyTableConfig
): Promise<aws.dynamodb.Table> {
  const exists = await tableExists(TABLE_NAME, config.region);

  return exists
    ? new aws.dynamodb.Table(
        TABLE_NAME,
        {
          name: TABLE_NAME,
          billingMode: "PAY_PER_REQUEST",
          hashKey: "pk",
          rangeKey: "sk",
          attributes: [
            { name: "pk", type: "S" },
            { name: "sk", type: "S" },
          ],
          ttl: {
            enabled: true,
            attributeName: "expiresAt",
          },
          tags: {
            ManagedBy: "wraps-cli",
            Service: "email-agents",
          },
        },
        {
          import: TABLE_NAME, // Import existing table
        }
      )
    : new aws.dynamodb.Table(TABLE_NAME, {
        name: TABLE_NAME,
        billingMode: "PAY_PER_REQUEST",
        hashKey: "pk",
        rangeKey: "sk",
        attributes: [
          { name: "pk", type: "S" },
          { name: "sk", type: "S" },
        ],
        ttl: {
          enabled: true,
          attributeName: "expiresAt",
        },
        tags: {
          ManagedBy: "wraps-cli",
          Service: "email-agents",
        },
      });
}
