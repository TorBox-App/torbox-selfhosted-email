import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { SQSEvent } from "aws-lambda";

const awsDefaults = {
  requestHandler: new NodeHttpHandler({
    requestTimeout: 10_000,
    connectionTimeout: 5000,
  }),
  maxAttempts: 5,
};

const dynamodb = new DynamoDBClient(awsDefaults);

const log = (msg: string, data?: Record<string, unknown>) =>
  console.info(JSON.stringify({ msg, ...data }));
const logError = (
  msg: string,
  error: unknown,
  data?: Record<string, unknown>
) => console.error(JSON.stringify({ msg, error: String(error), ...data }));

/**
 * Lambda handler for processing SMS events from SQS (via SNS)
 * Events come from AWS End User Messaging via SNS → SQS (raw message delivery)
 *
 * Stores all SMS events in DynamoDB:
 * - TEXT_QUEUED: Message queued for delivery
 * - TEXT_SENT: Message sent to carrier
 * - TEXT_DELIVERED: Message delivered to device
 * - TEXT_PENDING: Delivery pending
 * - TEXT_SUCCESSFUL: Delivery confirmed
 * - TEXT_INVALID: Invalid destination number
 * - TEXT_CARRIER_UNREACHABLE: Carrier unavailable
 * - TEXT_TTL_EXPIRED: Message TTL expired
 * - TEXT_BLOCKED: Blocked by carrier/opted-out
 * - TEXT_UNKNOWN: Unknown status
 */
export async function handler(event: SQSEvent) {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME environment variable not set");
  }

  // Get retention days from environment, default to 90
  const retentionDays = Number.parseInt(process.env.RETENTION_DAYS || "90", 10);

  for (const record of event.Records) {
    try {
      // Parse the SQS message body
      // With raw message delivery from SNS, this is the actual SMS event
      const detail = JSON.parse(record.body);

      // Extract SMS event details
      // AWS End User Messaging event structure
      const eventType = detail.eventType || detail.messageStatus || "UNKNOWN";
      const messageId = detail.messageId;
      const destinationNumber = detail.destinationPhoneNumber;
      const originationNumber = detail.originationPhoneNumber;
      const messageBody = detail.messageBody || "";
      const isoCountryCode = detail.isoCountryCode || "US";
      const messageType = detail.messageType || "TRANSACTIONAL";

      // Event timestamp
      const eventTimestamp = detail.eventTimestamp
        ? new Date(detail.eventTimestamp).getTime()
        : Date.now();

      log("Processing SMS event", { messageId, eventType });

      // Extract additional data based on event type
      let additionalData: Record<string, unknown> = {
        isoCountryCode,
        messageType,
      };

      if (eventType === "TEXT_DELIVERED" || eventType === "TEXT_SUCCESSFUL") {
        additionalData = {
          ...additionalData,
          deliveryTimestamp: detail.deliveryTimestamp,
          carrierName: detail.carrierName,
          providerResponse: detail.providerResponse,
        };
      } else if (
        eventType === "TEXT_FAILED" ||
        eventType === "TEXT_INVALID" ||
        eventType === "TEXT_CARRIER_UNREACHABLE" ||
        eventType === "TEXT_BLOCKED"
      ) {
        additionalData = {
          ...additionalData,
          failureReason: detail.failureReason || detail.statusMessage,
          failureCode: detail.failureCode || detail.statusCode,
          providerResponse: detail.providerResponse,
        };
      } else if (eventType === "TEXT_QUEUED" || eventType === "TEXT_SENT") {
        additionalData = {
          ...additionalData,
          queuedTimestamp: detail.queuedTimestamp,
          sentTimestamp: detail.sentTimestamp,
        };
      } else if (eventType === "TEXT_TTL_EXPIRED") {
        additionalData = {
          ...additionalData,
          expirationTimestamp: detail.expirationTimestamp,
          ttlSeconds: detail.ttlSeconds,
        };
      }

      // Calculate message segments (SMS is 160 chars for GSM, 70 for Unicode)
      const segments = messageBody ? Math.ceil(messageBody.length / 160) : 1;

      // Calculate TTL based on retention days (0 or negative means no TTL)
      const expiresAt =
        retentionDays > 0
          ? Date.now() + retentionDays * 24 * 60 * 60 * 1000
          : Date.now() + 365 * 24 * 60 * 60 * 1000; // Default 1 year if not specified

      // Store event in DynamoDB
      await dynamodb.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            messageId: { S: messageId },
            sentAt: { N: eventTimestamp.toString() },
            accountId: { S: process.env.AWS_ACCOUNT_ID || "unknown" },
            destinationNumber: { S: destinationNumber || "" },
            originationNumber: { S: originationNumber || "" },
            messageBody: { S: messageBody },
            eventType: { S: eventType },
            segments: { N: segments.toString() },
            eventData: { S: JSON.stringify(detail) },
            additionalData: { S: JSON.stringify(additionalData) },
            createdAt: { N: Date.now().toString() },
            expiresAt: { N: expiresAt.toString() },
          },
        })
      );

      log("Stored SMS event", { eventType, messageId });
    } catch (error) {
      logError("Error processing SMS record", error, {
        recordId: record.messageId,
      });
      // Don't throw - continue processing other records
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "SMS events processed successfully" }),
  };
}
