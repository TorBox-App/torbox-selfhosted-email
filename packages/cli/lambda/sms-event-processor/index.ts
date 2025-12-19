import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import type { SQSEvent } from "aws-lambda";

const dynamodb = new DynamoDBClient({});

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
  console.log("Processing SMS event from SQS:", JSON.stringify(event, null, 2));

  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME environment variable not set");
  }

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

      console.log("Processing SMS event:", {
        messageId,
        eventType,
        destinationNumber,
        originationNumber,
      });

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
            expiresAt: {
              N: (Date.now() + 90 * 24 * 60 * 60 * 1000).toString(),
            }, // 90 days TTL
          },
        })
      );

      console.log(
        `Stored ${eventType} event for message ${messageId}`,
        additionalData
      );
    } catch (error) {
      console.error("Error processing record:", error);
      console.error("Record:", JSON.stringify(record, null, 2));
      // Don't throw - continue processing other records
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "SMS events processed successfully" }),
  };
}
