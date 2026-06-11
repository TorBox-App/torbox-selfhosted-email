// baseline:allow-large-file
/**
 * Batch Sender Worker
 *
 * SQS Lambda handler that processes batch send jobs.
 * Sends emails/SMS in chunks of 50 contacts (matching SES bulk limit).
 * Respects customer's SES rate limit via SQS delay between chunks.
 */

import {
  type BulkEmailEntry,
  GetAccountCommand,
  SESv2Client,
  SendBulkEmailCommand,
} from "@aws-sdk/client-sesv2";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { toPlainText } from "@react-email/render";
import {
  awsAccount,
  batchSend,
  buildConditionSQL,
  contact,
  contactTopic,
  db,
  eq,
  messageSend,
  organization,
  organizationExtension,
  segment,
  template,
} from "@wraps/db";
import { toSesVariableName, transformVariablesForSes } from "@wraps/email";
import { sendEmail, WRAPS_CONFIGURATION_SET_NAME } from "@wraps/email-send";
import {
  extractCanonicalVars,
  renderTemplateStrict,
} from "@wraps/template-render";
import type { Context, SQSEvent, SQSHandler, SQSRecord } from "aws-lambda";
import { and, exists, inArray, isNotNull, or, sql } from "drizzle-orm";
import { trackFirstEmailSent } from "../lib/activation-tracking";
import { awsDefaults } from "../lib/aws-defaults";
import { flushLogger, log } from "../lib/logger";
import { generateUnsubscribeToken } from "../lib/unsubscribe-token";
import { getCredentials } from "../services/credentials";
import type { BatchJob } from "../services/queue";
import { applyVariableMappings } from "./variable-mappings";

// Align chunk size with SES bulk limit for clean 1:1 mapping
const CHUNK_SIZE = 50; // SES SendBulkEmail limit per API call
const DEFAULT_RATE_LIMIT = 14; // Fallback emails/sec if can't fetch from AWS
const QUEUE_URL = process.env.BATCH_QUEUE_URL;
// Staleness threshold: 3× the Lambda timeout (infra/queues.ts:95 = 5 min).
// A live execution's claim can never be older than 15 minutes; anything older
// means the Lambda crashed before completing, so reclaim is safe.
const CLAIM_STALE_MINUTES = 15;

// Below this remaining-time floor, re-enqueue the chunk instead of racing
// the invocation timeout. Above receiveCount=2, fall through — processing
// slowly beats an infinite re-enqueue loop.
const SELF_RESCHEDULE_FLOOR_MS = 45_000;
const SELF_RESCHEDULE_LOOP_GUARD = 2;
const SELF_RESCHEDULE_DELAY_SECONDS = 10;

export const handler: SQSHandler = async (
  event: SQSEvent,
  context: Context
) => {
  if (!QUEUE_URL) {
    throw new Error(
      "BATCH_QUEUE_URL not configured — check Lambda environment"
    );
  }
  try {
    for (const record of event.Records) {
      const job: BatchJob = JSON.parse(record.body);
      await processJob(job, context, record);
    }
  } finally {
    await flushLogger();
  }
};

