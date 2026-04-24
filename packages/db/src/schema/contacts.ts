import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { template } from "./templates";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type EmailStatus =
  | "active"
  | "unsubscribed"
  | "bounced"
  | "complained"
  | "suppressed";
export type SmsStatus =
  | "pending_consent"
  | "opted_in"
  | "opted_out"
  | "invalid";
export type PreferredChannel = "email" | "sms";

/**
 * @deprecated Use EmailStatus instead. Kept for backwards compatibility.
 */
export type ContactStatus =
  | "pending_confirmation"
  | "active"
  | "unsubscribed"
  | "bounced"
  | "complained"
  | "suppressed";

// ═══════════════════════════════════════════════════════════════════════════
// CONTACTS TABLE
// ═══════════════════════════════════════════════════════════════════════════

export const contact = pgTable(
  "contact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // EMAIL CHANNEL
    // ═══════════════════════════════════════════════════════════════════════
    email: text("email"), // Now optional (contact can have email OR phone)
    emailHash: text("email_hash"), // SHA256 for deduplication
    emailStatus: text("email_status").$type<EmailStatus>(),

    // Email timestamps
    emailVerifiedAt: timestamp("email_verified_at"),
    emailUnsubscribedAt: timestamp("email_unsubscribed_at"),
    emailBouncedAt: timestamp("email_bounced_at"),
    emailComplainedAt: timestamp("email_complained_at"),
    emailSuppressedAt: timestamp("email_suppressed_at"),

    // Email engagement
    lastEmailSentAt: timestamp("last_email_sent_at"),
    lastEmailOpenedAt: timestamp("last_email_opened_at"),
    lastEmailClickedAt: timestamp("last_email_clicked_at"),
    emailsSent: integer("emails_sent").default(0).notNull(),
    emailsOpened: integer("emails_opened").default(0).notNull(),
    emailsClicked: integer("emails_clicked").default(0).notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // SMS CHANNEL
    // ═══════════════════════════════════════════════════════════════════════
    phone: text("phone"), // E.164 format: +15551234567
    phoneHash: text("phone_hash"), // SHA256 for deduplication
    smsStatus: text("sms_status").$type<SmsStatus>(),

    // SMS timestamps
    smsConsentedAt: timestamp("sms_consented_at"),
    smsOptedOutAt: timestamp("sms_opted_out_at"),
    smsInvalidAt: timestamp("sms_invalid_at"),

    // SMS engagement
    lastSmsSentAt: timestamp("last_sms_sent_at"),
    lastSmsClickedAt: timestamp("last_sms_clicked_at"),
    smsSent: integer("sms_sent").default(0).notNull(),
    smsClicked: integer("sms_clicked").default(0).notNull(),

    // ═══════════════════════════════════════════════════════════════════════
    // SHARED FIELDS
    // ═══════════════════════════════════════════════════════════════════════

    // Contact profile (first-class fields for common attributes)
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    jobTitle: text("job_title"),
    preferredChannel: text("preferred_channel").$type<PreferredChannel>(),

    // Custom attributes (for additional/custom fields)
    properties: json("properties")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    // External reference (caller-supplied stable identifier)
    externalId: text("external_id"),

    // Engagement tracking
    lastActivityAt: timestamp("last_activity_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // Audit
    createdBy: text("created_by").references(() => user.id),

    // ═══════════════════════════════════════════════════════════════════════
    // DEPRECATED FIELDS (kept for backwards compatibility)
    // ═══════════════════════════════════════════════════════════════════════
    /** @deprecated Use emailStatus instead */
    status: text("status").default("active").notNull(),
    /** @deprecated Use emailVerifiedAt instead */
    confirmedAt: timestamp("confirmed_at"),
    /** @deprecated Use emailUnsubscribedAt instead */
    unsubscribedAt: timestamp("unsubscribed_at"),
    /** @deprecated Use emailBouncedAt instead */
    bouncedAt: timestamp("bounced_at"),
    /** @deprecated Use emailComplainedAt instead */
    complainedAt: timestamp("complained_at"),
  },
  (table) => ({
    // Organization index
    orgIdx: index("contact_org_idx").on(table.organizationId),

    // Email indexes
    emailIdx: index("contact_email_idx").on(table.email),
    uniqueOrgEmail: uniqueIndex("contact_unique_org_email_idx")
      .on(table.organizationId, table.emailHash)
      .where(sql`email_hash IS NOT NULL`),
    emailStatusIdx: index("contact_email_status_idx").on(
      table.organizationId,
      table.emailStatus
    ),

    // Phone/SMS indexes
    phoneIdx: index("contact_phone_idx").on(table.phone),
    uniqueOrgPhone: uniqueIndex("contact_unique_org_phone_idx")
      .on(table.organizationId, table.phoneHash)
      .where(sql`phone_hash IS NOT NULL`),
    smsStatusIdx: index("contact_sms_status_idx").on(
      table.organizationId,
      table.smsStatus
    ),

    // External ID index (unique per org, sparse)
    uniqueOrgExternalId: uniqueIndex("contact_unique_org_external_id_idx")
      .on(table.organizationId, table.externalId)
      .where(sql`external_id IS NOT NULL`),

    // Legacy status index (deprecated)
    statusIdx: index("contact_status_idx").on(
      table.organizationId,
      table.status
    ),
  })
);

