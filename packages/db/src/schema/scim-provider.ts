import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
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

// --- better-auth 1.7 SCIM plugin tables (plan 221) ---
//
// These seven tables mirror the model declarations in
// `@better-auth/scim@1.7.1`'s `schema:` block exactly (field names, types,
// and constraints). They are unused until plan 222 upgrades `better-auth`
// and wires the plugin's `scim()` config to them — `better-auth` itself
// stays pinned at 1.6.23 in this plan. The exported identifiers below MUST
// match better-auth's model names verbatim (e.g. `scimUser`, not
// `scimUsers`): the adapter resolves a model by looking up its name as a
// key in the merged schema object, and a mismatched name fails silently at
// runtime rather than at compile time. See
// `packages/db/src/__tests__/scim-schema.test.ts` for the guard.
//
// The three `scimManaged*` tables from the same plugin (managed-connection
// catalog) are intentionally out of scope — this migration adopts the
// application-owned verifier instead.

export const scimConnectionBinding = pgTable(
  "scim_connection_binding",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id").notNull(),
    connectionKey: text("connection_key").notNull().unique(),
    provisioningDomainId: text("provisioning_domain_id").notNull(),
    createdAt: timestamp("created_at").notNull(),
    decommissionedAt: timestamp("decommissioned_at"),
    decommissionStatus: text("decommission_status").notNull().default("active"),
    decommissionCursorUserId: text("decommission_cursor_user_id"),
    decommissionReconciledUserCount: integer(
      "decommission_reconciled_user_count"
    )
      .notNull()
      .default(0),
    decommissionBatchCount: integer("decommission_batch_count")
      .notNull()
      .default(0),
    decommissionRevision: integer("decommission_revision").notNull().default(0),
    decommissionCompletedAt: timestamp("decommission_completed_at"),
    decommissionLeaseId: text("decommission_lease_id"),
    decommissionLeaseExpiresAt: timestamp("decommission_lease_expires_at"),
  },
  (table) => [
    index("scim_connection_binding_connection_id_idx").on(table.connectionId),
  ]
);

export type ScimConnectionBinding = typeof scimConnectionBinding.$inferSelect;
export type NewScimConnectionBinding =
  typeof scimConnectionBinding.$inferInsert;

export const scimIdentityTombstone = pgTable(
  "scim_identity_tombstone",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id").notNull(),
    provisioningDomainId: text("provisioning_domain_id").notNull(),
    externalId: text("external_id").notNull(),
    externalIdKey: text("external_id_key").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    profile: text("profile").notNull(),
    deletedAt: timestamp("deleted_at").notNull(),
  },
  (table) => [
    index("scim_identity_tombstone_connection_id_idx").on(table.connectionId),
    index("scim_identity_tombstone_provisioning_domain_id_idx").on(
      table.provisioningDomainId
    ),
    index("scim_identity_tombstone_user_id_idx").on(table.userId),
  ]
);

export const scimIdentityTombstoneRelations = relations(
  scimIdentityTombstone,
  ({ one }) => ({
    user: one(user, {
      fields: [scimIdentityTombstone.userId],
      references: [user.id],
    }),
  })
);

export type ScimIdentityTombstone = typeof scimIdentityTombstone.$inferSelect;
export type NewScimIdentityTombstone =
  typeof scimIdentityTombstone.$inferInsert;

export const scimSubject = pgTable(
  "scim_subject",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    profileSourceId: text("profile_source_id"),
    revision: integer("revision").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("scim_subject_profile_source_id_idx").on(table.profileSourceId),
  ]
);

export const scimSubjectRelations = relations(scimSubject, ({ one }) => ({
  user: one(user, {
    fields: [scimSubject.userId],
    references: [user.id],
  }),
}));

export type ScimSubject = typeof scimSubject.$inferSelect;
export type NewScimSubject = typeof scimSubject.$inferInsert;

