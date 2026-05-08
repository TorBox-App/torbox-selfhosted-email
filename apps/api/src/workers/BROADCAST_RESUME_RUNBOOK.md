# Broadcast Resume Runbook

Operator guide for the broadcast failure-recovery system: the DLQ consumer,
in-handler self-reschedule, and manual resume endpoint. Everything in this
doc assumes the three-step deploy has completed (Drizzle migrations 0052 +
0053, the `create-broadcast-resume-indexes.ts` script, then the code).

## Log names to watch

Emitted by the batch worker and the DLQ consumer.

| Log name                                       | Source               | Meaning                                                              |
| ---------------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `broadcast.self_reschedule`                    | `batch-sender.ts`    | Worker re-enqueued the same chunk because remaining Lambda time < 45s |
| `broadcast.self_reschedule.suspected_loop`     | `batch-sender.ts`    | Same chunk hit the guard on >2 receives — worker proceeds anyway     |
| `broadcast.dlq.chunk_failed`                   | `batch-dlq-consumer` | DLQ consumer re-enqueued the next chunk from `batch.lastChunkIndex`  |
| `broadcast.dlq.batch_missing`                  | `batch-dlq-consumer` | DLQ message referenced a batch row that doesn't exist for the org    |
| `broadcast.dlq.terminal_status`                | `batch-dlq-consumer` | DLQ message for a batch that's already completed / cancelled / failed |
| `broadcast.dlq.aws_account_missing`            | `batch-dlq-consumer` | Batch had `awsAccountId = null` — operator must reconnect            |
| `broadcast.dlq.already_complete`               | `batch-dlq-consumer` | Batch had `processedRecipients >= totalRecipients`                   |
| `broadcast.dlq.disabled`                       | `batch-dlq-consumer` | Kill switch enabled — no records processed                           |
| `broadcast.dlq.bad_body`                       | `batch-dlq-consumer` | Malformed DLQ message body (parse failure)                           |
| `broadcast.dlq.record_failed`                  | `batch-dlq-consumer` | Per-record exception — logged and skipped, never thrown              |
| `broadcast.resumed`                            | `routes/batch.ts`    | Operator hit `POST /v1/batch/:id/resume`                             |

## Expected rates

- **Steady state**: all `broadcast.dlq.*` logs should be rare (< a handful
  per day in aggregate). Any sustained rate is a signal something upstream
  is failing — start with Axiom `level=error service=wraps-api` and the
  `BatchDlqAlarm` / `BatchQueueAgeAlarm` CloudWatch alarms.
- `broadcast.self_reschedule` should be occasional (cold-start invocations
  that land with <45s remaining). A spike means chunks are taking too long
  — check SES throttling or dedup SELECT latency.
- `broadcast.self_reschedule.suspected_loop` should be essentially never.
  If you see it, a chunk is genuinely unable to complete in a Lambda
  lifetime. Inspect the `batchSend.errorDetails.chunksFailed` history.

## Inspecting a failed or stalled batch

```sql
SELECT
  id,
  status,
  processed_recipients,
  total_recipients,
  last_chunk_at,
  last_chunk_index,
  last_cursor,
  error_message,
  error_details
FROM batch_send
WHERE id = '<batchId>'
  AND organization_id = '<orgId>';
```

Fields to read:

- `last_chunk_at` — heartbeat. If it's stale relative to `updated_at`, the
  worker isn't making progress.
- `last_chunk_index` — the highest chunk that completed. Resume starts at
  `last_chunk_index + 1` with `last_cursor` (or at 0 if NULL).
- `error_details.chunksFailed` — every chunk that landed in the DLQ (with
  timestamp and reason).
- `error_details.resumes` — every manual resume call (resumedAt, resumedBy,
  fromChunkIndex).

## Manual recovery

### Standard resume (trust the heartbeat)

```bash
curl -X POST https://api.wraps.dev/v1/batch/<batchId>/resume \
  -H "Authorization: Bearer <api-key-or-session-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Worker picks up at `last_chunk_index + 1` with `last_cursor`. Appends a
`resumes` entry to `error_details`.

### Operator override (distrust the heartbeat)

```bash
curl -X POST https://api.wraps.dev/v1/batch/<batchId>/resume \
  -H "Authorization: Bearer <api-key-or-session-token>" \
  -H "Content-Type: application/json" \
  -d '{"fromChunkIndex": 5}'
