# Services — Workflow Orchestration Layer

This directory contains the business logic services for workflow execution, credential management, and queue processing.

## File Relationships

The workflow execution flow follows this chain:

1. **`workflow-events.ts`** — Entry point. Matches incoming events (contact created, email opened, etc.) to enabled workflows by `organizationId` + trigger type. Filters by contact scoping rules.
2. **`workflow-queue.ts`** — Enqueues matched workflows as SQS messages for async processing. Handles batch enqueueing for multiple contacts/workflows.
3. **`workflow-scheduler.ts`** — Creates and chains EventBridge one-time schedules for delay steps and cron-triggered workflows. Schedule names must fit 64 chars: `wraps-wf-{execId8}-{stepId8}`. Uses `croner` for timezone-aware cron evaluation.
4. **`credentials.ts`** — STS assume-role with caching. Used when CLI or platform needs to act on a user's AWS account.
5. **`queue.ts`** / **`scheduler.ts`** — Lower-level SQS and EventBridge utilities used by the workflow-specific services above.

## Key Patterns

### Definition Snapshots
At execution creation, `workflow-events.ts` freezes `definitionSnapshot` (steps + transitions + version) into JSONB. In-flight executions are immune to live dashboard edits. Access via `snapshot?.steps ?? wf.steps` fallback for pre-snapshot executions.

### Contact Scoping
Workflows match by `organizationId` first, then filter contacts by segment rules and reentry settings. The partial unique index on `(workflowId, contactId) WHERE status IN (active states)` enforces `allowReentry=false`.

### Event Deduplication
Idempotency keys on step execution inserts use `ON CONFLICT DO UPDATE` to prevent duplicate sends when SQS delivers the same message twice.

### Cron Schedule Chaining
One pending schedule per workflow at a time. After `schedule-trigger` fires, `createNextWorkflowSchedule()` chains the next occurrence. The DLQ consumer repairs broken chains.

## Rules

- Every DB query in these services MUST scope by `organizationId`.
- Every async operation MUST be awaited — Lambda terminates when the handler returns.
- Workflow event emission must happen AFTER the state change is persisted, not before.
- Use the structured logger at `apps/api/src/lib/logger.ts`, never `console.log`.
