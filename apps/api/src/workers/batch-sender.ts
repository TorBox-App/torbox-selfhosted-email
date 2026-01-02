/**
 * Batch Sender Worker
 *
 * SQS Lambda handler that processes batch send jobs.
 * Sends emails/SMS in chunks of 100 contacts.
 */

import {
  SendBulkEmailCommand,
  SendEmailCommand,
  SESv2Client,
  type BulkEmailEntry,
} from "@aws-sdk/client-sesv2";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  batchSend,
  contact,
  db,
  eq,
  messageSend,
  organization,
  template,
} from "@wraps/db";
import type { SQSEvent, SQSHandler } from "aws-lambda";
import { and, isNotNull, sql } from "drizzle-orm";

import { generateUnsubscribeToken } from "../lib/unsubscribe-token";
import { getCredentials } from "../services/credentials";
import type { BatchJob } from "../services/queue";

const CHUNK_SIZE = 100;
const QUEUE_URL = process.env.BATCH_QUEUE_URL;

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const job: BatchJob = JSON.parse(record.body);
    await processJob(job);
  }
};

async function processJob(job: BatchJob): Promise<void> {
  const { batchId, organizationId, awsAccountId, channel, chunkIndex } = job;

  // Load batch details
  const [batch] = await db
    .select()
    .from(batchSend)
    .where(eq(batchSend.id, batchId))
    .limit(1);

  if (!batch) {
    console.error(`Batch ${batchId} not found`);
    return;
  }

  // Check if batch was cancelled
  if (batch.status === "cancelled") {
    console.log(`Batch ${batchId} was cancelled, skipping`);
    return;
  }

  // Mark as processing on first chunk
  if (chunkIndex === 0) {
    await db
      .update(batchSend)
      .set({ status: "processing", startedAt: new Date() })
      .where(eq(batchSend.id, batchId));
  }

  // Get contacts for this chunk
  const offset = chunkIndex * CHUNK_SIZE;
  const contacts = await getContactsChunk(
    organizationId,
    channel,
    offset,
    CHUNK_SIZE
  );

  if (contacts.length === 0) {
    // No more contacts, mark batch as completed
    await db
      .update(batchSend)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(batchSend.id, batchId));
    return;
  }

  // Get customer AWS credentials
  const credentials = await getCredentials(awsAccountId);

  // Create SES v2 client with customer credentials (for bulk sending)
  const sesClient = new SESv2Client({
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  // Load template info and organization name
  let sesTemplateName: string | undefined;
  let templateHtml: string | undefined;
  let orgName: string | undefined;
  let emailType: "marketing" | "transactional" = "marketing";

  if (batch.emailTemplateId) {
    const [[tmpl], [org]] = await Promise.all([
      db
        .select({
          sesTemplateName: template.sesTemplateName,
          compiledHtml: template.compiledHtml,
          emailType: template.emailType,
        })
        .from(template)
        .where(eq(template.id, batch.emailTemplateId))
        .limit(1),
      db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1),
    ]);
    sesTemplateName = tmpl?.sesTemplateName ?? undefined;
    templateHtml = tmpl?.compiledHtml ?? undefined;
    emailType = tmpl?.emailType ?? "marketing";
    orgName = org?.name ?? undefined;
  }

  // Send to contacts using SES
  let sent = 0;
  let failed = 0;

  const apiBaseUrl = process.env.API_BASE_URL || "https://api.wraps.dev";
  const appBaseUrl = process.env.APP_BASE_URL || "https://app.wraps.dev";

  // Filter email contacts
  const emailContacts = contacts.filter(
    (c) => channel === "email" && c.email
  );

  const isMarketing = emailType === "marketing";
  const fromAddress = batch.from ?? `noreply@${getDefaultDomain()}`;
  const fromDisplay = batch.fromName
    ? `${batch.fromName} <${fromAddress}>`
    : fromAddress;

  // Use bulk sending for SES templates, individual sends for raw HTML
  if (sesTemplateName) {
    // SES bulk email limit is 50 recipients per API call
    const BULK_BATCH_SIZE = 50;

    // Process in batches of 50
    for (let i = 0; i < emailContacts.length; i += BULK_BATCH_SIZE) {
      const recipientBatch = emailContacts.slice(i, i + BULK_BATCH_SIZE);

      // Build bulk email entries
      const bulkEntries: BulkEmailEntry[] = await Promise.all(
        recipientBatch.map(async (recipient) => {
          // Generate unsubscribe URLs for marketing emails
          let unsubscribeUrl: string | undefined;
          let preferencesUrl: string | undefined;

          if (isMarketing) {
            const unsubscribeToken = await generateUnsubscribeToken(
              recipient.id,
              organizationId
            );
            unsubscribeUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}`;
            preferencesUrl = `${appBaseUrl}/preferences/${unsubscribeToken}`;
          }

          // Build replacement data for SES template (flattened variable names)
          const replacementData: Record<string, string> = {
            contactEmail: recipient.email!,
            contactFirstName: recipient.firstName ?? "",
            contactLastName: recipient.lastName ?? "",
            contactCompany: recipient.company ?? "",
            contactJobTitle: recipient.jobTitle ?? "",
            organizationName: orgName ?? "",
            unsubscribeUrl: unsubscribeUrl ?? "",
            preferencesUrl: preferencesUrl ?? "",
          };

          // Add custom properties with flattened names
          if (recipient.properties) {
            for (const [key, value] of Object.entries(recipient.properties)) {
              const flatKey = `contactProperties${key.charAt(0).toUpperCase()}${key.slice(1)}`;
              replacementData[flatKey] = String(value ?? "");
            }
          }

          const entry: BulkEmailEntry = {
            Destination: {
              ToAddresses: [recipient.email!],
            },
            ReplacementEmailContent: {
              ReplacementTemplate: {
                ReplacementTemplateData: JSON.stringify(replacementData),
              },
            },
          };

          // Add List-Unsubscribe headers for marketing emails (RFC 8058)
          if (isMarketing && unsubscribeUrl) {
            entry.ReplacementHeaders = [
              {
                Name: "List-Unsubscribe",
                Value: `<${unsubscribeUrl}>`,
              },
              {
                Name: "List-Unsubscribe-Post",
                Value: "List-Unsubscribe=One-Click",
              },
            ];
          }

          return entry;
        })
      );

      try {
        const result = await sesClient.send(
          new SendBulkEmailCommand({
            FromEmailAddress: fromDisplay,
            ReplyToAddresses: batch.replyTo ? [batch.replyTo] : undefined,
            DefaultContent: {
              Template: {
                TemplateName: sesTemplateName,
              },
            },
            BulkEmailEntries: bulkEntries,
            ConfigurationSetName: "wraps-email-tracking",
          })
        );

        // Process results for each recipient
        for (let j = 0; j < recipientBatch.length; j++) {
          const recipient = recipientBatch[j];
          const bulkResult = result.BulkEmailEntryResults?.[j];

          if (bulkResult?.Status === "SUCCESS") {
            await db.insert(messageSend).values({
              organizationId,
              contactId: recipient.id,
              awsAccountId,
              channel: "email",
              batchSendId: batchId,
              sourceType: "batch",
              recipient: recipient.email!,
              subject: batch.subject,
              from: batch.from,
              fromName: batch.fromName,
              emailTemplateId: batch.emailTemplateId,
              messageId: bulkResult.MessageId ?? "",
              status: "sent",
              sentAt: new Date(),
            });
            sent++;
          } else {
            console.error(
              `Failed to send to ${recipient.email}:`,
              bulkResult?.Error
            );
            await db.insert(messageSend).values({
              organizationId,
              contactId: recipient.id,
              awsAccountId,
              channel: "email",
              batchSendId: batchId,
              sourceType: "batch",
              recipient: recipient.email!,
              subject: batch.subject,
              from: batch.from,
              fromName: batch.fromName,
              emailTemplateId: batch.emailTemplateId,
              status: "failed",
              error: bulkResult?.Error ?? "Unknown error",
            });
            failed++;
          }
        }
      } catch (error) {
        // Entire batch failed
        console.error(`Bulk send failed for batch starting at ${i}:`, error);
        for (const recipient of recipientBatch) {
          await db.insert(messageSend).values({
            organizationId,
            contactId: recipient.id,
            awsAccountId,
            channel: "email",
            batchSendId: batchId,
            sourceType: "batch",
            recipient: recipient.email ?? "",
            subject: batch.subject,
            from: batch.from,
            fromName: batch.fromName,
            emailTemplateId: batch.emailTemplateId,
            status: "failed",
            error: error instanceof Error ? error.message : "Bulk send failed",
          });
          failed++;
        }
      }
    }
  } else {
    // Fallback: individual sends for raw HTML (parallel with concurrency limit)
    const html = templateHtml ?? batch.htmlContent ?? "<p>Hello from Wraps!</p>";
    const subject = batch.subject ?? "Message from Wraps";
    const CONCURRENCY = 10;

    for (let i = 0; i < emailContacts.length; i += CONCURRENCY) {
      const recipientBatch = emailContacts.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        recipientBatch.map(async (recipient) => {
          // Generate unsubscribe URLs for marketing emails
          let unsubscribeUrl: string | undefined;
          let preferencesUrl: string | undefined;

          if (isMarketing) {
            const unsubscribeToken = await generateUnsubscribeToken(
              recipient.id,
              organizationId
            );
            unsubscribeUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}`;
            preferencesUrl = `${appBaseUrl}/preferences/${unsubscribeToken}`;
          }

          // Build headers for marketing emails (RFC 8058)
          const headers: Array<{ Name: string; Value: string }> = [];
          if (isMarketing && unsubscribeUrl) {
            headers.push(
              { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>` },
              { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }
            );
          }

          const result = await sesClient.send(
            new SendEmailCommand({
              FromEmailAddress: fromDisplay,
              ReplyToAddresses: batch.replyTo ? [batch.replyTo] : undefined,
              Destination: {
                ToAddresses: [recipient.email!],
              },
              Content: {
                Simple: {
                  Subject: { Data: subject },
                  Body: {
                    Html: { Data: html },
                    Text: { Data: stripHtml(html) },
                  },
                  Headers: headers.length > 0 ? headers : undefined,
                },
              },
              ConfigurationSetName: "wraps-email-tracking",
            })
          );

          return { recipient, messageId: result.MessageId };
        })
      );

      // Process results
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const recipient = recipientBatch[j];

        if (result.status === "fulfilled") {
          await db.insert(messageSend).values({
            organizationId,
            contactId: recipient.id,
            awsAccountId,
            channel: "email",
            batchSendId: batchId,
            sourceType: "batch",
            recipient: recipient.email!,
            subject: batch.subject,
            from: batch.from,
            fromName: batch.fromName,
            emailTemplateId: batch.emailTemplateId,
            messageId: result.value.messageId ?? "",
            status: "sent",
            sentAt: new Date(),
          });
          sent++;
        } else {
          console.error(`Failed to send to ${recipient.email}:`, result.reason);
          await db.insert(messageSend).values({
            organizationId,
            contactId: recipient.id,
            awsAccountId,
            channel: "email",
            batchSendId: batchId,
            sourceType: "batch",
            recipient: recipient.email!,
            subject: batch.subject,
            from: batch.from,
            fromName: batch.fromName,
            emailTemplateId: batch.emailTemplateId,
            status: "failed",
            error: result.reason instanceof Error ? result.reason.message : "Send failed",
          });
          failed++;
        }
      }
    }
  }

  // Update batch progress
  await db
    .update(batchSend)
    .set({
      processedRecipients: sql`${batchSend.processedRecipients} + ${contacts.length}`,
      sent: sql`${batchSend.sent} + ${sent}`,
      failed: sql`${batchSend.failed} + ${failed}`,
    })
    .where(eq(batchSend.id, batchId));

  // Check if more contacts to process
  const totalProcessed = (chunkIndex + 1) * CHUNK_SIZE;
  if (totalProcessed < batch.totalRecipients) {
    // Enqueue next chunk
    await enqueueNextChunk({
      ...job,
      chunkIndex: chunkIndex + 1,
    });
  } else {
    // Mark batch as completed
    await db
      .update(batchSend)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(batchSend.id, batchId));
  }
}

type ContactChunk = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  properties: Record<string, unknown>;
};

async function getContactsChunk(
  organizationId: string,
  channel: string,
  offset: number,
  limit: number
): Promise<ContactChunk[]> {
  if (channel === "email") {
    // Filter by active email status (null treated as active for backwards compat)
    return db
      .select({
        id: contact.id,
        email: contact.email,
        phone: contact.phone,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        jobTitle: contact.jobTitle,
        properties: contact.properties,
      })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          isNotNull(contact.email),
          sql`(${contact.emailStatus} = 'active' OR ${contact.emailStatus} IS NULL)`
        )
      )
      .orderBy(contact.createdAt)
      .offset(offset)
      .limit(limit);
  }

  // SMS - filter by opted_in status
  if (channel === "sms") {
    return db
      .select({
        id: contact.id,
        email: contact.email,
        phone: contact.phone,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        jobTitle: contact.jobTitle,
        properties: contact.properties,
      })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          isNotNull(contact.phone),
          eq(contact.smsStatus, "opted_in")
        )
      )
      .orderBy(contact.createdAt)
      .offset(offset)
      .limit(limit);
  }

  return [];
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function enqueueNextChunk(job: BatchJob): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error("BATCH_QUEUE_URL not configured");
  }

  const sqsClient = new SQSClient({});
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(job),
    })
  );
}

function getDefaultDomain(): string {
  return process.env.DEFAULT_DOMAIN ?? "wraps.dev";
}
