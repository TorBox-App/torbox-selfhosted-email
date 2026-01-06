# Drizzle Migrations Skill

You are an expert at creating and modifying database schemas with Drizzle ORM for PostgreSQL.

## Critical Rules

### 1. Schema File Organization

Schemas live in `packages/db/src/schema/` with one file per domain:
- `auth.ts` - Users, organizations, members
- `contacts.ts` - Contacts, topics, subscriptions
- `workflows.ts` - Workflows, executions, steps
- `templates.ts` - Email templates, versions
- `batch.ts` - Batch sends, messages

### 2. Table Definition Pattern

```typescript
import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const myTable = pgTable(
  "my_table",
  {
    // UUID primary key
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // ALWAYS include organizationId for multi-tenancy
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    // Typed enums
    status: text("status").$type<"active" | "inactive">().default("active"),

    // JSONB for flexible data
    config: jsonb("config").$type<MyConfigType>().default({}),

    // Audit fields (include on ALL mutable tables)
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Organization index (REQUIRED for multi-tenancy)
    orgIdx: index("my_table_org_idx").on(table.organizationId),

    // Composite indexes for common queries
    statusIdx: index("my_table_status_idx").on(table.organizationId, table.status),

    // Unique constraint with partial index
    uniqueSlug: uniqueIndex("my_table_unique_slug_idx")
      .on(table.organizationId, table.slug)
      .where(sql`slug IS NOT NULL`),
  })
);
```

### 3. Enum Pattern

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

// Define enum BEFORE table that uses it
export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "enabled",
  "paused",
  "archived",
]);

// Use in table
status: workflowStatusEnum("status").default("draft").notNull(),
```

### 4. Relations

```typescript
import { relations } from "drizzle-orm";

export const workflowRelations = relations(workflow, ({ one, many }) => ({
  organization: one(organization, {
    fields: [workflow.organizationId],
    references: [organization.id],
  }),
  executions: many(workflowExecution),
  createdByUser: one(user, {
    fields: [workflow.createdBy],
    references: [user.id],
    relationName: "createdWorkflows", // Required when multiple relations to same table
  }),
}));
```

### 5. Type Inference

```typescript
// Export inferred types
export type Workflow = typeof workflow.$inferSelect;
export type NewWorkflow = typeof workflow.$inferInsert;
```

## Migration Commands

```bash
# Generate migration from schema changes
pnpm --filter @wraps/db db:generate

# Push changes directly (dev only, no migration file)
pnpm --filter @wraps/db db:push

# Run migrations
pnpm --filter @wraps/db db:migrate

# Open Drizzle Studio
pnpm --filter @wraps/db db:studio
```

## Common Mistakes to Avoid

### 1. Missing Organization Scoping
```typescript
// BAD - No org reference
organizationId: text("organization_id"),

// GOOD - With cascade delete
organizationId: text("organization_id")
  .references(() => organization.id, { onDelete: "cascade" })
  .notNull(),
```

### 2. Missing Indexes
```typescript
// BAD - No index on organizationId
(table) => ({})

// GOOD - Always index organizationId
(table) => ({
  orgIdx: index("table_org_idx").on(table.organizationId),
})
```

### 3. Breaking Changes
```typescript
// BAD - Removing column or renaming (breaks existing data)
// name: text("name"),  // Removed!

// GOOD - Add new column with default, deprecate old one
newName: text("new_name").default(""),
// Keep old column for migration period
```

## Key Files

- Config: `packages/db/drizzle.config.ts`
- Schemas: `packages/db/src/schema/*.ts`
- Migrations: `packages/db/src/migrations/`
- Entry: `packages/db/src/index.ts`
