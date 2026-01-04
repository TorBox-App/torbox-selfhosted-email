import { relations } from "drizzle-orm";
import { index, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { contact } from "./contacts";

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT EVENTS TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stores events associated with contacts.
 *
 * Events can be:
 * - Internal: contact_created, contact_updated, email_opened, etc.
 * - Custom: user.signup, order.completed, form.submitted, etc.
 *
 * Used for:
 * - Workflow event triggers
 * - Segment filter operators (triggered, triggeredWithin, notTriggered)
 * - Activity timeline
 */
export const contactEvent = pgTable(
  "contact_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contactId: text("contact_id")
      .references(() => contact.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),

    // Event identification
    eventName: text("event_name").notNull(),

    // Optional event data/properties
    eventData: json("event_data").$type<Record<string, unknown>>(),

    // Timestamp
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Index for finding events by contact
    contactIdx: index("contact_event_contact_idx").on(table.contactId),

    // Index for finding events by org + event name (for cleanup/analytics)
    orgEventIdx: index("contact_event_org_event_idx").on(
      table.organizationId,
      table.eventName
    ),

    // Index for finding events by contact + event name (for segment evaluation)
    contactEventIdx: index("contact_event_contact_event_idx").on(
      table.contactId,
      table.eventName
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const contactEventRelations = relations(contactEvent, ({ one }) => ({
  contact: one(contact, {
    fields: [contactEvent.contactId],
    references: [contact.id],
  }),
  organization: one(organization, {
    fields: [contactEvent.organizationId],
    references: [organization.id],
  }),
}));
