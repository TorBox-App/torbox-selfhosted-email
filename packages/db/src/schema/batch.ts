import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { awsAccount } from "./app";
import { organization, user } from "./auth";
import { contact } from "./contacts";
import { template } from "./templates";
import { workflowExecution } from "./workflows";

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Channel type - forward-compatible with SMS (Phase 3)
 */
export type Channel = "email" | "sms";

/**
 * Batch send status
 */
export const batchSendStatusEnum = pgEnum("batch_send_status", [
  "draft",
  "scheduled", // Waiting for scheduled time (EventBridge Scheduler)
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

/**
 * Message send status
 */
export const messageSendStatusEnum = pgEnum("message_send_status", [
  "pending",
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "suppressed", // SES suppression list
  "failed",
  "opted_out", // SMS specific
]);

/**
 * Message source type
 */
export const messageSourceTypeEnum = pgEnum("message_source_type", [
  "transactional",
  "batch",
  "campaign",
  "workflow",
]);

// ═══════════════════════════════════════════════════════════════════════════
// BATCH SEND TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Batch Send
 *
 * Tracks batch email/SMS jobs. Starter tier can send to ALL contacts.
 * Campaign targeting (segments, topics) is Pro+ feature.
 */
export const batchSend = pgTable(
  "batch_send",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    awsAccountId: text("aws_account_id").references(() => awsAccount.id, {
      onDelete: "set null",
    }),

    name: text("name"),

    // ═══════════════════════════════════════════════════════════════════════
    // CHANNEL SELECTION (explicit, forward-compatible with SMS)
    // ═══════════════════════════════════════════════════════════════════════
    channel: text("channel").$type<Channel>().default("email").notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // EMAIL-SPECIFIC FIELDS (Phase 1)
    // ═══════════════════════════════════════════════════════════════════════
    subject: text("subject"),
    previewText: text("preview_text"),
    from: text("from"),
    fromName: text("from_name"),
    replyTo: text("reply_to"),
    emailTemplateId: text("email_template_id").references(() => template.id, {
      onDelete: "set null",
    }),
    htmlContent: text("html_content"),
    textContent: text("text_content"),

    // Variable mappings for custom template variables
    variableMappings:
      json("variable_mappings").$type<
        Array<{
          variableName: string;
          source:
            | { type: "static"; value: string }
            | { type: "contact"; field: string };
        }>
      >(),

    // ═══════════════════════════════════════════════════════════════════════
    // SMS-SPECIFIC FIELDS (Phase 3 - nullable for now)
    // ═══════════════════════════════════════════════════════════════════════
    body: text("body"), // SMS body text
    senderId: text("sender_id"), // Phone number or alphanumeric sender ID
    // smsTemplateId will be added in Phase 3 when smsTemplate table exists

    // ═══════════════════════════════════════════════════════════════════════
    // RECIPIENT TARGETING
    // ═══════════════════════════════════════════════════════════════════════
    audienceType: text("audience_type")
      .$type<"all" | "topic" | "segment">()
      .default("all"),
    topicId: text("topic_id"), // For topic-based targeting
    segmentId: text("segment_id"), // For segment-based targeting

    // ═══════════════════════════════════════════════════════════════════════
    // STATUS & PROGRESS
    // ═══════════════════════════════════════════════════════════════════════
    status: batchSendStatusEnum("status").default("draft").notNull(),

    totalRecipients: integer("total_recipients").default(0).notNull(),
    processedRecipients: integer("processed_recipients").default(0).notNull(),
    sent: integer("sent").default(0).notNull(),
    delivered: integer("delivered").default(0).notNull(),
    failed: integer("failed").default(0).notNull(),

    // Email-specific stats (Phase 1)
    opened: integer("opened").default(0).notNull(),
    clicked: integer("clicked").default(0).notNull(),
    bounced: integer("bounced").default(0).notNull(),
    complained: integer("complained").default(0).notNull(),
    suppressed: integer("suppressed").default(0).notNull(),

    // SMS-specific stats (Phase 3)
    smsSegments: integer("sms_segments").default(0).notNull(), // Total SMS segments
    smsOptedOut: integer("sms_opted_out").default(0).notNull(),

    // Error tracking
    errorMessage: text("error_message"),
    errorDetails: json("error_details").$type<Record<string, unknown>>(),

    // ═══════════════════════════════════════════════════════════════════════
    // RESUME / HEARTBEAT POINTER
    // Written by the worker after each successful chunk. Read by the DLQ
    // consumer and the manual resume endpoint to find where to pick up.
    // ═══════════════════════════════════════════════════════════════════════
    lastChunkAt: timestamp("last_chunk_at"),
    lastChunkIndex: integer("last_chunk_index"),
    lastCursor: json("last_cursor").$type<{ id: string } | null>(),

    // ═══════════════════════════════════════════════════════════════════════
    // TIMING
    // ═══════════════════════════════════════════════════════════════════════
    scheduledFor: timestamp("scheduled_for"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    // ═══════════════════════════════════════════════════════════════════════
    // AUDIT
    // ═══════════════════════════════════════════════════════════════════════
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("batch_send_org_idx").on(table.organizationId),
    index("batch_send_channel_idx").on(table.channel),
    index("batch_send_status_idx").on(table.organizationId, table.status),
    index("batch_send_created_at_idx").on(
      table.organizationId,
      table.createdAt
    ),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE SEND TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Message Send
 *
 * Unified table for tracking individual email/SMS sends.
 * Records every message sent through the platform for analytics and history.
 */
export const messageSend = pgTable(
  "message_send",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    contactId: text("contact_id").references(() => contact.id, {
      onDelete: "set null",
    }),

    awsAccountId: text("aws_account_id")
      .references(() => awsAccount.id, { onDelete: "set null" })
      .notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // CHANNEL
    // ═══════════════════════════════════════════════════════════════════════
    channel: text("channel").$type<Channel>().default("email").notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // SOURCE TRACKING
    // ═══════════════════════════════════════════════════════════════════════
    sourceType: messageSourceTypeEnum("source_type").notNull(),
    batchSendId: text("batch_send_id").references(() => batchSend.id, {
      onDelete: "set null",
    }),
    // campaignId and workflowId will be added when those features are implemented
    // campaignId: text("campaign_id").references(() => campaign.id),
    // workflowId: text("workflow_id").references(() => workflow.id),
    workflowExecutionId: text("workflow_execution_id").references(
      () => workflowExecution.id,
      { onDelete: "set null" }
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // RECIPIENT (denormalized for history)
    // ═══════════════════════════════════════════════════════════════════════
    recipient: text("recipient").notNull(), // Email address or phone number

    // ═══════════════════════════════════════════════════════════════════════
    // EMAIL-SPECIFIC FIELDS
    // ═══════════════════════════════════════════════════════════════════════
    subject: text("subject"),
    from: text("from"),
    fromName: text("from_name"),
    emailTemplateId: text("email_template_id").references(() => template.id, {
      onDelete: "set null",
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // SMS-SPECIFIC FIELDS (Phase 3)
    // ═══════════════════════════════════════════════════════════════════════
    body: text("body"), // SMS body or inline email body
    senderId: text("sender_id"),
    // smsTemplateId will be added in Phase 3
    smsSegmentCount: integer("sms_segment_count"), // Number of SMS segments

    // ═══════════════════════════════════════════════════════════════════════
    // VARIABLES (template merge fields)
    // ═══════════════════════════════════════════════════════════════════════
    variables: json("variables").$type<Record<string, unknown>>().default({}),

    // ═══════════════════════════════════════════════════════════════════════
    // AWS CORRELATION
    // ═══════════════════════════════════════════════════════════════════════
    messageId: text("message_id"), // SES Message ID or EUM Message ID

    // ═══════════════════════════════════════════════════════════════════════
    // STATUS
    // ═══════════════════════════════════════════════════════════════════════
    status: messageSendStatusEnum("status").default("pending").notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // TIMESTAMPS
    // ═══════════════════════════════════════════════════════════════════════
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    // Email-specific
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),
    bouncedAt: timestamp("bounced_at"),
    complainedAt: timestamp("complained_at"),
    suppressedAt: timestamp("suppressed_at"),
    // SMS-specific
    optedOutAt: timestamp("opted_out_at"),

    // ═══════════════════════════════════════════════════════════════════════
    // ENGAGEMENT METADATA (from SES event callbacks)
    // ═══════════════════════════════════════════════════════════════════════
    openUserAgent: text("open_user_agent"),
    openIpAddress: text("open_ip_address"),
    clickUserAgent: text("click_user_agent"),
    clickIpAddress: text("click_ip_address"),

    // ═══════════════════════════════════════════════════════════════════════
    // ERROR TRACKING
    // ═══════════════════════════════════════════════════════════════════════
    error: text("error"),
    bounceType: text("bounce_type"), // Email: Permanent, Transient
    bounceSubType: text("bounce_sub_type"), // Email: detailed bounce reason
    clickedUrl: text("clicked_url"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_send_org_idx").on(table.organizationId),
    index("message_send_contact_idx").on(table.contactId),
    index("message_send_channel_idx").on(table.channel),
    index("message_send_batch_idx").on(table.batchSendId),
    index("message_send_workflow_execution_idx").on(table.workflowExecutionId),
    index("message_send_status_idx").on(table.batchSendId, table.status),
    uniqueIndex("message_send_message_id_idx").on(table.messageId),
    index("message_send_source_type_idx").on(table.sourceType),
    index("message_send_created_at_idx").on(table.createdAt),
    // Composite index for email log pagination queries (org-scoped, sorted by createdAt)
    // Created in production via packages/db/scripts/create-email-log-index.ts
    // (CONCURRENTLY) — schema declared here as source of truth.
    index("message_send_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    // Dedup guard for SQS retries and DLQ replays. Partial on contactId because
    // transactional sends (workflows, cold emails) have no contactId.
    // Created in production via packages/db/scripts/create-broadcast-resume-indexes.ts
    // (CONCURRENTLY) — schema declared here as source of truth.
    uniqueIndex("message_send_dedup_idx")
      .on(table.batchSendId, table.contactId)
      .where(sql`contact_id IS NOT NULL`),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const batchSendRelations = relations(batchSend, ({ one, many }) => ({
  organization: one(organization, {
    fields: [batchSend.organizationId],
    references: [organization.id],
  }),
  awsAccount: one(awsAccount, {
    fields: [batchSend.awsAccountId],
    references: [awsAccount.id],
  }),
  emailTemplate: one(template, {
    fields: [batchSend.emailTemplateId],
    references: [template.id],
  }),
  createdByUser: one(user, {
    fields: [batchSend.createdBy],
    references: [user.id],
  }),
  messageSends: many(messageSend),
}));

export const messageSendRelations = relations(messageSend, ({ one }) => ({
  organization: one(organization, {
    fields: [messageSend.organizationId],
    references: [organization.id],
  }),
  contact: one(contact, {
    fields: [messageSend.contactId],
    references: [contact.id],
  }),
  awsAccount: one(awsAccount, {
    fields: [messageSend.awsAccountId],
    references: [awsAccount.id],
  }),
  batchSend: one(batchSend, {
    fields: [messageSend.batchSendId],
    references: [batchSend.id],
  }),
  workflowExecution: one(workflowExecution, {
    fields: [messageSend.workflowExecutionId],
    references: [workflowExecution.id],
  }),
  emailTemplate: one(template, {
    fields: [messageSend.emailTemplateId],
    references: [template.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type BatchSend = typeof batchSend.$inferSelect;
export type NewBatchSend = typeof batchSend.$inferInsert;
export type BatchSendStatus = BatchSend["status"];

export type MessageSend = typeof messageSend.$inferSelect;
export type NewMessageSend = typeof messageSend.$inferInsert;
export type MessageSendStatus = MessageSend["status"];
export type MessageSourceType = MessageSend["sourceType"];
