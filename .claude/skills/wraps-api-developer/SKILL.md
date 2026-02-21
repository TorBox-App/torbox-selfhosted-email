---
name: wraps-api-developer
description: Build API routes for Wraps platform on AWS Lambda with Elysia.js. Use when creating or editing API endpoints in apps/api.
---

# Wraps API Developer Skill

You are an expert at building API routes for the Wraps platform, which runs on AWS Lambda via Elysia.js.

## Critical Lambda/Serverless Rules

### ALWAYS AWAIT ASYNC OPERATIONS

**Lambda terminates when the handler returns.** Any fire-and-forget promises will be killed.

```typescript
// BAD - Lambda will terminate before this completes
emitWorkflowEvent({ ... }).catch(console.error);
checkSegmentEntry({ ... }).catch(console.error);

// GOOD - Await ensures completion before response
await emitWorkflowEvent({ ... }).catch(console.error);
await checkSegmentEntry({ ... }).catch(console.error);

// GOOD - Parallel awaits for multiple operations
await Promise.all([
  emitWorkflowEvent({ ... }),
  checkSegmentEntry({ ... }),
]).catch(console.error);
```

### Common Fire-and-Forget Patterns to Avoid

```typescript
// BAD - These will be killed when Lambda terminates
someAsyncFunction().catch(err => console.error(err));
someAsyncFunction().then(handleResult);
for (const item of items) {
  processItem(item).catch(console.error);  // Not awaited!
}

// GOOD - Properly awaited
await someAsyncFunction().catch(err => console.error(err));
const result = await someAsyncFunction();
await Promise.all(items.map(item =>
  processItem(item).catch(console.error)
));
```

## Wraps API Architecture

### Tech Stack
- **Framework**: Elysia.js
- **Database**: Drizzle ORM with PostgreSQL
- **Runtime**: AWS Lambda (via serverless)
- **Auth**: API keys and session-based auth

### Project Structure
```
apps/api/src/
├── routes/                    # API route handlers
│   ├── batch.ts               # Batch email/SMS sending
│   ├── connections.ts         # AWS account connections
│   ├── contacts.ts            # Contact CRUD + workflow triggers
│   ├── events.ts              # Custom event emission
│   ├── health.ts              # Health check
│   ├── preference-events.ts   # Email preference events
│   ├── templates-sync.ts      # Template sync from CLI
│   ├── tools.ts               # AI tools
│   ├── unsubscribe.ts         # Unsubscribe handling
│   ├── webhooks.ts            # Webhook delivery (SSRF-validated)
│   ├── workflow-schedules.ts  # Cron-triggered workflows
│   └── workflows-sync.ts     # Workflow sync from CLI
├── services/         # Business logic
│   ├── workflow-events.ts  # Workflow trigger helpers
│   └── ...
├── middleware/       # Auth, logging, etc.
└── index.ts          # App entry point
```

### Standard Route Pattern

```typescript
import { t } from "elysia";
import { createAuthenticatedRoutes } from "../middleware/auth";
import { db, someTable, eq, and } from "@wraps/db";
import { log } from "../lib/logger";

export const myRoutes = createAuthenticatedRoutes("/v1/my-resource")
  .get(
    "/",
    async (ctx) => {
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;

      const items = await db
        .select()
        .from(someTable)
        .where(eq(someTable.organizationId, authContext.organizationId));

      return { items };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
      }),
      detail: {
        tags: ["my-resource"],
        summary: "List items",
        description: "Lists all items for the organization",
      },
    }
  )
  .post(
    "/",
    async (ctx) => {
      const { body } = ctx;
      const authContext = (ctx as unknown as { auth: AuthContext }).auth;

      // Validate
      if (!body.name) {
        ctx.set.status = 400;
        return { error: "Name is required" };
      }

      // Create
      const [created] = await db
        .insert(someTable)
        .values({
          organizationId: authContext.organizationId,
          name: body.name,
        })
        .returning();

      // IMPORTANT: Await any workflow/event emissions
      await emitSomeEvent({
        resourceId: created.id,
        organizationId: authContext.organizationId,
      }).catch((err) => {
        log.error("[my-resource] Failed to emit event", err);
      });

      ctx.set.status = 201;
      return { id: created.id, name: created.name };
    },
    {
      body: t.Object({
        name: t.String(),
      }),
      detail: {
        tags: ["my-resource"],
        summary: "Create item",
        description: "Creates a new item",
      },
    }
  );
```

## Workflow Event Emissions

### Available Event Emitters

```typescript
import {
  emitContactCreated,
  emitContactUpdated,
  emitTopicSubscribed,
  emitTopicUnsubscribed,
  emitWorkflowEvent,
  checkSegmentEntry,
} from "../services/workflow-events";
```

### When to Emit Events

| Action | Event to Emit |
|--------|---------------|
| Contact created | `emitContactCreated` + `checkSegmentEntry` + `emitTopicSubscribed` (if topics) |
| Contact updated | `emitContactUpdated` + `checkSegmentEntry` |
| Topic subscribed | `emitTopicSubscribed` |
| Topic unsubscribed | `emitTopicUnsubscribed` |
| Custom event | `emitWorkflowEvent` |

### Event Emission Pattern

```typescript
// Single event - await it
await emitContactCreated({
  contactId: newContact.id,
  organizationId: authContext.organizationId,
  contactData: { ... },
}).catch((err) => {
  log.error("[contacts] Failed to emit contact_created", err);
});

// Multiple events - await all in parallel
await Promise.all([
  emitContactCreated({ ... }),
  checkSegmentEntry({ ... }),
]).catch((err) => {
  log.error("[contacts] Failed to emit events", err);
});

// Multiple items - map and await all
await Promise.all(
  topicIds.map((topicId) =>
    emitTopicSubscribed({
      contactId: params.id,
      organizationId: authContext.organizationId,
      topicId,
      topicName: topicMap.get(topicId),
    }).catch((err) => {
      log.error("[contacts] Failed to emit topic_subscribed", err);
    })
  )
);
```

