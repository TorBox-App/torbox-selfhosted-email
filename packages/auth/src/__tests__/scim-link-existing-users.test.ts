/**
 * SCIM `resolveUser` identity-resolution tests.
 *
 * better-auth 1.7 hands `resolveUser` an incoming SCIM resource and no
 * candidate user — the plugin used to do the email lookup itself. This file
 * targets `resolveScimUser`, which does that lookup and then defers to
 * `shouldLinkScimUser`'s unchanged policy for the create/link/refuse
 * decision. The cross-tenant refusals below are the point of this file, not
 * edge cases: letting one org's SCIM token claim another org's users is
 * exactly what `shouldLinkScimUser` exists to prevent.
 *
 * A refusal here must surface as a thrown `APIError` (status CONFLICT / 409),
 * never a bare `{action:"create"}` — the email is already taken, so an
 * insert would collide on `user.email`.
 */

import { db, member, organization, ssoProvider, user } from "@wraps/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveScimUser } from "../index";

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
// Not a member, address at otherOrg's domain — but that domain isn't verified.
const unverifiedDomainUser = makeUser(
  "unverified-domain",
  `someone@${PREFIX}-unverified.com`
);

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

/**
 * A minimal but fully-typed SCIM User resource, as `resolveUser` receives
 * it. `resolveScimUser` only reads `primaryEmail`; the rest is populated
 * because `SCIMCanonicalUser` requires them.
 */
function scimResource(email: string) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"] as const,
    userName: email,
    primaryEmail: email,
    displayName: email,
    name: { formatted: email },
    emails: [{ value: email, primary: true }],
    active: true,
  };
}

async function expectConflict(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    status: "CONFLICT",
    body: { scimType: "uniqueness" },
  });
}

beforeAll(async () => {
  for (const org of [orgWithSso, otherOrg]) {
    await db
      .insert(organization)
      .values(org)
      .onConflictDoUpdate({ target: organization.id, set: { name: org.name } });
  }
  for (const u of [
    memberUser,
    domainUser,
    outsiderUser,
    unverifiedDomainUser,
  ]) {
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
  for (const u of [
    memberUser,
    domainUser,
    outsiderUser,
    unverifiedDomainUser,
  ]) {
    await db.delete(user).where(eq(user.id, u.id));
  }
  for (const org of [orgWithSso, otherOrg]) {
    await db.delete(organization).where(eq(organization.id, org.id));
  }
});

describe("resolveScimUser", () => {
  it("links a user who is already a member of the token's org", async () => {
    await expect(
      resolveScimUser({
        provisioningDomainId: orgWithSso.id,
        resource: scimResource(memberUser.email),
      })
    ).resolves.toEqual({
      action: "link",
      userId: memberUser.id,
      profile: "manage",
    });
  });

  it("links a non-member at a domain the org has verified", async () => {
    await expect(
      resolveScimUser({
        provisioningDomainId: orgWithSso.id,
        resource: scimResource(domainUser.email),
      })
    ).resolves.toEqual({
      action: "link",
      userId: domainUser.id,
      profile: "manage",
    });
  });

  it("matches the verified domain case-insensitively", async () => {
    await expect(
      resolveScimUser({
        provisioningDomainId: orgWithSso.id,
        resource: scimResource(`EMPLOYEE@${PREFIX}-VERIFIED.COM`),
      })
    ).resolves.toEqual({
      action: "link",
      userId: domainUser.id,
      profile: "manage",
    });
  });

  it("refuses an outsider's account at an unrelated domain", async () => {
    await expectConflict(
      resolveScimUser({
        provisioningDomainId: orgWithSso.id,
        resource: scimResource(outsiderUser.email),
      })
    );
  });

  it("refuses a user another org has verified the domain for", async () => {
    // otherOrg pushing an address at orgWithSso's domain must not link.
    await expectConflict(
      resolveScimUser({
        provisioningDomainId: otherOrg.id,
        resource: scimResource(domainUser.email),
      })
    );
  });

  it("refuses when the org's domain is not verified yet", async () => {
    await expectConflict(
      resolveScimUser({
        provisioningDomainId: otherOrg.id,
        resource: scimResource(unverifiedDomainUser.email),
      })
    );
  });

  it("refuses for a personal token with no organization", async () => {
    // No verifier in this plugin config ever resolves an empty
    // provisioningDomainId, but resolveScimUser's guard must still hold if
    // one ever did — a personal token has no tenant to authorize against.
    await expectConflict(
      resolveScimUser({
        provisioningDomainId: "",
        resource: scimResource(memberUser.email),
      })
    );
  });

  it("creates a new user when no existing account matches the email", async () => {
    await expect(
      resolveScimUser({
        provisioningDomainId: orgWithSso.id,
        resource: scimResource(`${PREFIX}-brand-new@example.com`),
      })
    ).resolves.toEqual({ action: "create" });
  });
});
