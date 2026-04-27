import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const scimProvider = pgTable(
  "scim_provider",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    providerId: text("provider_id").notNull(),
    scimToken: text("scim_token").notNull(),
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("scim_provider_org_idx").on(table.organizationId)]
);

export const scimProviderRelations = relations(scimProvider, ({ one }) => ({
  organization: one(organization, {
    fields: [scimProvider.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [scimProvider.userId],
    references: [user.id],
  }),
}));

export type ScimProvider = typeof scimProvider.$inferSelect;
export type NewScimProvider = typeof scimProvider.$inferInsert;