## Database Patterns

### Drizzle Query Patterns

```typescript
import { db, contact, eq, and, or, inArray, desc, sql } from "@wraps/db";

// Select with conditions
const contacts = await db
  .select()
  .from(contact)
  .where(
    and(
      eq(contact.organizationId, orgId),
      eq(contact.emailStatus, "active")
    )
  )
  .orderBy(desc(contact.createdAt))
  .limit(50);

// Insert with returning
const [newContact] = await db
  .insert(contact)
  .values({ ... })
  .returning();

// Update with returning
const [updated] = await db
  .update(contact)
  .set({ name: "New Name", updatedAt: new Date() })
  .where(eq(contact.id, contactId))
  .returning();

// Delete
await db
  .delete(contact)
  .where(eq(contact.id, contactId));

// JSONB queries
const workflows = await db
  .select()
  .from(workflow)
  .where(
    sql`${workflow.triggerConfig}->>'topicId' = ${topicId}`
  );
```

## Error Handling

### Standard Error Responses

```typescript
// 400 Bad Request - Invalid input
ctx.set.status = 400;
return { error: "Email or phone is required" };

// 404 Not Found
ctx.set.status = 404;
return { error: "Contact not found" };

// 409 Conflict - Duplicate
ctx.set.status = 409;
return { error: "Contact with this email already exists" };

// 500 Internal Server Error (avoid exposing details)
ctx.set.status = 500;
return { error: "Failed to process request" };
```

### Logging Errors

```typescript
import { log } from "../lib/logger";

// Log with context for debugging
log.error("[contacts] Failed to create contact", err, {
  email: body.email,
  organizationId: authContext.organizationId,
});
```

## REST Semantics

### HTTP Methods

| Method | Purpose | Idempotent | Example |
|--------|---------|------------|---------|
| GET | Read resource(s) | Yes | List contacts, get contact |
| POST | Create resource | No | Create contact |
| PATCH | Partial update | Yes | Update contact fields (ADD topics) |
| PUT | Full replace | Yes | Replace all topics |
| DELETE | Remove resource | Yes | Delete contact |

### PATCH vs PUT for Sub-resources

```typescript
// PATCH /contacts/:id - Adds topics (doesn't remove existing)
// Use for: Adding topics, updating fields
body: { topicSlugs: ["new-topic"] }  // Adds to existing

// PUT /contacts/:id/topics - Replaces all topics
// Use for: Setting exact topic list
body: { topicSlugs: ["only-these-topics"] }  // Replaces all
```

## Testing Checklist

Before deploying API changes, verify:

1. [ ] All async operations are awaited (no fire-and-forget)
2. [ ] Workflow events emit correctly
3. [ ] Error responses use correct status codes
4. [ ] Auth context is properly accessed
5. [ ] Database queries use organization scoping
6. [ ] Input validation is present
7. [ ] TypeScript types are correct (`pnpm --filter @wraps/api typecheck`)

## Common Mistakes

### 1. Fire-and-Forget Promises
```typescript
// BAD
emitEvent().catch(console.error);

// GOOD
await emitEvent().catch(console.error);
```

### 2. Missing Organization Scoping
```typescript
// BAD - No org check, could access other orgs' data
const contact = await db.select().from(contact).where(eq(contact.id, id));

// GOOD - Always scope by organization
const contact = await db.select().from(contact).where(
  and(
    eq(contact.id, id),
    eq(contact.organizationId, authContext.organizationId)
  )
);
```

### 3. Not Awaiting Multiple Operations
```typescript
// BAD - Loop doesn't await
for (const id of ids) {
  processItem(id).catch(console.error);
}

// GOOD - Await all
await Promise.all(ids.map(id => processItem(id).catch(console.error)));
```

### 4. Wrong PATCH Semantics
```typescript
// BAD - PATCH replacing all data (this is PUT behavior)
await db.delete(topics).where(eq(topics.contactId, id));
await db.insert(topics).values(newTopics);

// GOOD - PATCH adds/updates without removing existing
const existing = await db.select().from(topics).where(...);
const newOnly = topicIds.filter(id => !existing.has(id));
await db.insert(topics).values(newOnly);
```

## Security & Reliability Patterns

### Webhook SSRF Validation
All outbound webhook URLs must be validated against SSRF attacks before calling:
```typescript
// BAD - calling user-provided URL without validation
await fetch(webhookUrl, { method: "POST", body: payload });

// GOOD - validate URL first (blocks internal IPs, localhost, metadata endpoints)
import { validateWebhookUrl } from "../services/webhook-validation";
validateWebhookUrl(webhookUrl); // throws on invalid
await fetch(webhookUrl, { method: "POST", body: payload });
```

### Workflow Snapshot Protection
When executing workflows, snapshot the definition at execution start. Never read the live workflow definition during execution — it may change mid-flight.

### DLQ Consumers
All SQS queues must have dead letter queues with consumers. Failed messages must be logged and optionally retried.

## Quick Reference

```typescript
// Auth context
const authContext = (ctx as unknown as { auth: AuthContext }).auth;
const { organizationId, userId } = authContext;

// Set status code
ctx.set.status = 201;

// Return error
ctx.set.status = 400;
return { error: "Message" };

// Await events
await emitEvent({ ... }).catch((err) => log.error("Failed to emit event", err));

// Parallel awaits
await Promise.all([...promises]);
```
