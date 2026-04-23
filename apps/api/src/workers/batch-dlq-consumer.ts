/**
 * Batch DLQ Consumer
 *
 * Drains the batch dead-letter queue. When a worker invocation exhausts its
 * 3 SQS retries, SQS moves the message here. This consumer:
 *
 *   1. Loads the corresponding batch row (scoped by organizationId),
 *   2. Reads the durable heartbeat (`lastChunkIndex`, `lastCursor`),
 *   3. Re-enqueues the NEXT chunk from that point on `batchQueue`,
 *   4. Appends a `chunksFailed` entry to `batchSend.errorDetails`.
 *
 * The heartbeat is the source of truth — NOT the SQS body's cursor, which
 * was chunk N's *input*, not its output.
 *
 * IMPORTANT: this handler must never throw. There is no DLQ-of-DLQ.
 */

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { and, batchSend, db, eq } from "@wraps/db";
import type { SQSEvent, SQSHandler } from "aws-lambda";

import { awsDefaults } from "../lib/aws-defaults";
import { flushLogger, log } from "../lib/logger";
import type { BatchJob } from "../services/queue";

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "failed"]);
const QUEUE_URL = process.env.BATCH_QUEUE_URL;

type ChunkFailureEntry = {
  failedChunkIndex: number;
  at: string;
  reason: string;
};

export const handler: SQSHandler = async (event: SQSEvent) => {
  if (process.env.BROADCAST_DLQ_CONSUMER_ENABLED === "false") {
    log.info("broadcast.dlq.disabled", {
      reason: "BROADCAST_DLQ_CONSUMER_ENABLED=false",
      records: event.Records.length,
    });
    await flushLogger().catch(() => {});
    return;
  }

  for (const record of event.Records) {
    try {
      const job = parseJob(record.body);
      if (!job) {
        log.error("broadcast.dlq.bad_body", undefined, {
          messageId: record.messageId,
          body: record.body.slice(0, 500),
        });
        continue;
      }

      await handleDlqRecord(job);
    } catch (error) {
      log.error("broadcast.dlq.record_failed", error, {
        messageId: record.messageId,
        body: record.body.slice(0, 500),
      });
    }
  }

  await flushLogger().catch(() => {});
};

function parseJob(body: string): BatchJob | null {
  try {
    return JSON.parse(body) as BatchJob;
  } catch {
    return null;
  }
}

async function handleDlqRecord(job: BatchJob): Promise<void> {
  const { batchId, organizationId } = job;

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
    log.warn("broadcast.dlq.batch_missing", { batchId, organizationId });
    return;
  }

  if (TERMINAL_STATUSES.has(batch.status)) {
    log.info("broadcast.dlq.terminal_status", {
      batchId,
      organizationId,
      status: batch.status,
    });
    return;
  }

  if (!batch.awsAccountId) {
    log.warn("broadcast.dlq.aws_account_missing", {
      batchId,
      organizationId,
    });
    return;
  }

  if (batch.processedRecipients >= batch.totalRecipients) {
    log.info("broadcast.dlq.already_complete", {
      batchId,
      organizationId,
      processedRecipients: batch.processedRecipients,
      totalRecipients: batch.totalRecipients,
    });
    return;
  }

  // Compute resume point from the durable heartbeat, not the SQS body.
  // chunk N's input cursor (body.cursor) is NOT what we want — we want the
  // output cursor of the LAST chunk that successfully finished, which the
  // worker persists at the end of its progress UPDATE.
  const resumeChunkIndex =
    batch.lastChunkIndex == null ? 0 : batch.lastChunkIndex + 1;
  const resumeCursor = batch.lastCursor ?? undefined;

  // Audit trail on batchSend.errorDetails. Axiom logs expire in 30 days;
  // the DB audit survives longer.
  const existingDetails =
    (batch.errorDetails as Record<string, unknown> | null) ?? {};
  const existingChunksFailed = Array.isArray(existingDetails.chunksFailed)
    ? (existingDetails.chunksFailed as ChunkFailureEntry[])
    : [];
  const failedEntry: ChunkFailureEntry = {
    failedChunkIndex: job.chunkIndex,
    at: new Date().toISOString(),
    reason: "SQS DLQ",
  };
  const nextDetails: Record<string, unknown> = {
    ...existingDetails,
    chunksFailed: [...existingChunksFailed, failedEntry],
  };

  await db
    .update(batchSend)
    .set({ errorDetails: nextDetails })
    .where(
      and(
        eq(batchSend.id, batchId),
        eq(batchSend.organizationId, organizationId)
      )
    );

  await enqueueResumeJob({
    batchId,
    organizationId,
    awsAccountId: batch.awsAccountId,
    channel: batch.channel,
    chunkIndex: resumeChunkIndex,
    cursor: resumeCursor,
  });

  log.info("broadcast.dlq.chunk_failed", {
    batchId,
    organizationId,
    failedChunkIndex: job.chunkIndex,
    resumeChunkIndex,
    resumeFromCursor: Boolean(resumeCursor),
  });
}

async function enqueueResumeJob(job: BatchJob): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error("BATCH_QUEUE_URL not configured");
  }
  const sqsClient = new SQSClient(awsDefaults);
  const body: Record<string, unknown> = {
    batchId: job.batchId,
    organizationId: job.organizationId,
    awsAccountId: job.awsAccountId,
    channel: job.channel,
    chunkIndex: job.chunkIndex,
  };
  if (job.cursor !== undefined) {
    body.cursor = job.cursor;
  }
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(body),
    })
  );
}
