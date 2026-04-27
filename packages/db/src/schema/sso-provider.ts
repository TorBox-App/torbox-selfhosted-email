import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const ssoProvider = pgTable(
  "sso_provider",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    providerId: text("provider_id").unique().notNull(),
    issuer: text("issuer").notNull(),
    domain: text("domain").notNull(),
    oidcConfig: text("oidc_config"),
    samlConfig: text("saml_config"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    organizationId: text("organization_id")
      .references(() => organization.id, { onDelete: "cascade" })
      .notNull(),
    domainVerified: boolean("domain_verified").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("sso_provider_org_idx").on(table.organizationId)]
);

export const ssoProviderRelations = relations(ssoProvider, ({ one }) => ({
  organization: one(organization, {
    fields: [ssoProvider.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [ssoProvider.userId],
    references: [user.id],
  }),
}));

export type SsoProvider = typeof ssoProvider.$inferSelect;
export type NewSsoProvider = typeof ssoProvider.$inferInsert;
