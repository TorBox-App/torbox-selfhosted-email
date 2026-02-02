import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { GetSendQuotaCommand, SESClient } from "@aws-sdk/client-ses";
import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  ListEmailIdentitiesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { EmailEvent, SendQuota } from "../types";

export interface AWSIdentity {
  accountId: string;
  arn: string;
}

export function getRegion(): string {
  return (
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1"
  );
}

export async function getCallerIdentity(region: string): Promise<AWSIdentity> {
  const sts = new STSClient({ region });
  const result = await sts.send(new GetCallerIdentityCommand({}));
  return {
    accountId: result.Account!,
    arn: result.Arn!,
  };
}

export interface SESIdentity {
  name: string;
  verified: boolean;
  dkimStatus: string;
  dkimTokens: string[];
}

export async function listDomains(region: string): Promise<SESIdentity[]> {
  const sesv2 = new SESv2Client({ region });

  const listResponse = await sesv2.send(new ListEmailIdentitiesCommand({}));
  const identities = listResponse.EmailIdentities ?? [];

  const domains = identities.filter(
    (id) =>
      id.IdentityType === "DOMAIN" ||
      (id.IdentityName && !id.IdentityName.includes("@"))
  );

  const results: SESIdentity[] = await Promise.all(
    domains.map(async (domain) => {
      try {
        const detail = await sesv2.send(
          new GetEmailIdentityCommand({ EmailIdentity: domain.IdentityName! })
        );
        return {
          name: domain.IdentityName!,
          verified: detail.VerifiedForSendingStatus ?? false,
          dkimStatus: detail.DkimAttributes?.Status ?? "PENDING",
          dkimTokens: detail.DkimAttributes?.Tokens ?? [],
        };
      } catch {
        return {
          name: domain.IdentityName!,
          verified: false,
          dkimStatus: "UNKNOWN",
          dkimTokens: [],
        };
      }
    })
  );

  return results;
}

export async function getSendQuota(region: string): Promise<SendQuota> {
  const ses = new SESClient({ region });
  const result = await ses.send(new GetSendQuotaCommand({}));
  return {
    sentLast24Hours: Math.floor(result.SentLast24Hours ?? 0),
    max24HourSend: Math.floor(result.Max24HourSend ?? 0),
    maxSendRate: Math.floor(result.MaxSendRate ?? 0),
  };
}

const TABLE_NAME = "wraps-email-history";
const GSI_NAME = "accountId-sentAt-index";

export async function fetchEmailEvents(
  region: string,
  accountId: string
): Promise<EmailEvent[]> {
  const dynamodb = new DynamoDBClient({ region });
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // last 30 days
  const events: EmailEvent[] = [];

  let lastKey: Record<string, any> | undefined;

  try {
    do {
      const result = await dynamodb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: GSI_NAME,
          KeyConditionExpression: "accountId = :acctId AND sentAt >= :cutoff",
          ExpressionAttributeValues: {
            ":acctId": { S: accountId },
            ":cutoff": { N: cutoff.toString() },
          },
          ProjectionExpression: "sentAt, eventType",
          ExclusiveStartKey: lastKey,
        })
      );

      for (const item of result.Items ?? []) {
        const row = unmarshall(item);
        events.push({
          timestamp: Number(row.sentAt),
          eventType: String(row.eventType),
        });
      }

      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
  } catch {
    // Table may not exist (Starter preset has no event tracking)
    return [];
  }

  return events;
}

export interface CreateDomainResult {
  name: string;
  dkimTokens: string[];
  verified: boolean;
}

export async function createDomain(
  region: string,
  domain: string
): Promise<CreateDomainResult> {
  const sesv2 = new SESv2Client({ region });
  const result = await sesv2.send(
    new CreateEmailIdentityCommand({
      EmailIdentity: domain,
      DkimSigningAttributes: {
        NextSigningKeyLength: "RSA_2048_BIT",
      },
    })
  );

  return {
    name: domain,
    dkimTokens: result.DkimAttributes?.Tokens ?? [],
    verified: result.VerifiedForSendingStatus ?? false,
  };
}

export async function removeDomain(
  region: string,
  domain: string
): Promise<void> {
  const sesv2 = new SESv2Client({ region });
  await sesv2.send(
    new DeleteEmailIdentityCommand({
      EmailIdentity: domain,
    })
  );
}
