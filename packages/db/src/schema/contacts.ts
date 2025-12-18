import { relations } from "drizzle-orm";
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

// Contacts
export const contact = pgTable(
  "contact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    email: text("email").notNull(),
    emailHash: text("email_hash").notNull(), // SHA256 for deduplication

    status: text("status").default("active").notNull(),
    // pending_confirmation, active, unsubscribed, bounced, complained

    // Custom attributes
    properties: json("properties")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    // Engagement tracking
    lastActivityAt: timestamp("last_activity_at"),
    lastEmailSentAt: timestamp("last_email_sent_at"),
    lastEmailOpenedAt: timestamp("last_email_opened_at"),
    lastEmailClickedAt: timestamp("last_email_clicked_at"),

    // Stats
    emailsSent: integer("emails_sent").default(0).notNull(),
    emailsOpened: integer("emails_opened").default(0).notNull(),
    emailsClicked: integer("emails_clicked").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at"),
    unsubscribedAt: timestamp("unsubscribed_at"),
    bouncedAt: timestamp("bounced_at"),
    complainedAt: timestamp("complained_at"),

    // Audit
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => ({
    orgIdx: index("contact_org_idx").on(table.organizationId),
    emailIdx: index("contact_email_idx").on(table.email),
    uniqueOrgEmail: uniqueIndex("contact_unique_org_email_idx").on(
      table.organizationId,
      table.emailHash
    ),
    statusIdx: index("contact_status_idx").on(
      table.organizationId,
      table.status
    ),
  })
);

export type ContactStatus =
  | "pending_confirmation"
  | "active"
  | "unsubscribed"
  | "bounced"
  | "complained";

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

    // Cached stats
    subscriberCount: integer("subscriber_count").default(0).notNull(),

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

    status: text("status").default("subscribed").notNull(), // subscribed, unsubscribed
    subscribedAt: timestamp("subscribed_at").defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at"),
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