```

Overrides the heartbeat — cursor is set to `undefined` so the worker will
keyset-scan from the start for that chunk. Use only when you believe the
heartbeat is wrong (rare; almost never needed in practice).

### Response codes

| Code | Meaning                                                                              |
| ---- | ------------------------------------------------------------------------------------ |
| 200  | Resumed — re-enqueued `{fromChunkIndex, cursor}` onto batchQueue                     |
| 404  | Batch ID not found in caller's org                                                   |
| 409  | Not resumable: status not in `{processing, failed}`, channel != email, or aws = null |
| 503  | Kill switch active (`BROADCAST_RESUME_ENABLED=false`)                                |

## Kill switches

Both toggles are environment variables on the relevant Lambda. No redeploy
needed — flip the var via the SST dashboard / AWS console and the Lambda
picks it up on cold start.

| Variable                           | Target                             | Effect                                             |
| ---------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `BROADCAST_DLQ_CONSUMER_ENABLED`   | `batchDlq.subscribe` Lambda        | `false` → consumer returns early; no DB or SQS activity |
| `BROADCAST_RESUME_ENABLED`         | API Lambda                          | `false` → `POST /v1/batch/:id/resume` returns 503  |

When to disable:

- `BROADCAST_DLQ_CONSUMER_ENABLED=false`: if the DLQ consumer is itself
  misbehaving (e.g. a bug in the resume-point computation is causing
  duplicate re-enqueues). Messages remain on the DLQ for up to 14 days so
  you can re-enable after the fix.
- `BROADCAST_RESUME_ENABLED=false`: if a support team member is resuming
  batches that shouldn't be resumed (e.g. a misconfigured cron is calling
  the endpoint). Turn it off, fix the caller, turn it back on.

## Smoke testing the pipeline

An opt-in integration test drives a real multi-chunk broadcast end-to-end
against SST dev infra + SES's mailbox simulator. Lives at
`apps/api/src/__tests__/broadcast-smoke.integration.test.ts`. It's skipped
by default so `pnpm test:integration` stays green without operator setup.

To run it:

```bash
# Terminal 1 — SST dev brings up the real batch-sender Lambda
pnpm sst:dev

# Terminal 2 — opt in, point at a connected aws_account row + verified
# SES sender. Simulator recipients bypass sandbox, but the SENDER still
# needs to be a verified identity.
RUN_BROADCAST_SMOKE=1 \
BROADCAST_SMOKE_AWS_ACCOUNT_ID=<aws_account row id> \
BROADCAST_SMOKE_SENDER=<verified@identity.com> \
  pnpm --filter @wraps/api test:integration -- \
    src/__tests__/broadcast-smoke.integration.test.ts
```

What it does: seeds 2000 contacts (default — override with
`BROADCAST_SMOKE_CONTACT_COUNT`) with plus-addressed
`*@simulator.amazonses.com` recipients, inserts a `batch_send` row, sends
`chunkIndex=0` to the real SQS batch queue, and polls until the batch row
reports `status=completed`. Asserts that `processedRecipients` equals the
seeded count and `lastChunkIndex` progressed to the final chunk. Cleans up
the seeded contacts + batch row afterward.

To exercise the DLQ + auto-resume path, temporarily throw in `processJob`
for one specific `chunkIndex` — after 3 SQS retries the message lands on
`batchDlq`, the consumer re-enqueues the next chunk, and the smoke test
still completes (the heartbeat + DLQ replay do their job). Revert the
throw when done.

## Known residual risks

- **SES duplicates for pre-insert crashes.** If a worker invocation dies
  after `SendBulkEmail` succeeds but before `messageSend` inserts land, a
  subsequent retry will re-send to the same recipients. The
  `message_send_dedup_idx` unique index prevents duplicate DB rows, but
  SES has already delivered. This is documented in the research phase as
  an accepted risk. Mitigation (future): insert `messageSend` as `pending`
  BEFORE the SES call, update after.
- **Bounced contacts replayed via DLQ.** Same mechanism. The worker's
  dedup SELECT skips contacts already marked `sent|delivered|bounced|
  complained|suppressed` but can't skip contacts whose status was never
  recorded.
- **Self-reschedule loop guard ceiling.** After 2 redeliveries while still
  under the remaining-time floor, the worker falls through and attempts
  the chunk anyway. Worst case, that chunk lands in the DLQ and the DLQ
  consumer re-enqueues the NEXT chunk — not a loop, but the current chunk
  is dropped.
