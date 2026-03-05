import { randomUUID } from "node:crypto";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { Context, SQSEvent } from "aws-lambda";

const awsDefaults = {
  requestHandler: new NodeHttpHandler({
    requestTimeout: 10_000,
    connectionTimeout: 5000,
  }),
  maxAttempts: 5,
};

const dynamodb = new DynamoDBClient(awsDefaults);

/**
 * Lambda handler for processing SES events from SQS (via EventBridge)
 * Stores all SES events in DynamoDB:
 * - Send: Email sent from SES
 * - Delivery: Email delivered to recipient
 * - Open: Email opened by recipient
 * - Click: Link clicked in email
 * - Bounce: Email bounced (permanent or transient)
 * - Suppressed: Email blocked due to recipient on suppression list
 * - Complaint: Recipient marked email as spam
 * - Reject: Email rejected before sending
 * - Rendering Failure: Template rendering failed
 * - DeliveryDelay: Temporary delivery delay
 * - Subscription: Recipient unsubscribed/changed preferences
 */
export async function handler(event: SQSEvent, context: Context) {
  const requestId = context.awsRequestId;
  const batchId = randomUUID().slice(0, 8);

  const log = (msg: string, data?: Record<string, unknown>) => {
    console.info(JSON.stringify({ requestId, batchId, msg, ...data }));
  };
  const logError = (
    msg: string,
    error: unknown,
    data?: Record<string, unknown>
  ) => {
    console.error(
      JSON.stringify({ requestId, batchId, msg, error: String(error), ...data })
    );
  };

  log("Processing SES batch", { recordCount: event.Records.length });

  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME environment variable not set");
  }

  // Get retention days from environment, default to 90
  const retentionDays = Number.parseInt(process.env.RETENTION_DAYS || "90", 10);

  for (const record of event.Records) {
    try {
      // Parse the SQS message body (which contains the EventBridge event)
      const eventBridgeEvent = JSON.parse(record.body);

      // The actual SES event is in the 'detail' field of the EventBridge event
      const message = eventBridgeEvent.detail;
      let eventType = message.eventType || message.notificationType;

      // Extract email details
      const mail = message.mail;
      const messageId = mail.messageId;
      const mailTimestamp = new Date(mail.timestamp).getTime();
      const from = mail.source;
      const to = mail.destination || [];
      const subject = mail.commonHeaders?.subject || "";

      log("Processing email event", {
        messageId,
        eventType,
        recipientCount: to.length,
      });

      // Extract additional data and event-specific timestamp based on event type
      let additionalData: Record<string, unknown> = {};
      let eventTimestamp = mailTimestamp; // Default to mail timestamp

      if (eventType === "Send" && message.send) {
        // Send event uses mail timestamp
        additionalData = {
          tags: mail.tags || {},
        };
      } else if (eventType === "Delivery" && message.delivery) {
        eventTimestamp = new Date(message.delivery.timestamp).getTime();
        additionalData = {
          timestamp: message.delivery.timestamp,
          processingTimeMillis: message.delivery.processingTimeMillis,
          recipients: message.delivery.recipients,
          smtpResponse: message.delivery.smtpResponse,
          remoteMtaIp: message.delivery.remoteMtaIp,
        };
      } else if (eventType === "Open" && message.open) {
        eventTimestamp = new Date(message.open.timestamp).getTime();
        additionalData = {
          timestamp: message.open.timestamp,
          userAgent: message.open.userAgent,
          ipAddress: message.open.ipAddress,
        };
      } else if (eventType === "Click" && message.click) {
        eventTimestamp = new Date(message.click.timestamp).getTime();
        additionalData = {
          timestamp: message.click.timestamp,
          link: message.click.link,
          linkTags: message.click.linkTags || {},
          userAgent: message.click.userAgent,
          ipAddress: message.click.ipAddress,
        };
      } else if (eventType === "Bounce" && message.bounce) {
        const bounceSubType = message.bounce.bounceSubType;

        // Treat suppression as a distinct event type, not a bounce
        // SES sends suppressions as bounces with bounceSubType of "Suppressed" or "OnAccountSuppressionList"
        if (
          bounceSubType === "Suppressed" ||
          bounceSubType === "OnAccountSuppressionList"
        ) {
          eventType = "Suppressed";
          eventTimestamp = new Date(message.bounce.timestamp).getTime();
          additionalData = {
            reason: bounceSubType,
            suppressedRecipients: message.bounce.bouncedRecipients,
            timestamp: message.bounce.timestamp,
            feedbackId: message.bounce.feedbackId,
          };
        } else {
          // Regular bounce handling
          eventTimestamp = new Date(message.bounce.timestamp).getTime();
          additionalData = {
            bounceType: message.bounce.bounceType,
            bounceSubType: message.bounce.bounceSubType,
            bouncedRecipients: message.bounce.bouncedRecipients,
            timestamp: message.bounce.timestamp,
            feedbackId: message.bounce.feedbackId,
          };
        }
      } else if (eventType === "Complaint" && message.complaint) {
        eventTimestamp = new Date(message.complaint.timestamp).getTime();
        additionalData = {
          complainedRecipients: message.complaint.complainedRecipients,
          timestamp: message.complaint.timestamp,
          feedbackId: message.complaint.feedbackId,
          complaintFeedbackType: message.complaint.complaintFeedbackType,
          userAgent: message.complaint.userAgent,
        };
      } else if (eventType === "Reject" && message.reject) {
        // Reject doesn't have a specific timestamp, use mail timestamp
        additionalData = {
          reason: message.reject.reason,
        };
      } else if (eventType === "Rendering Failure" && message.failure) {
        // Rendering failure doesn't have a specific timestamp, use mail timestamp
        additionalData = {
          errorMessage: message.failure.errorMessage,
          templateName: message.failure.templateName,
        };
      } else if (eventType === "DeliveryDelay" && message.deliveryDelay) {
        eventTimestamp = new Date(message.deliveryDelay.timestamp).getTime();
        additionalData = {
          timestamp: message.deliveryDelay.timestamp,
          delayType: message.deliveryDelay.delayType,
          expirationTime: message.deliveryDelay.expirationTime,
          delayedRecipients: message.deliveryDelay.delayedRecipients,
        };
      } else if (eventType === "Subscription" && message.subscription) {
        eventTimestamp = new Date(message.subscription.timestamp).getTime();
        additionalData = {
          contactList: message.subscription.contactList,
          timestamp: message.subscription.timestamp,
          source: message.subscription.source,
          newTopicPreferences: message.subscription.newTopicPreferences,
          oldTopicPreferences: message.subscription.oldTopicPreferences,
        };
      }

      // Calculate TTL based on retention days (0 or negative means no TTL)
      const expiresAt =
        retentionDays > 0
          ? Date.now() + retentionDays * 24 * 60 * 60 * 1000
          : Date.now() + 365 * 24 * 60 * 60 * 1000; // Default 1 year if not specified

      // Store event in DynamoDB
      // Use eventTimestamp as sort key to ensure each event type creates a unique record
      // Note: DynamoDB String Sets (SS) cannot be empty, so we use a List (L) for recipients
      await dynamodb.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            messageId: { S: messageId },
            sentAt: { N: eventTimestamp.toString() },
            accountId: { S: process.env.AWS_ACCOUNT_ID || "unknown" },
            from: { S: from },
            to: { L: to.map((email: string) => ({ S: email })) },
            subject: { S: subject },
            eventType: { S: eventType },
            eventData: { S: JSON.stringify(message) },
            additionalData: { S: JSON.stringify(additionalData) },
            createdAt: { N: Date.now().toString() },
            expiresAt: { N: expiresAt.toString() },
          },
        })
      );

      log("Stored event", { eventType, messageId });
    } catch (error) {
      logError("Error processing record", error, {
        sqsMessageId: record.messageId,
      });
      // Don't throw - continue processing other records
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Events processed successfully" }),
  };
}