// Topics (Subscription Lists)
export const topic = pgTable(
  "topic",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),

    public: boolean("public").default(true).notNull(), // Visible in preference center
    doubleOptIn: boolean("double_opt_in").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // Audit
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => ({
    orgIdx: index("topic_org_idx").on(table.organizationId),
    uniqueOrgSlug: uniqueIndex("topic_unique_org_slug_idx").on(
      table.organizationId,
      table.slug
    ),
  })
);

// Topic Settings (organization-level configuration)
export const topicSettings = pgTable("topic_settings", {
  organizationId: text("organization_id")
    .references(() => organization.id, { onDelete: "cascade" })
    .primaryKey(),

  // Double Opt-In Email Settings
  confirmationFromName: text("confirmation_from_name"), // e.g., "Acme Inc"
  confirmationFromEmail: text("confirmation_from_email"), // e.g., "noreply@acme.com"
  confirmationReplyToEmail: text("confirmation_reply_to_email"), // optional reply-to
  confirmationTemplateId: text("confirmation_template_id").references(
    () => template.id,
    { onDelete: "set null" }
  ), // Optional custom email template for confirmation emails

  // Preference Center Settings
  preferenceCenterTitle: text("preference_center_title"),
  preferenceCenterDescription: text("preference_center_description"),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contact-Topic relationship (subscriptions)
export const contactTopic = pgTable(
  "contact_topic",
  {
    contactId: text("contact_id")
      .references(() => contact.id, { onDelete: "cascade" })
      .notNull(),
    topicId: text("topic_id")
      .references(() => topic.id, { onDelete: "cascade" })
      .notNull(),

    status: text("status").default("subscribed").notNull(), // pending, subscribed, unsubscribed
    subscribedAt: timestamp("subscribed_at").defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at"),
    confirmedAt: timestamp("confirmed_at"), // When double opt-in was confirmed
  },
  (table) => ({
    pk: primaryKey({ columns: [table.contactId, table.topicId] }),
    topicIdx: index("contact_topic_topic_idx").on(table.topicId),
    statusIdx: index("contact_topic_status_idx").on(
      table.topicId,
      table.status
    ),
  })
);

// Relations
export const contactRelations = relations(contact, ({ one, many }) => ({
  organization: one(organization, {
    fields: [contact.organizationId],
    references: [organization.id],
  }),
  createdByUser: one(user, {
    fields: [contact.createdBy],
    references: [user.id],
  }),
  topics: many(contactTopic),
}));

export const topicRelations = relations(topic, ({ one, many }) => ({
  organization: one(organization, {
    fields: [topic.organizationId],
    references: [organization.id],
  }),
  createdByUser: one(user, {
    fields: [topic.createdBy],
    references: [user.id],
  }),
  subscribers: many(contactTopic),
}));

export const contactTopicRelations = relations(contactTopic, ({ one }) => ({
  contact: one(contact, {
    fields: [contactTopic.contactId],
    references: [contact.id],
  }),
  topic: one(topic, {
    fields: [contactTopic.topicId],
    references: [topic.id],
  }),
}));

export const topicSettingsRelations = relations(topicSettings, ({ one }) => ({
  organization: one(organization, {
    fields: [topicSettings.organizationId],
    references: [organization.id],
  }),
  confirmationTemplate: one(template, {
    fields: [topicSettings.confirmationTemplateId],
    references: [template.id],
  }),
}));
