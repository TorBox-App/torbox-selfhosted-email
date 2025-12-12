import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * AI Usage Monthly Summary
 *
 * One row per organization per month for fast limit checks.
 * Uses upsert pattern: increment count on each request.
 *
 * The periodKey is formatted as "YYYY-MM" (e.g., "2025-01")
 * Combined with organizationId creates a unique constraint.
 */
export const aiUsageMonthly = pgTable(
  "ai_usage_monthly",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    // Period key formatted as "YYYY-MM" for easy querying
    periodKey: text("period_key").notNull(),

    // Count of AI messages used this period
    messageCount: integer("message_count").default(0).notNull(),

    // Track when limits were last checked/updated
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Fast lookup: org + period (most common query)
    uniqueIndex("ai_usage_monthly_org_period_idx").on(
      table.organizationId,
      table.periodKey
    ),
    // For admin: find all orgs in a period
    index("ai_usage_monthly_period_idx").on(table.periodKey),
  ]
);

/**
 * AI Usage Log
 *
 * Individual request logs for detailed analytics and admin panel.
 * Stores each AI request with metadata for auditing and analysis.
 */
export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    // Period key for efficient filtering (denormalized from createdAt)
    periodKey: text("period_key").notNull(),

    // Request metadata
    featureType: text("feature_type").notNull().default("ai_chat"), // ai_chat, ai_edit, etc.
    templateId: text("template_id"), // Optional reference to template

    // Token tracking (if available from AI provider)
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),

    // Model info
    model: text("model"),

    // Request timing
    durationMs: integer("duration_ms"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // For org-level analytics
    index("ai_usage_log_org_idx").on(table.organizationId),
    // For period-based reporting
    index("ai_usage_log_period_idx").on(table.periodKey),
    // For org + period queries (admin panel)
    index("ai_usage_log_org_period_idx").on(
      table.organizationId,
      table.periodKey
    ),
    // For user-level analytics
    index("ai_usage_log_user_idx").on(table.userId),
    // For time-based queries
    index("ai_usage_log_created_idx").on(table.createdAt),
  ]
);

// Relations
export const aiUsageMonthlyRelations = relations(aiUsageMonthly, ({ one }) => ({
  organization: one(organization, {
    fields: [aiUsageMonthly.organizationId],
    references: [organization.id],
  }),
}));

export const aiUsageLogRelations = relations(aiUsageLog, ({ one }) => ({
  organization: one(organization, {
    fields: [aiUsageLog.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [aiUsageLog.userId],
    references: [user.id],
  }),
}));
