import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Waitlist table for collecting email signups for upcoming products
 * (SMS, Queue, etc.)
 */
export const waitlist = pgTable(
  "waitlist",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Email (normalized to lowercase)
    email: text("email").notNull(),
    emailHash: text("email_hash").notNull(), // SHA-256 hash for deduplication

    // Product interest (sms, queue, etc.)
    product: text("product").notNull(),

    // Source tracking
    source: text("source"), // "website", "landing-page", etc.
    referrer: text("referrer"), // Where they came from

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Ensure one signup per email per product
    uniqueIndex("waitlist_email_product_idx").on(
      table.emailHash,
      table.product
    ),
    // Query by product
    index("waitlist_product_idx").on(table.product),
    // Query by date
    index("waitlist_created_at_idx").on(table.createdAt),
  ]
);

export type Waitlist = typeof waitlist.$inferSelect;
export type NewWaitlist = typeof waitlist.$inferInsert;
