import { randomUUID } from "node:crypto";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { Context, S3Event } from "aws-lambda";
import { simpleParser } from "mailparser";

const awsDefaults = {
  requestHandler: new NodeHttpHandler({
    requestTimeout: 10_000,
    connectionTimeout: 5000,
  }),
  maxAttempts: 5,
};

const s3 = new S3Client(awsDefaults);
const eventbridge = new EventBridgeClient(awsDefaults);

const BUCKET_NAME = process.env.BUCKET_NAME!;
const INBOUND_EVENT_SOURCE =
  process.env.INBOUND_EVENT_SOURCE || "wraps.inbound";

/** Max HTML size in EventBridge detail (200KB) */
const MAX_HTML_SIZE = 200 * 1024;

/**
 * Lambda handler for processing inbound emails from S3 (via SES Receipt Rule)
 *
 * Flow:
 * 1. SES receives email → stores raw MIME in S3 (raw/{messageId})
 * 2. S3 notification triggers this Lambda
 * 3. Parse MIME → extract headers, body, attachments
 * 4. Store attachments → S3 (attachments/{emailId}/{attId}-{filename})
 * 5. Store parsed JSON → S3 (parsed/{emailId}.json)
 * 6. Put event → EventBridge (source: "wraps.inbound", detail-type: "email.received")
 */
export async function handler(event: S3Event, context: Context) {
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
      JSON.stringify({
        requestId,
        batchId,
        msg,
        error: String(error),
        ...data,
      })
    );
  };

  log("Processing inbound email batch", {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const bucket = record.s3.bucket.name;

    try {
      log("Processing raw email", { bucket, key: s3Key });

      // 1. Read raw MIME from S3
      const rawResponse = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: s3Key })
      );
      const rawBody = await rawResponse.Body?.transformToString();

      // 2. Parse MIME
      const parsed = await simpleParser(rawBody);

      // Generate email ID
      const emailId = `inb_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

      // 3. Extract headers as key-value pairs
      // mailparser returns most headers as strings, but some (list, received,
      // references) are complex objects. We preserve objects as-is so downstream
      // consumers can access nested fields like list.unsubscribe.
      const headers: Record<string, unknown> = {};
      if (parsed.headers) {
        for (const [key, value] of parsed.headers) {
          let headerValue: unknown;
          if (typeof value === "string") {
            headerValue = value;
          } else if (
            typeof value === "object" &&
            value !== null &&
            "text" in value
          ) {
            headerValue = (value as { text: string }).text;
          } else if (typeof value === "object" && value !== null) {
            // Preserve nested objects (e.g. list.unsubscribe, list.post)
            headerValue = value;
          } else {
            headerValue = String(value);
          }

          if (headers[key] != null) {
            // Multiple values for same header — combine strings, keep first object
            if (
              typeof headers[key] === "string" &&
              typeof headerValue === "string"
            ) {
              headers[key] = `${headers[key]}, ${headerValue}`;
            }
          } else {
            headers[key] = headerValue;
          }
        }
      }

      // 4. Extract SES spam/virus verdicts from headers
      const spamVerdict = headers["x-ses-spam-verdict"] || null;
      const virusVerdict = headers["x-ses-virus-verdict"] || null;

      // 5. Upload attachments to S3
      const attachments: Array<{
        id: string;
        filename: string;
        contentType: string;
        size: number;
        s3Key: string;
        contentDisposition: string;
        cid: string | null;
      }> = [];

      if (parsed.attachments && parsed.attachments.length > 0) {
        for (let i = 0; i < parsed.attachments.length; i++) {
          const att = parsed.attachments[i];
          const attId = `att_${i}`;
          const safeFilename = (att.filename || `attachment_${i}`).replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );
          const attKey = `attachments/${emailId}/${attId}-${safeFilename}`;

          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: attKey,
              Body: att.content,
              ContentType: att.contentType || "application/octet-stream",
            })
          );

          attachments.push({
            id: attId,
            filename: att.filename || `attachment_${i}`,
            contentType: att.contentType || "application/octet-stream",
            size: att.size,
            s3Key: attKey,
            contentDisposition: att.contentDisposition || "attachment",
            cid: att.cid || null,
          });
        }
      }

      // 6. Build parsed email JSON
      let html = parsed.html || null;
      let htmlTruncated = false;

      if (html && html.length > MAX_HTML_SIZE) {
        html = html.slice(0, MAX_HTML_SIZE);
        htmlTruncated = true;
      }

      const toAddresses = parsed.to
        ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to])
            .flatMap((addr) => ("value" in addr ? addr.value : [addr]))
            .map((a) => ({
              address: a.address || "",
              name: a.name || "",
            }))
        : [];

      const fromAddress = parsed.from?.value?.[0]
        ? {
            address: parsed.from.value[0].address || "",
            name: parsed.from.value[0].name || "",
          }
        : { address: "", name: "" };

      // Derive receiving domain from first to: address
      const receivingDomain = toAddresses[0]?.address?.split("@")[1] || null;

      const parsedEmail = {
        emailId,
        messageId: parsed.messageId || s3Key.replace("raw/", ""),
        receivingDomain,
        from: fromAddress,
        to: toAddresses,
        cc: parsed.cc
          ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc])
              .flatMap((addr) => ("value" in addr ? addr.value : [addr]))
              .map((a) => ({
                address: a.address || "",
                name: a.name || "",
              }))
          : [],
        subject: parsed.subject || "",
        date: parsed.date?.toISOString() || new Date().toISOString(),
        html,
        htmlTruncated,
        text: parsed.text || null,
        headers,
        attachments,
        spamVerdict,
        virusVerdict,
        rawS3Key: s3Key,
        receivedAt: new Date().toISOString(),
      };

      // 7. Store parsed JSON at parsed/{emailId}.json
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `parsed/${emailId}.json`,
          Body: JSON.stringify(parsedEmail),
          ContentType: "application/json",
        })
      );

      log("Stored parsed email", {
        emailId,
        attachmentCount: attachments.length,
      });

      // 8. Put event to EventBridge
      await eventbridge.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: INBOUND_EVENT_SOURCE,
              DetailType: "email.received",
              Detail: JSON.stringify(parsedEmail),
            },
          ],
        })
      );

      log("Published EventBridge event", { emailId });
    } catch (error) {
      logError("Error processing inbound email", error, { s3Key });
      // Re-throw to trigger Lambda retry / DLQ
      throw error;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Inbound emails processed" }),
  };
}
