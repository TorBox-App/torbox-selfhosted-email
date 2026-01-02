/**
 * Batch Sender Worker
 *
 * SQS Lambda handler that processes batch send jobs.
 * Sends emails/SMS in chunks of 100 contacts.
 */

import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
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

/**
 * Substitute variables in template content.
 * Variables are in the format {{variableName}} or {{object.property}}
 */
function substituteVariables(
  content: string,
  variables: Record<string, string | undefined>
): string {
  return content.replace(
    /\{\{\s*([^}]+)\s*\}\}/g,
    (match, key) => variables[key.trim()] ?? match
  );
}

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

  // Create SES client with customer credentials
  const sesClient = new SESClient({
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  // Load template and organization name if using a template
  let templateHtml: string | undefined;
  let orgName: string | undefined;
  let emailType: "marketing" | "transactional" = "marketing"; // Default to marketing for compliance

  if (batch.emailTemplateId) {
    const [[tmpl], [org]] = await Promise.all([
      db
        .select({
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
    templateHtml = tmpl?.compiledHtml ?? undefined;
    emailType = tmpl?.emailType ?? "marketing";
    orgName = org?.name ?? undefined;
  }

  // Send to each contact (in parallel with concurrency limit)
  let sent = 0;
  let failed = 0;

  const apiBaseUrl = process.env.API_BASE_URL || "https://api.wraps.dev";
  const appBaseUrl = process.env.APP_BASE_URL || "https://app.wraps.dev";

  // Concurrency limit - SES allows 14 requests/second in most regions
  const CONCURRENCY_LIMIT = 10;

  // Process contacts in parallel batches
  const emailContacts = contacts.filter(
    (c) => channel === "email" && c.email
  );

  // Process in parallel with concurrency limit
  const results = await Promise.allSettled(
    emailContacts.map(async (recipient, index) => {
      // Simple concurrency control - stagger starts
      await new Promise((resolve) =>
        setTimeout(resolve, Math.floor(index / CONCURRENCY_LIMIT) * 100)
      );

      // Generate unsubscribe token and URLs only for marketing emails
      let unsubscribeUrl: string | undefined;
      let preferencesUrl: string | undefined;

      if (emailType === "marketing") {
        const unsubscribeToken = await generateUnsubscribeToken(
          recipient.id,
          organizationId
        );
        unsubscribeUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}`;
        preferencesUrl = `${appBaseUrl}/preferences/${unsubscribeToken}`;
      }

      // Substitute variables in template HTML
      let emailHtml =
        templateHtml ?? batch.htmlContent ?? "<p>Hello from Wraps!</p>";

      if (templateHtml) {
        // Build variables object for substitution
        const variables: Record<string, string | undefined> = {
          "contact.email": recipient.email!,
          "contact.firstName": recipient.firstName ?? undefined,
          "contact.lastName": recipient.lastName ?? undefined,
          "contact.company": recipient.company ?? undefined,
          "contact.jobTitle": recipient.jobTitle ?? undefined,
          "organization.name": orgName,
          unsubscribeUrl,
          preferencesUrl,
          // Spread any custom properties (prefixed with contact.properties.)
          ...Object.fromEntries(
            Object.entries(recipient.properties).map(([key, value]) => [
              `contact.properties.${key}`,
              String(value ?? ""),
            ])
          ),
        };

        emailHtml = substituteVariables(templateHtml, variables);
      }

      const messageId = await sendEmail(sesClient, {
        from: batch.from ?? `noreply@${getDefaultDomain()}`,
        fromName: batch.fromName,
        to: recipient.email!,
        subject: batch.subject ?? "Message from Wraps",
        html: emailHtml,
        replyTo: batch.replyTo,
        emailType,
        unsubscribeUrl,
        preferencesUrl,
      });

      return { recipient, messageId };
    })
  );

  // Record results
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { recipient, messageId } = result.value;
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
        messageId,
        status: "sent",
        sentAt: new Date(),
      });
      sent++;
    } else {
      // Find which recipient failed
      const index = results.indexOf(result);
      const recipient = emailContacts[index];
      console.error(`Failed to send to ${recipient?.email}:`, result.reason);

      if (recipient) {
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
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error",
        });
      }
      failed++;
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

interface EmailParams {
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  // Email type determines compliance behavior
  emailType: "marketing" | "transactional";
  // Unsubscribe URLs (only used for marketing emails)
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}

async function sendEmail(
  client: SESClient,
  params: EmailParams
): Promise<string> {
  const source = params.fromName
    ? `${params.fromName} <${params.from}>`
    : params.from;

  const { emailType, unsubscribeUrl, preferencesUrl } = params;
  const isMarketing = emailType === "marketing";

  // Add unsubscribe footer only for marketing emails
  const finalHtml =
    isMarketing && unsubscribeUrl && preferencesUrl
      ? addUnsubscribeFooter(params.html, unsubscribeUrl, preferencesUrl)
      : params.html;

  // Build raw email (with List-Unsubscribe headers for marketing only - RFC 8058)
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  const rawEmail = [
    `From: ${source}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    params.replyTo ? `Reply-To: ${params.replyTo}` : null,
    // RFC 8058 one-click unsubscribe headers (marketing only)
    isMarketing && unsubscribeUrl ? `List-Unsubscribe: <${unsubscribeUrl}>` : null,
    isMarketing && unsubscribeUrl ? "List-Unsubscribe-Post: List-Unsubscribe=One-Click" : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    stripHtml(finalHtml),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    finalHtml,
    "",
    `--${boundary}--`,
  ]
    .filter((line) => line !== null)
    .join("\r\n");

  const result = await client.send(
    new SendRawEmailCommand({
      RawMessage: {
        Data: new TextEncoder().encode(rawEmail),
      },
      ConfigurationSetName: "wraps-email-tracking",
    })
  );

  return result.MessageId ?? "";
}

/**
 * Add unsubscribe footer to HTML email
 */
function addUnsubscribeFooter(
  html: string,
  unsubscribeUrl: string,
  preferencesUrl: string
): string {
  const footer = `
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
  <p>
    <a href="${preferencesUrl}" style="color: #6b7280; text-decoration: underline;">Manage preferences</a>
    &nbsp;|&nbsp;
    <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
  </p>
</div>`;

  // Insert before </body> if exists, otherwise append
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }
  return html + footer;
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