async function processJob(
  job: BatchJob,
  context: Context,
  record: SQSRecord
): Promise<void> {
  const { batchId, organizationId, awsAccountId, channel, chunkIndex } = job;

  // Scoped by (id, organizationId) — blocks cross-org reads.
  const [batch] = await db
    .select()
    .from(batchSend)
    .where(
      and(
        eq(batchSend.id, batchId),
        eq(batchSend.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!batch) {
    log.error("Batch not found", undefined, { batchId, organizationId });
    return;
  }

  // Cancelled / unsupported-channel checks MUST run before self-reschedule
  // so a doomed batch can't bounce forever on short-remaining invocations.
  if (batch.status === "cancelled") {
    log.info("Batch cancelled, skipping", { batchId });
    return;
  }

  if (channel !== "email") {
    log.error("Unsupported batch channel", undefined, {
      batchId,
      channel,
      organizationId,
    });
    await db
      .update(batchSend)
      .set({
        status: "failed",
        completedAt: new Date(),
        processedRecipients: batch.totalRecipients,
        failed: batch.totalRecipients,
        errorMessage: `Unsupported batch channel: ${channel}`,
        errorDetails: { channel },
      })
      .where(eq(batchSend.id, batchId));
    return;
  }

  const remainingMs = context.getRemainingTimeInMillis();
  if (remainingMs < SELF_RESCHEDULE_FLOOR_MS) {
    const receiveCount = Number(record.attributes.ApproximateReceiveCount ?? 1);
    if (receiveCount > SELF_RESCHEDULE_LOOP_GUARD) {
      log.warn("broadcast.self_reschedule.suspected_loop", {
        batchId,
        chunkIndex,
        remainingMs,
        receiveCount,
      });
    } else {
      log.info("broadcast.self_reschedule", {
        batchId,
        chunkIndex,
        remainingMs,
        receiveCount,
      });
      await enqueueNextChunk(job, {
        delaySeconds: SELF_RESCHEDULE_DELAY_SECONDS,
      });
      return;
    }
  }

  // Mark as processing on first chunk
  if (chunkIndex === 0) {
    await db
      .update(batchSend)
      .set({ status: "processing", startedAt: new Date() })
      .where(eq(batchSend.id, batchId));
  }

  const remainingRecipients = Math.max(
    batch.totalRecipients - batch.processedRecipients,
    0
  );
  if (remainingRecipients === 0) {
    await db
      .update(batchSend)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(batchSend.id, batchId));
    return;
  }

  // Get contacts for this chunk using cursor-based pagination
  const contacts = await getContactsChunk(
    organizationId,
    channel,
    Math.min(CHUNK_SIZE, remainingRecipients),
    {
      audienceType: batch.audienceType as
        | "all"
        | "topic"
        | "segment"
        | undefined,
      topicId: batch.topicId ?? undefined,
      segmentId: batch.segmentId ?? undefined,
    },
    job.cursor
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
  const credentials = await getCredentials(awsAccountId, organizationId);

  // Resolve the correct SES config set for this account (may be per-domain)
  const [accountRow] = await db
    .select({ features: awsAccount.features })
    .from(awsAccount)
    .where(
      and(
        eq(awsAccount.id, awsAccountId),
        eq(awsAccount.organizationId, organizationId)
      )
    )
    .limit(1);
  const configSetName =
    accountRow?.features?.email?.configSetName ?? WRAPS_CONFIGURATION_SET_NAME;

  // Create SES v2 client with customer credentials and their SES region
  const sesClient = new SESv2Client({
    ...awsDefaults,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    region: credentials.region,
  });

  // Fetch customer's SES rate limit
  let maxSendRate = DEFAULT_RATE_LIMIT;
  try {
    const accountInfo = await sesClient.send(new GetAccountCommand({}));
    maxSendRate = accountInfo.SendQuota?.MaxSendRate ?? DEFAULT_RATE_LIMIT;
  } catch (error) {
    log.warn("Could not fetch SES rate limit, using default", {
      error: String(error),
    });
  }

  // Calculate delay between chunks to respect rate limit
  // CHUNK_SIZE recipients / rate limit = seconds to wait
  const rateLimitDelay = Math.ceil(CHUNK_SIZE / maxSendRate);

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
        .where(
          and(
            eq(template.id, batch.emailTemplateId),
            eq(template.organizationId, organizationId)
          )
        )
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
  const sentContactIds: string[] = [];

  const apiBaseUrl = process.env.API_BASE_URL || "https://api.wraps.dev";
  const appBaseUrl = process.env.APP_BASE_URL || "https://app.wraps.dev";

  // Filter email contacts
  let emailContacts = contacts.filter((c) => channel === "email" && c.email);

  // Claim contacts atomically BEFORE sending. The partial unique index
  // message_send_dedup_idx (batchSendId, contactId) makes the insert a
  // race-safe claim: concurrent duplicate deliveries of this chunk each
  // try to INSERT, only one wins per contact. NOTE: bare onConflictDoNothing()
  // — Drizzle cannot target a partial unique index.
  const now = new Date();
  const claimRows = emailContacts.map((c) => ({
    organizationId,
    contactId: c.id,
    awsAccountId,
    channel: "email" as const,
    batchSendId: batchId,
    sourceType: "batch" as const,
    recipient: c.email ?? "",
    subject: batch.subject,
    from: batch.from,
    fromName: batch.fromName,
    emailTemplateId: batch.emailTemplateId,
    status: "queued" as const,
    claimedAt: now,
  }));
  const claimed = claimRows.length
    ? await db
        .insert(messageSend)
        .values(claimRows)
        .onConflictDoNothing()
        .returning({ contactId: messageSend.contactId })
    : [];
  const claimedIds = new Set(claimed.map((r) => r.contactId));

  // Re-claim retryable rows the insert skipped (failed rows + stale crashed claims).
  // The UPDATE serializes on each row under READ COMMITTED: the loser re-evaluates
  // after the winner commits and sees status='queued' with a fresh claimedAt — so
  // it matches zero rows and the race is closed. NEVER use a blanket
  // `status NOT IN dedupStatuses` here: 'queued' would be outside that set and
  // the predicate would steal FRESH claims from a live concurrent execution,
  // reintroducing the duplicate-send race this whole block is meant to prevent.
  const notClaimed = emailContacts
    .filter((c) => !claimedIds.has(c.id))
    .map((c) => c.id);
  if (notClaimed.length > 0) {
    const reclaimed = await db
      .update(messageSend)
      .set({ status: "queued", error: null, claimedAt: new Date() })
      .where(
        and(
          eq(messageSend.organizationId, organizationId),
          eq(messageSend.batchSendId, batchId),
          inArray(messageSend.contactId, notClaimed),
          or(
            eq(messageSend.status, "failed"),
            and(
              eq(messageSend.status, "queued"),
              sql`${messageSend.claimedAt} < now() - interval '${sql.raw(String(CLAIM_STALE_MINUTES))} minutes'`
            )
          )
        )
      )
      .returning({ contactId: messageSend.contactId });
    for (const r of reclaimed) {
      claimedIds.add(r.contactId);
    }
  }

  emailContacts = emailContacts.filter((c) => claimedIds.has(c.id));

  if (claimedIds.size < claimRows.length) {
    log.info("Batch claim: skipped already-claimed contacts", {
      batchId,
      total: claimRows.length,
      claimed: claimedIds.size,
      skipped: claimRows.length - claimedIds.size,
    });
  }

  const chunkProcessedRecipients = emailContacts.length;
  const isMarketing = emailType === "marketing";

  // Resolve sender: batch.from > org default > owner email domain > fail
  let fromAddress: string | null = batch.from;
  let fromName: string | null = batch.fromName;
  if (!fromAddress) {
    const [orgExt] = await db
      .select({
        defaultFrom: organizationExtension.defaultFrom,
        defaultFromName: organizationExtension.defaultFromName,
      })
      .from(organizationExtension)
      .where(eq(organizationExtension.organizationId, organizationId))
      .limit(1);
    fromAddress = orgExt?.defaultFrom ?? null;
    if (!fromName) {
      fromName = orgExt?.defaultFromName ?? null;
    }
  }

  if (!fromAddress) {
    log.error("No sender address configured for batch", {
      batchId,
      organizationId,
    });
    // Mark all claimed contacts in this chunk as failed
    if (emailContacts.length > 0) {
      await db
        .update(messageSend)
        .set({
          status: "failed",
          error:
            "No sender email configured. Set a default sender in Settings > Sender Defaults.",
        })
        .where(
          and(
            eq(messageSend.organizationId, organizationId),
            eq(messageSend.batchSendId, batchId),
            inArray(
              messageSend.contactId,
              emailContacts.map((c) => c.id)
            )
          )
        );
    }
    await db
      .update(batchSend)
      .set({
        status: "failed",
        completedAt: new Date(),
        processedRecipients: sql`${batchSend.processedRecipients} + ${emailContacts.length}`,
        failed: sql`${batchSend.failed} + ${emailContacts.length}`,
      })
      .where(eq(batchSend.id, batchId));
    return;
  }

  const fromDisplay = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  // For topic-audienced batches, scope the one-click unsubscribe to that topic
  // so recipients are only removed from that list — not all org topics.
  // "all" and "segment" audiences fall back to global unsubscribe since no
  // single topic represents the send.
  const unsubscribeTopicId =
    batch.audienceType === "topic" ? (batch.topicId ?? undefined) : undefined;

  // Use bulk sending for SES templates, individual sends for raw HTML
  if (sesTemplateName) {
    // SES bulk email limit is 50 recipients per API call
    const BULK_BATCH_SIZE = 50;

    // Pre-compute canonical vars that the SES template references so we can
    // pad TemplateData with empty-string fallbacks. SES hard-fails rendering
    // (RenderingFailure → silent non-delivery) when a bare {{var}} is absent
    // from TemplateData. Empty string is falsy for {{#if}} so conditionals
    // still work correctly. We scan both subject and body; use the original
    // compiledHtml since it retains the {{dot.notation}} form that
    // extractCanonicalVars was designed to match.
    const templateCanonicalVars = extractCanonicalVars(
      `${batch.subject ?? ""}\n${templateHtml ?? ""}`
    );

    // Process in batches of 50
    for (let i = 0; i < emailContacts.length; i += BULK_BATCH_SIZE) {
      const recipientBatch = emailContacts.slice(i, i + BULK_BATCH_SIZE);

      // Build bulk email entries, keeping the per-recipient rendered subject
      // alongside each entry so messageSend records what the recipient sees
      // (SES renders server-side; recording batch.subject raw put literal
      // {{#if firstName}} into email logs).
      const prepared = await Promise.all(
        recipientBatch.map(async (recipient) => {
          // Generate unsubscribe URLs for marketing emails
          let unsubscribeUrl: string | undefined;
          let preferencesUrl: string | undefined;

          if (isMarketing) {
            const unsubscribeToken = await generateUnsubscribeToken(
              recipient.id,
              organizationId,
              unsubscribeTopicId
            );
            unsubscribeUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}`;
            preferencesUrl = `${appBaseUrl}/preferences/${unsubscribeToken}`;
          }

          // Apply user-configured variable mappings
          const finalData = applyVariableMappings(
            buildRecipientReplacementData(recipient, {
              orgName,
              unsubscribeUrl,
              preferencesUrl,
            }),
            batch.variableMappings ?? undefined,
            recipient
          );

          // Pad missing vars so SES never encounters an absent variable.
          // SES hard-fails rendering when a bare {{var}} is missing from
          // ReplacementTemplateData. Empty string is falsy for {{#if}}.
          for (const rawVar of templateCanonicalVars) {
            const sesKey = toSesVariableName(rawVar);
            if (!(sesKey in finalData)) {
              finalData[sesKey] = "";
            }
          }

          const entry: BulkEmailEntry = {
            Destination: {
              ToAddresses: [recipient.email!],
            },
            ReplacementEmailContent: {
              ReplacementTemplate: {
                ReplacementTemplateData: JSON.stringify(finalData),
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

          return {
            entry,
            renderedSubject: renderSubjectForRecord(batch.subject, finalData),
          };
        })
      );
      const bulkEntries: BulkEmailEntry[] = prepared.map((p) => p.entry);

      // Build default template data (required by SES as fallback)
      const defaultTemplateData: Record<string, string> = {
        email: "",
        firstName: "",
        lastName: "",
        company: "",
        jobTitle: "",
        contactEmail: "",
        contactFirstName: "",
        contactLastName: "",
        contactCompany: "",
        contactJobTitle: "",
        organizationName: orgName ?? "",
        unsubscribeUrl: "",
        preferencesUrl: "",
      };

      // Pad DefaultContent.TemplateData with the same missing vars.
      // SES uses this as a fallback when a recipient entry lacks a key.
      for (const rawVar of templateCanonicalVars) {
        const sesKey = toSesVariableName(rawVar);
        if (!(sesKey in defaultTemplateData)) {
          defaultTemplateData[sesKey] = "";
        }
      }

      try {
        const result = await sesClient.send(
          new SendBulkEmailCommand({
            FromEmailAddress: fromDisplay,
            ReplyToAddresses: batch.replyTo ? [batch.replyTo] : undefined,
            DefaultContent: {
              Template: {
                TemplateName: sesTemplateName,
                TemplateData: JSON.stringify(defaultTemplateData),
              },
            },
            BulkEmailEntries: bulkEntries,
            ConfigurationSetName: configSetName,
            // Message tags for tracking in CloudWatch and EventBridge
            DefaultEmailTags: [
              { Name: "batchId", Value: batchId },
              { Name: "organizationId", Value: organizationId },
              ...(batch.emailTemplateId
                ? [{ Name: "templateId", Value: batch.emailTemplateId }]
                : []),
              { Name: "source", Value: "broadcast" },
            ],
          })
        );

        // Update claimed rows with send results. Each row was claimed before the
        // SES call — we UPDATE by (organizationId, batchSendId, contactId).
        // messageId rule: unique index on messageId; write null (not "") so Postgres
        // allows multiple NULL values without a uniqueness collision.
        const sentAt = new Date();
        await Promise.all(
          recipientBatch.map(async (recipient, j) => {
            const bulkResult = result.BulkEmailEntryResults?.[j];
            if (bulkResult?.Status === "SUCCESS") {
              await db
                .update(messageSend)
                .set({
                  status: "sent",
                  messageId: bulkResult.MessageId || null,
                  subject: prepared[j].renderedSubject,
                  sentAt,
                })
                .where(
                  and(
                    eq(messageSend.organizationId, organizationId),
                    eq(messageSend.batchSendId, batchId),
                    eq(messageSend.contactId, recipient.id)
                  )
                );
              sent++;
              sentContactIds.push(recipient.id);
            } else {
              log.error("Bulk send failed for recipient", bulkResult?.Error, {
                email: recipient.email,
                batchId,
                organizationId,
              });
              await db
                .update(messageSend)
                .set({
                  status: "failed",
                  error: bulkResult?.Error ?? "Unknown error",
                })
                .where(
                  and(
                    eq(messageSend.organizationId, organizationId),
                    eq(messageSend.batchSendId, batchId),
                    eq(messageSend.contactId, recipient.id)
                  )
                );
              failed++;
            }
          })
        );
      } catch (error) {
        // Check if this is a throttle error
        const isThrottle =
          error instanceof Error &&
          (error.name === "Throttling" ||
            error.name === "TooManyRequestsException" ||
            error.message.includes("rate exceeded"));

        if (isThrottle) {
          // Release this invocation's unused claims BEFORE re-enqueueing.
          // The redelivery lands in ~30s — far below the 15-minute staleness
          // window — so still-queued rows claimed by THIS invocation would
          // block both the redelivery's claim INSERT (unique-index conflict)
          // and its re-claim UPDATE (not stale), stranding every unsent
          // contact at 'queued' forever. Every contact in emailContacts was
          // claimed by this invocation (post-claim filter guarantees it), and
          // the status='queued' predicate skips rows already updated to
          // sent/failed by earlier sub-batches of this loop. DELETE restores
          // the exact pre-claim state so the redelivery's INSERT claim works
          // unchanged.
          await db.delete(messageSend).where(
            and(
              eq(messageSend.organizationId, organizationId),
              eq(messageSend.batchSendId, batchId),
              inArray(
                messageSend.contactId,
                emailContacts.map((c) => c.id)
              ),
              eq(messageSend.status, "queued")
            )
          );

          // Re-queue this chunk with a longer delay (30 seconds)
          log.warn("SES throttled, requeuing chunk with delay", {
            batchId,
            chunkIndex,
            delaySeconds: 30,
          });
          await enqueueNextChunk(
            { ...job }, // Same job, same chunkIndex
            { delaySeconds: 30 }
          );
          return; // Exit early, will retry later
        }

        // Permission error: fail fast with actionable message
        const isPermission =
          error instanceof Error &&
          (error.name === "AccessDeniedException" ||
            error.name === "AccessDenied" ||
            error.message.includes("is not authorized to perform") ||
            error.message.includes("AccessDenied"));

        if (isPermission) {
          const permError =
            "Your IAM role does not have permission to send emails. " +
            "Fix: update your CloudFormation stack to the latest version, " +
            "or run `wraps platform update-role` in the CLI.";
          log.error("Bulk send permission denied", error, {
            batchId,
            organizationId,
          });
          if (recipientBatch.length > 0) {
            await db
              .update(messageSend)
              .set({ status: "failed", error: permError })
              .where(
                and(
                  eq(messageSend.organizationId, organizationId),
                  eq(messageSend.batchSendId, batchId),
                  inArray(
                    messageSend.contactId,
                    recipientBatch.map((r) => r.id)
                  )
                )
              );
          }
          throw new Error(permError);
        }

        // Non-throttle error: mark claimed recipients as failed
        log.error("Bulk send failed for chunk", error, {
          batchId,
          chunkOffset: i,
          organizationId,
        });
        const errorMessage =
          error instanceof Error ? error.message : "Bulk send failed";
        if (recipientBatch.length > 0) {
          await db
            .update(messageSend)
            .set({ status: "failed", error: errorMessage })
            .where(
              and(
                eq(messageSend.organizationId, organizationId),
                eq(messageSend.batchSendId, batchId),
                inArray(
                  messageSend.contactId,
                  recipientBatch.map((r) => r.id)
                )
              )
            );
        }
        failed += recipientBatch.length;
      }
    }
  } else {
    // Fallback: individual sends for raw HTML (parallel with concurrency limit)
    // Transform variables to SES format so the local renderer sees the same
    // {{contactFirstName}}-style names SES templates use.
    // Note: templateHtml (from compiledHtml) should already be transformed by publish
    // but batch.htmlContent might contain untransformed variables
    const rawHtml =
      templateHtml ?? batch.htmlContent ?? "<p>Hello from Wraps!</p>";
    const htmlTemplate = transformVariablesForSes(rawHtml);
    const subjectTemplate = transformVariablesForSes(
      batch.subject ?? "Message from Wraps"
    );
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
              organizationId,
              unsubscribeTopicId
            );
            unsubscribeUrl = `${apiBaseUrl}/unsubscribe/${unsubscribeToken}`;
            preferencesUrl = `${appBaseUrl}/preferences/${unsubscribeToken}`;
          }

          // On this path WE are the rendering engine (no SES template), so
          // substitute per recipient. A render failure throws and the send is
          // recorded as failed — never deliver raw {{...}} syntax.
          const finalData = applyVariableMappings(
            buildRecipientReplacementData(recipient, {
              orgName,
              unsubscribeUrl,
              preferencesUrl,
            }),
            batch.variableMappings ?? undefined,
            recipient
          );
          const html = renderForSend(htmlTemplate, finalData);
          // noEscape: subjects are plain-text headers — "O'Brien" must not
          // become "O&#x27;Brien"
          const subject = renderForSend(subjectTemplate, finalData, {
            noEscape: true,
          });

          const result = await sendEmail({
            client: sesClient,
            from: fromDisplay,
            to: recipient.email!,
            subject,
            html,
            text: htmlToPlainText(html),
            replyTo: batch.replyTo ?? undefined,
            marketing:
              isMarketing && unsubscribeUrl ? { unsubscribeUrl } : undefined,
            tags: [
              { name: "batchId", value: batchId },
              { name: "organizationId", value: organizationId },
              ...(batch.emailTemplateId
                ? [{ name: "templateId", value: batch.emailTemplateId }]
                : []),
              { name: "source", value: "broadcast" },
            ],
          });

          return { recipient, messageId: result.messageId, subject };
        })
      );

      // Update claimed rows with send results (raw-HTML individual-send path).
      // messageId rule: use || null (not ?? "") — unique index prohibits duplicate
      // non-NULL values; multiple NULLs are allowed.
      const sentAt = new Date();
      await Promise.all(
        results.map(async (result, j) => {
          const recipient = recipientBatch[j];
          if (result.status === "fulfilled") {
            await db
              .update(messageSend)
              .set({
                status: "sent",
                messageId: result.value.messageId || null,
                subject: result.value.subject,
                sentAt,
              })
              .where(
                and(
                  eq(messageSend.organizationId, organizationId),
                  eq(messageSend.batchSendId, batchId),
                  eq(messageSend.contactId, recipient.id)
                )
              );
            sent++;
            sentContactIds.push(recipient.id);
          } else {
            log.error("Individual send failed", result.reason, {
              email: recipient.email,
              batchId,
              organizationId,
            });
            await db
              .update(messageSend)
              .set({
                status: "failed",
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : "Send failed",
              })
              .where(
                and(
                  eq(messageSend.organizationId, organizationId),
                  eq(messageSend.batchSendId, batchId),
                  eq(messageSend.contactId, recipient.id)
                )
              );
            failed++;
          }
        })
      );
    }
  }

  // Track first email sent
  if (sent > 0) {
    await trackFirstEmailSent(organizationId, {
      channel: "email",
      source: "broadcast",
    }).catch((err) =>
      log.error("Activation tracking failed", err, { organizationId })
    );
  }

  // Update contact email counters for successful sends
  if (sentContactIds.length > 0) {
    await db
      .update(contact)
      .set({
        lastEmailSentAt: new Date(),
        emailsSent: sql`COALESCE(${contact.emailsSent}, 0) + 1`,
      })
      .where(inArray(contact.id, sentContactIds));
  }

  // Compute cursor BEFORE the progress UPDATE so the heartbeat pointer
  // (lastCursor) lands in the same write — DLQ consumer and /resume both
  // read lastChunkIndex/lastCursor to know where to pick up.
  const lastContact = contacts.at(-1);
  const nextCursor = lastContact ? { id: lastContact.id } : null;

  await db
    .update(batchSend)
    .set({
      processedRecipients: sql`${batchSend.processedRecipients} + ${chunkProcessedRecipients}`,
      sent: sql`${batchSend.sent} + ${sent}`,
      failed: sql`${batchSend.failed} + ${failed}`,
      lastChunkAt: new Date(),
      lastChunkIndex: chunkIndex,
      lastCursor: nextCursor,
    })
    .where(eq(batchSend.id, batchId));

  const shouldEnqueueNextChunk =
    contacts.length === Math.min(CHUNK_SIZE, remainingRecipients) &&
    batch.processedRecipients + contacts.length < batch.totalRecipients;
  if (shouldEnqueueNextChunk) {
    await enqueueNextChunk(
      { ...job, chunkIndex: chunkIndex + 1, cursor: nextCursor ?? undefined },
      { delaySeconds: rateLimitDelay }
    );
  } else {
    // Short chunk means we've reached the end — mark batch completed
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
  createdAt: Date;
};

type RecipientFilter = {
  audienceType?: "all" | "topic" | "segment";
  topicId?: string;
  segmentId?: string;
};

export type BatchCursor = { id: string };

export async function getContactsChunk(
  organizationId: string,
  channel: string,
  limit: number,
  filter?: RecipientFilter,
  cursor?: BatchCursor
): Promise<ContactChunk[]> {
  const conditions: (ReturnType<typeof eq> | ReturnType<typeof sql>)[] = [
    eq(contact.organizationId, organizationId),
  ];

  if (channel === "email") {
    conditions.push(isNotNull(contact.email));
    conditions.push(
      sql`(${contact.emailStatus} = 'active' OR ${contact.emailStatus} IS NULL)`
    );
  } else if (channel === "sms") {
    conditions.push(isNotNull(contact.phone));
    conditions.push(eq(contact.smsStatus, "opted_in"));
  } else {
    return [];
  }

  // Apply recipient filter
  if (filter?.audienceType === "topic" && filter.topicId) {
    const topicSubquery = db
      .select({ contactId: contactTopic.contactId })
      .from(contactTopic)
      .where(
        and(
          eq(contactTopic.contactId, contact.id),
          eq(contactTopic.topicId, filter.topicId),
          eq(contactTopic.status, "subscribed")
        )
      );
    conditions.push(exists(topicSubquery));
  }

  if (filter?.audienceType === "segment" && filter.segmentId) {
    const [segmentRow] = await db
      .select({ id: segment.id, condition: segment.condition })
      .from(segment)
      .where(
        and(
          eq(segment.id, filter.segmentId),
          eq(segment.organizationId, organizationId)
        )
      );

    if (!segmentRow) {
      log.warn("Segment not found for batch send", {
        segmentId: filter.segmentId,
        organizationId,
      });
      return [];
    }

    const segmentSQL = buildConditionSQL(segmentRow.condition);
    if (segmentSQL) {
      conditions.push(segmentSQL);
    }
  }

  // Cursor-based (keyset) pagination: skip contacts at or before the cursor
  // position instead of using OFFSET, which breaks when contacts are
  // added/deleted between chunks.
  if (cursor) {
    conditions.push(sql`${contact.id} > ${cursor.id}`);
  }

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
      createdAt: contact.createdAt,
    })
    .from(contact)
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(contact.id)
    .limit(limit);
}

/**
 * Convert HTML to plain text for email fallback
 * Uses react-email's toPlainText for robust HTML-to-text conversion
 */
function htmlToPlainText(html: string): string {
  return toPlainText(html);
}

type BatchRecipient = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  properties: Record<string, unknown> | null;
};

/**
 * Build per-recipient replacement data for template rendering.
 * Only includes non-empty values: SES treats both absent and "" as falsy
 * in {{#if}} (verified via test-render), and the local Handlebars renderer
 * treats "" as falsy too, so omitting empties keeps both engines agreeing
 * on conditional branches. Bare {{var}} references to a missing key are
 * the dangerous case — SES hard-fails rendering — which is why the bulk
 * send's DefaultContent.TemplateData supplies every standard key as "".
 */
function buildRecipientReplacementData(
  recipient: BatchRecipient,
  urls: {
    orgName: string | null | undefined;
    unsubscribeUrl: string | undefined;
    preferencesUrl: string | undefined;
  }
): Record<string, string> {
  const replacementData: Record<string, string> = {};

  const addIfPresent = (key: string, value: string | null | undefined) => {
    if (value) {
      replacementData[key] = value;
    }
  };

  // Always include email (required)
  replacementData.email = recipient.email!;
  replacementData.contactEmail = recipient.email!;

  // Short names (for templates using {{firstName}})
  addIfPresent("firstName", recipient.firstName);
  addIfPresent("lastName", recipient.lastName);
  addIfPresent("company", recipient.company);
  addIfPresent("jobTitle", recipient.jobTitle);

  // Full names with prefix (for templates using {{contact.firstName}})
  addIfPresent("contactFirstName", recipient.firstName);
  addIfPresent("contactLastName", recipient.lastName);
  addIfPresent("contactCompany", recipient.company);
  addIfPresent("contactJobTitle", recipient.jobTitle);

  // Organization and URLs
  addIfPresent("organizationName", urls.orgName);
  addIfPresent("unsubscribeUrl", urls.unsubscribeUrl);
  addIfPresent("preferencesUrl", urls.preferencesUrl);

  // Add custom properties with flattened names (only non-empty)
  if (recipient.properties) {
    for (const [key, value] of Object.entries(recipient.properties)) {
      const strValue = value != null ? String(value) : null;
      if (strValue) {
        replacementData[key] = strValue;
        const flatKey = `contactProperties${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        replacementData[flatKey] = strValue;
      }
    }
  }

  return replacementData;
}

/**
 * Render a batch subject for the messageSend record on the SES-template
 * path. SES does the authoritative render server-side; this local render
 * exists so email logs show what the recipient saw instead of raw
 * {{...}} syntax. Best-effort: a render failure falls back to the raw
 * subject rather than blocking a send SES may handle fine.
 */
function renderSubjectForRecord(
  subject: string | null,
  data: Record<string, string>
): string | null {
  if (!subject) {
    return subject;
  }
  try {
    return renderTemplateStrict(transformVariablesForSes(subject), data, {
      noEscape: true,
    });
  } catch {
    return subject;
  }
}

/**
 * Render a template string for the raw-HTML send path, where WE are the
 * rendering engine (no SES template involved). A failure throws — the
 * per-recipient send is recorded as failed instead of delivering raw
 * {{...}} template syntax to a real inbox.
 */
function renderForSend(
  template: string,
  data: Record<string, string>,
  options: { noEscape?: boolean } = {}
): string {
  try {
    return renderTemplateStrict(template, data, options);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Template rendering failed: ${reason}. Send blocked so the recipient does not receive raw {{...}} template syntax.`
    );
  }
}

async function enqueueNextChunk(
  job: BatchJob,
  options?: { delaySeconds?: number }
): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error("BATCH_QUEUE_URL not configured");
  }

  const sqsClient = new SQSClient(awsDefaults);
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(job),
      // SQS delay for rate limiting (max 900 seconds)
      DelaySeconds: options?.delaySeconds
        ? Math.min(options.delaySeconds, 900)
        : undefined,
    })
  );
}