export const scimUser = pgTable(
  "scim_user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id").notNull(),
    provisioningDomainId: text("provisioning_domain_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectionUserKey: text("connection_user_key").notNull().unique(),
    userName: text("user_name").notNull(),
    userNameKey: text("user_name_key").notNull().unique(),
    primaryEmail: text("primary_email").notNull(),
    workEmailValueIndex: text("work_email_value_index").notNull(),
    emailValueIndex: text("email_value_index").notNull(),
    displayName: text("display_name").notNull(),
    formattedName: text("formatted_name").notNull(),
    givenName: text("given_name"),
    familyName: text("family_name"),
    serializedEmails: text("serialized_emails").notNull(),
    serializedAttributes: text("serialized_attributes"),
    externalId: text("external_id"),
    externalIdKey: text("external_id_key").unique(),
    active: boolean("active").notNull(),
    orderKey: text("order_key").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("scim_user_connection_id_idx").on(table.connectionId),
    index("scim_user_provisioning_domain_id_idx").on(
      table.provisioningDomainId
    ),
    index("scim_user_user_id_idx").on(table.userId),
  ]
);

export const scimUserRelations = relations(scimUser, ({ one }) => ({
  user: one(user, {
    fields: [scimUser.userId],
    references: [user.id],
  }),
}));

export type ScimUser = typeof scimUser.$inferSelect;
export type NewScimUser = typeof scimUser.$inferInsert;

export const scimProjectionGrant = pgTable(
  "scim_projection_grant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id").notNull(),
    provisioningDomainId: text("provisioning_domain_id").notNull(),
    scimUserId: text("scim_user_id")
      .notNull()
      .references(() => scimUser.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceKind: text("source_kind").notNull(),
    sourceId: text("source_id").notNull(),
    sourceValue: text("source_value"),
    role: text("role").notNull(),
    grantKey: text("grant_key").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("scim_projection_grant_connection_id_idx").on(table.connectionId),
    index("scim_projection_grant_provisioning_domain_id_idx").on(
      table.provisioningDomainId
    ),
    index("scim_projection_grant_scim_user_id_idx").on(table.scimUserId),
    index("scim_projection_grant_user_id_idx").on(table.userId),
  ]
);

export const scimProjectionGrantRelations = relations(
  scimProjectionGrant,
  ({ one }) => ({
    user: one(user, {
      fields: [scimProjectionGrant.userId],
      references: [user.id],
    }),
  })
);

export type ScimProjectionGrant = typeof scimProjectionGrant.$inferSelect;
export type NewScimProjectionGrant = typeof scimProjectionGrant.$inferInsert;

export const scimGroup = pgTable(
  "scim_group",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id").notNull(),
    provisioningDomainId: text("provisioning_domain_id").notNull(),
    revision: integer("revision").notNull().default(0),
    displayName: text("display_name").notNull(),
    displayNameKey: text("display_name_key").notNull().unique(),
    externalId: text("external_id"),
    externalIdKey: text("external_id_key").unique(),
    orderKey: text("order_key").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("scim_group_connection_id_idx").on(table.connectionId),
    index("scim_group_provisioning_domain_id_idx").on(
      table.provisioningDomainId
    ),
  ]
);

export type ScimGroup = typeof scimGroup.$inferSelect;
export type NewScimGroup = typeof scimGroup.$inferInsert;

export const scimGroupMember = pgTable(
  "scim_group_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id").notNull(),
    groupId: text("group_id")
      .notNull()
      .references(() => scimGroup.id, { onDelete: "cascade" }),
    scimUserId: text("scim_user_id")
      .notNull()
      .references(() => scimUser.id, { onDelete: "cascade" }),
    membershipKey: text("membership_key").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("scim_group_member_connection_id_idx").on(table.connectionId),
    index("scim_group_member_group_id_idx").on(table.groupId),
    index("scim_group_member_scim_user_id_idx").on(table.scimUserId),
  ]
);

export type ScimGroupMember = typeof scimGroupMember.$inferSelect;
export type NewScimGroupMember = typeof scimGroupMember.$inferInsert;
