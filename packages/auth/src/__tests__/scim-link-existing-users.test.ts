/**
 * SCIM `linkExistingUsers` policy tests.
 *
 * The plugin refuses every email match unless a policy opts in, which 409s
 * SCIM Create for most of an org's team on day one. The policy has to allow
 * that without letting one org's SCIM token claim another org's users, so the
 * cross-tenant refusals below are the point of this file — not edge cases.
 */

import { db, member, organization, ssoProvider, user } from "@wraps/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { shouldLinkScimUser } from "../index";

const PREFIX = "scim-link-test";

const orgWithSso = {
  id: `${PREFIX}-org-verified`,
  name: "SCIM Link Verified Org",
  slug: `${PREFIX}-org-verified`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const otherOrg = {
  id: `${PREFIX}-org-other`,
  name: "SCIM Link Other Org",
  slug: `${PREFIX}-org-other`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

function makeUser(suffix: string, email: string) {
  return {
    id: `${PREFIX}-user-${suffix}`,
    email,
    name: `SCIM Link User ${suffix}`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: null,
    twoFactorEnabled: false,
    stripeCustomerId: null,
  };
}

// Already a member of the SSO org.
const memberUser = makeUser("member", `${PREFIX}-member@example.com`);
// Not a member, but their address is at the org's verified domain.
const domainUser = makeUser("domain", `employee@${PREFIX}-verified.com`);
// Not a member, address at an unrelated domain — an outsider.
const outsiderUser = makeUser("outsider", `${PREFIX}-outsider@elsewhere.com`);

const verifiedProvider = {
  id: `${PREFIX}-sso-verified`,
  // Stored with the casing the admin typed, which the policy must tolerate.
  providerId: `${PREFIX}-Verified.com`,
  issuer: "https://example.okta.com",
  domain: `${PREFIX}-Verified.com`,
  organizationId: orgWithSso.id,
  domainVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const unverifiedProvider = {
  id: `${PREFIX}-sso-unverified`,
  providerId: `${PREFIX}-unverified.com`,
  issuer: "https://example.okta.com",
  domain: `${PREFIX}-unverified.com`,
  organizationId: otherOrg.id,
  domainVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const membership = {
  id: `${PREFIX}-member-row`,
  organizationId: orgWithSso.id,
  userId: memberUser.id,
  role: "member" as const,
  createdAt: new Date(),
};

beforeAll(async () => {
  for (const org of [orgWithSso, otherOrg]) {
    await db
      .insert(organization)
      .values(org)
      .onConflictDoUpdate({ target: organization.id, set: { name: org.name } });
  }
  for (const u of [memberUser, domainUser, outsiderUser]) {
    await db
      .insert(user)
      .values(u)
      .onConflictDoUpdate({ target: user.id, set: { updatedAt: new Date() } });
  }
  for (const p of [verifiedProvider, unverifiedProvider]) {
    await db
      .insert(ssoProvider)
      .values(p)
      .onConflictDoUpdate({
        target: ssoProvider.id,
        set: { domainVerified: p.domainVerified },
      });
  }
  await db
    .insert(member)
    .values(membership)
    .onConflictDoUpdate({ target: member.id, set: { role: membership.role } });
});

afterAll(async () => {
  await db.delete(member).where(eq(member.id, membership.id));
  for (const p of [verifiedProvider, unverifiedProvider]) {
    await db.delete(ssoProvider).where(eq(ssoProvider.id, p.id));
  }
  for (const u of [memberUser, domainUser, outsiderUser]) {
    await db.delete(user).where(eq(user.id, u.id));
  }
  for (const org of [orgWithSso, otherOrg]) {
    await db.delete(organization).where(eq(organization.id, org.id));
  }
});

describe("shouldLinkScimUser", () => {
  it("links a user who is already a member of the token's org", async () => {
    await expect(
      shouldLinkScimUser({
        user: memberUser,
        email: memberUser.email,
        provider: { organizationId: orgWithSso.id },
      })
    ).resolves.toBe(true);
  });

  it("links a non-member at a domain the org has verified", async () => {
    await expect(
      shouldLinkScimUser({
        user: domainUser,
        email: domainUser.email,
        provider: { organizationId: orgWithSso.id },
      })
    ).resolves.toBe(true);
  });

  it("matches the verified domain case-insensitively", async () => {
    await expect(
      shouldLinkScimUser({
        user: domainUser,
        email: `EMPLOYEE@${PREFIX}-VERIFIED.COM`,
        provider: { organizationId: orgWithSso.id },
      })
    ).resolves.toBe(true);
  });

  it("refuses an outsider's account at an unrelated domain", async () => {
    await expect(
      shouldLinkScimUser({
        user: outsiderUser,
        email: outsiderUser.email,
        provider: { organizationId: orgWithSso.id },
      })
    ).resolves.toBe(false);
  });

  it("refuses a user another org has verified the domain for", async () => {
    // otherOrg pushing an address at orgWithSso's domain must not link.
    await expect(
      shouldLinkScimUser({
        user: domainUser,
        email: domainUser.email,
        provider: { organizationId: otherOrg.id },
      })
    ).resolves.toBe(false);
  });

  it("refuses when the org's domain is not verified yet", async () => {
    await expect(
      shouldLinkScimUser({
        user: outsiderUser,
        email: `someone@${PREFIX}-unverified.com`,
        provider: { organizationId: otherOrg.id },
      })
    ).resolves.toBe(false);
  });

  it("refuses for a personal token with no organization", async () => {
    await expect(
      shouldLinkScimUser({
        user: memberUser,
        email: memberUser.email,
        provider: {},
      })
    ).resolves.toBe(false);
  });
});
