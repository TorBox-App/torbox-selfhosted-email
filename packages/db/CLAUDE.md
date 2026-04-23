# Wraps Database (packages/db)

Drizzle ORM with Neon PostgreSQL (serverless). Multi-tenant — every table is scoped by `organizationId`.

## Critical Rules

### 1. Every Table MUST Have organizationId

```typescript
organizationId: text("organization_id")
  .references(() => organization.id, { onDelete: "cascade" })
  .notNull(),
```

- Always `onDelete: "cascade"` — data must not persist without its org
- Always add an org index (see below)

### 2. Every Table MUST Have an Organization Index

```typescript
export const myTable = pgTable("my_table", { ... }, (table) => [
  index("my_table_org_idx").on(table.organizationId),
]);
```

### 3. Unique Constraints MUST Be Scoped to Organization

```typescript
// BAD - globally unique
uniqueIndex("slug_idx").on(table.slug)

// GOOD - unique per org
uniqueIndex("my_table_unique_org_slug_idx").on(table.organizationId, table.slug)
```

## Schema Conventions

### Column Naming
- TypeScript: `camelCase` (e.g., `organizationId`, `createdAt`)
- Database: `snake_case` (e.g., `organization_id`, `created_at`)

```typescript
organizationId: text("organization_id")  // camelCase field, snake_case DB column
```

### Table Naming
- Database: `snake_case`, singular (e.g., `contact`, `template`, `workflow`)

### ID Columns
```typescript
id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
```

### Timestamps
```typescript
createdAt: timestamp("created_at").defaultNow().notNull(),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
```

### Audit Fields
```typescript
createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
```
Use `set null` for user FKs — don't delete content if the user is deleted.

### Enums
```typescript
export const templateStatusEnum = pgEnum("template_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
```
- Enum name: `snake_case` in DB
- Values: `UPPERCASE`

### JSONB Columns
```typescript
content: jsonb("content").$type<Record<string, unknown>>().notNull(),
properties: json("properties").$type<Record<string, unknown>>().default({}).notNull(),
```
- Always provide `.$type<T>()` for TypeScript inference
- Always provide `.default({})` for object types

### Index Naming
```
{tableName}_{descriptor}_idx
```
Examples: `contact_org_idx`, `contact_unique_org_email_idx`, `workflow_org_status_idx`

## Type Inference

```typescript
// Select type (reading)
export type Template = typeof template.$inferSelect;

// Insert type (writing)
export type NewTemplate = typeof template.$inferInsert;
```

Always export at the end of the schema file, after relations.

## Relations

Define separately from the table:

```typescript
export const contactRelations = relations(contact, ({ one, many }) => ({
  organization: one(organization, {
    fields: [contact.organizationId],
    references: [organization.id],
  }),
  events: many(event),
}));
```

When the same table is referenced twice, use `relationName`:
```typescript
createdByUser: one(user, {
  fields: [template.createdBy],
  references: [user.id],
  relationName: "templateCreatedBy",
}),
```

## Schema Files

| File | Tables |
|------|--------|
| `app.ts` | Organizations, memberships, AWS accounts |
| `auth.ts` | Auth tables (managed by better-auth) |
| `batch.ts` | Email batch tracking |
| `contacts.ts` | Contact management (email + SMS channels in same table) |
| `events.ts` | Email/SMS delivery events |
| `segments.ts` | Audience segments |
| `templates.ts` | Email and SMS templates |
| `usage.ts` | Usage tracking |
| `workflows.ts` | Workflow definitions and executions |
| `waitlist.ts` | Waitlist entries |

## Key Patterns

### Partial Unique Indexes
For deduplication on sparse data:
```typescript
uniqueIndex("contact_unique_org_email_idx")
  .on(table.organizationId, table.emailHash)
  .where(sql`email_hash IS NOT NULL`)
```

### Conditional Indexes
For reentry prevention:
```typescript
uniqueIndex("workflow_execution_no_reentry_idx")
  .on(table.workflowId, table.contactId)
  .where(sql`${table.status} IN ('pending', 'active', 'paused', 'waiting') AND ${table.allowReentry} = false`)
```

### Channel Architecture
Email and SMS are channels on the same `contact` table — not separate tables:
- `email`, `emailHash`, `emailStatus`, `emailVerifiedAt`, `emailUnsubscribedAt`
- `phoneNumber`, `phoneHash`, `smsStatus`, `smsOptedInAt`, `smsOptedOutAt`

## DB Connection

Exported from `src/index.ts`:
```typescript
import { db } from "@wraps/db";
import { contact, template } from "@wraps/db/schema";
import { eq, and, desc } from "@wraps/db";  // Re-exported drizzle operators
```

Connection uses `@neondatabase/serverless` with `poolQueryViaFetch = true` (serverless-optimized).

## ⚠️ Production vs Dev Database

Two separate Neon databases exist:
- **`apps/web/.env.local`** → DEV (`ep-autumn-block-*`) — test data only
- **`apps/web/.env.production.local`** → PRODUCTION (`ep-damp-heart-*`) — real customer data

To connect to **production**:

```bash
# Export the production DATABASE_URL
eval "$(scripts/db-prod-url.sh)"

# Confirm you're on prod (endpoint should contain ep-damp-heart)
echo $DATABASE_URL | grep -o 'ep-[^-]*-[^.]*'

# Then query with psql
psql "$DATABASE_URL"
```

**When asked to analyze data or run queries, always use the production database unless explicitly told to use dev.**

## Migration Workflow

```bash
pnpm --filter @wraps/db db:generate   # Generate migration from schema changes
pnpm --filter @wraps/db db:push       # Push schema directly (dev)
pnpm --filter @wraps/db db:migrate    # Run migrations (production)
pnpm --filter @wraps/db db:studio     # Open Drizzle Studio GUI
```

### CONCURRENT Indexes (out-of-band)

drizzle-kit wraps every migration in a transaction, which rejects
`CREATE INDEX CONCURRENTLY`. For large tables where a blocking index build
is unacceptable, the pattern is:

1. **Declare the index in `schema/*.ts` as the source of truth.** Drizzle's
   snapshot will then list it as existing.
2. **Strip the `CREATE INDEX` statements** from the generated migration SQL
   file (leave a `-- NOTE:` pointer to the script instead).
3. **Create the index out-of-band** via a one-off TypeScript script under
   `packages/db/scripts/` that uses `@neondatabase/serverless` directly
   (no drizzle-kit involvement), with `CREATE INDEX CONCURRENTLY IF NOT
   EXISTS`. Run manually after the drizzle migration:
   `DATABASE_URL=... pnpm tsx packages/db/scripts/<name>.ts`.
4. **Document the deploy order** in the PR description — e.g., "Run
   `db:migrate` first, then the script, then ship the code that relies
   on the index."

Reference: `packages/db/scripts/create-broadcast-resume-indexes.ts`.

Config in `drizzle.config.ts` reads env from `apps/web/.env.local`.
