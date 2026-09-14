import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  scimConnectionBinding,
  scimGroup,
  scimGroupMember,
  scimIdentityTombstone,
  scimProjectionGrant,
  scimProvider,
  scimSubject,
  scimUser,
} from "../schema/scim-provider";

// Plan 221: better-auth's adapter resolves a SCIM model by looking up its
// model name as a key in the schema object handed to `drizzleAdapter` —
// there is no compile-time or runtime check that our exported Drizzle
// identifier matches better-auth's model name. A rename here (or a typo
// when these tables were first added) produces no type error and no
// migration error; it fails silently in plan 222 as a confusing adapter
// error at first SCIM request. This test pins the seven exported
// identifiers as string literals so any drift fails loudly, here, instead
// of downstream.
describe("SCIM 1.7 schema exports (plan 221)", () => {
  it("exports scimConnectionBinding mapped to scim_connection_binding", () => {
    expect(getTableName(scimConnectionBinding)).toBe("scim_connection_binding");
  });

  it("exports scimIdentityTombstone mapped to scim_identity_tombstone", () => {
    expect(getTableName(scimIdentityTombstone)).toBe("scim_identity_tombstone");
  });

  it("exports scimSubject mapped to scim_subject", () => {
    expect(getTableName(scimSubject)).toBe("scim_subject");
  });

  it("exports scimUser mapped to scim_user", () => {
    expect(getTableName(scimUser)).toBe("scim_user");
  });

  it("exports scimProjectionGrant mapped to scim_projection_grant", () => {
    expect(getTableName(scimProjectionGrant)).toBe("scim_projection_grant");
  });

  it("exports scimGroup mapped to scim_group", () => {
    expect(getTableName(scimGroup)).toBe("scim_group");
  });

  it("exports scimGroupMember mapped to scim_group_member", () => {
    expect(getTableName(scimGroupMember)).toBe("scim_group_member");
  });

  // Regression guard: plan 222 depends on this pre-existing table's
  // ownership changing, not disappearing or being renamed out from under it.
  it("leaves the pre-existing scimProvider mapped to scim_provider", () => {
    expect(getTableName(scimProvider)).toBe("scim_provider");
  });
});
