import * as aws from "@pulumi/aws";
import type { ArchiveRetention } from "../../types/index.js";
import { tableExists } from "../shared/resource-checks.js";

/**
 * DynamoDB configuration
 */
export type DynamoDBConfig = {
  region: string;
  retention?: ArchiveRetention;
};

/**
 * DynamoDB tables output
 */
export type DynamoDBTables = {
  emailHistory: aws.dynamodb.Table;
};

/**
 * Create DynamoDB tables for email tracking
 */
export async function createDynamoDBTables(
  config: DynamoDBConfig
): Promise<DynamoDBTables> {
  // Check if table already exists
  const tableName = "wraps-email-history";
  const exists = await tableExists(tableName, config.region);

  // Email history table (TTL is set based on retention in Lambda via expiresAt field)
  // Note: retention config is passed but TTL is actually managed by Lambda setting expiresAt
  const emailHistory = exists
    ? new aws.dynamodb.Table(
        tableName,
        {
          name: tableName,
          billingMode: "PAY_PER_REQUEST",
          hashKey: "messageId",
          rangeKey: "sentAt",
          attributes: [
            { name: "messageId", type: "S" },
            { name: "sentAt", type: "N" },
            { name: "accountId", type: "S" },
          ],
          globalSecondaryIndexes: [
            {
              name: "accountId-sentAt-index",
              hashKey: "accountId",
              rangeKey: "sentAt",
              projectionType: "ALL",
            },
          ],
          ttl: {
            enabled: true,
            attributeName: "expiresAt",
          },
          tags: {
            ManagedBy: "wraps-cli",
            Service: "email",
          },
        },
        {
          import: tableName, // Import existing table
        }
      )
    : new aws.dynamodb.Table(tableName, {
        name: tableName,
        billingMode: "PAY_PER_REQUEST",
        hashKey: "messageId",
        rangeKey: "sentAt",
        attributes: [
          { name: "messageId", type: "S" },
          { name: "sentAt", type: "N" },
          { name: "accountId", type: "S" },
        ],
        globalSecondaryIndexes: [
          {
            name: "accountId-sentAt-index",
            hashKey: "accountId",
            rangeKey: "sentAt",
            projectionType: "ALL",
          },
        ],
        ttl: {
          enabled: true,
          attributeName: "expiresAt",
        },
        tags: {
          ManagedBy: "wraps-cli",
        },
      });

  return {
    emailHistory,
  };
}
