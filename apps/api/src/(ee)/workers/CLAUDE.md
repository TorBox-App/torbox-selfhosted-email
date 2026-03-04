# Workers — Workflow Step Execution

This directory contains the SQS/EventBridge Lambda handlers that execute workflow steps.

## File Relationships

- **`workflow-processor.ts`** — Main SQS handler. Receives enqueued workflow jobs, executes the current step, routes to the next step via transitions. This is the hot path.
- **`workflow-step-handlers.ts`** — Step type implementations (send-email, send-sms, delay, condition, webhook, wait-for-event). Each handler returns a result that the processor uses to determine the next transition.
- **`workflow-dlq-consumer.ts`** — Dead letter queue handler. Processes messages that failed 3 SQS retries. Marks executions as failed and repairs broken cron schedule chains.
- **`workflow-stats.ts`** — Reconciliation worker. Detects counter drift between execution records and cached stats, optionally repairs.
- **`workflow-utils.ts`** — Shared utilities for execution state management, transition routing, and snapshot access.

## Execution State Machine

```
pending → active → completed
                 → failed
         active → paused (delay step)
                → waiting (wait-for-event step)
         paused → active (schedule fires)
        waiting → active (webhook received OR timeout fires)
                → failed (timeout with no webhook)
```

## Critical Rules

### DLQ Consumer: MUST NEVER THROW
The DLQ consumer is the last-resort handler. If it throws, messages go to a DLQ-of-DLQ (which doesn't exist), meaning permanent message loss. Wrap every operation in try/catch, log errors, but always return success.

### Idempotency
Step execution inserts use `ON CONFLICT DO UPDATE` with idempotency keys. SQS can deliver the same message multiple times — the processor must handle this gracefully without duplicate sends.

### Wait State Claims
When a wait-for-event step pauses execution, both a webhook handler and a timeout schedule race to resume it. Use atomic `UPDATE ... SET status='active' WHERE status='waiting'` — only one wins. The loser sees 0 rows affected and exits cleanly.

### Definition Snapshots
Always access workflow steps via `snapshot?.steps ?? wf.steps` to handle both snapshot-era and pre-snapshot executions. Never read live workflow definitions for in-flight executions.

### Lambda Async Safety
Every async operation MUST be awaited. Lambda freezes the execution context when the handler returns — unawaited promises get silently killed. This is the #1 source of production bugs.

## Step Handler Architecture

Each step type in `workflow-step-handlers.ts` exports a handler function with signature:
```typescript
(execution, step, context) => Promise<StepResult>
```

`StepResult` determines the next transition:
- `{ status: 'completed', output }` → follow the default/success transition
- `{ status: 'failed', error }` → follow the error transition or fail the execution
- `{ status: 'paused', resumeAt }` → create EventBridge schedule, pause execution
- `{ status: 'waiting', timeoutAt }` → create timeout schedule, wait for webhook
