/**
 * SCIM bearer verifier tests.
 *
 * `verifyScimBearerToken` is what establishes tenancy for every SCIM
 * request: it maps an incoming token to a `provisioningDomainId`, which
 * `resolveScimUser` later reads back as the organization to authorize
 * against. The cross-tenant case below is the one genuinely load-bearing
 * test in this file — a token that resolves to the wrong org would let one
 * customer's IdP provision into another customer's directory. Both org A and
 * org B have their own live `scim_provider` row and their own live token, so
 * a lookup that mixed rows up — returned the first row, or matched on
 * something other than the digest — fails this test.
 */

import { db, eq, organization, scimProvider } from "@wraps/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyScimBearerToken } from "../index";
import { hashScimToken, mintScimToken } from "../scim-token";

const PREFIX = "scim-verify-bearer-test";

const orgA = {
  id: `${PREFIX}-org-a`,
  name: "SCIM Verify Org A",
  slug: `${PREFIX}-org-a`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const orgB = {
  id: `${PREFIX}-org-b`,
  name: "SCIM Verify Org B",
  slug: `${PREFIX}-org-b`,
  createdAt: new Date(),
  logo: null,
  metadata: null,
};

const tokenForA = mintScimToken();
const tokenForB = mintScimToken();
const unusedToken = mintScimToken();

const providerRowA = {
  id: `${PREFIX}-provider-a`,
  providerId: `scim-${orgA.id}`,
  organizationId: orgA.id,
};

const providerRowB = {
  id: `${PREFIX}-provider-b`,
  providerId: `scim-${orgB.id}`,
  organizationId: orgB.id,
};

beforeAll(async () => {
  for (const org of [orgA, orgB]) {
    await db
      .insert(organization)
      .values(org)
      .onConflictDoUpdate({ target: organization.id, set: { name: org.name } });
  }
  const [hashedA, hashedB] = await Promise.all([
    hashScimToken(tokenForA),
    hashScimToken(tokenForB),
  ]);
  await db
    .insert(scimProvider)
    .values({ ...providerRowA, scimToken: hashedA })
    .onConflictDoUpdate({
      target: scimProvider.id,
      set: { scimToken: hashedA },
    });
  await db
    .insert(scimProvider)
    .values({ ...providerRowB, scimToken: hashedB })
    .onConflictDoUpdate({
      target: scimProvider.id,
      set: { scimToken: hashedB },
    });
});

afterAll(async () => {
  await db.delete(scimProvider).where(eq(scimProvider.id, providerRowA.id));
  await db.delete(scimProvider).where(eq(scimProvider.id, providerRowB.id));
  for (const org of [orgA, orgB]) {
    await db.delete(organization).where(eq(organization.id, org.id));
  }
});

describe("verifyScimBearerToken", () => {
  it("resolves a valid token to its own organization's provisioningDomainId", async () => {
    const result = await verifyScimBearerToken({ token: tokenForA });
    expect(result?.connection.provisioningDomainId).toBe(orgA.id);
  });

  it("returns null for an unknown token", async () => {
    await expect(
      verifyScimBearerToken({ token: unusedToken })
    ).resolves.toBeNull();
  });

  it("resolves each org's token to that org, never the other", async () => {
    const resultA = await verifyScimBearerToken({ token: tokenForA });
    const resultB = await verifyScimBearerToken({ token: tokenForB });

    expect(resultA?.connection.provisioningDomainId).toBe(orgA.id);
    expect(resultA?.connection.id).toBe(`scim-${orgA.id}`);

    expect(resultB?.connection.provisioningDomainId).toBe(orgB.id);
    expect(resultB?.connection.id).toBe(`scim-${orgB.id}`);

    expect(resultA?.connection.provisioningDomainId).not.toBe(orgB.id);
    expect(resultB?.connection.provisioningDomainId).not.toBe(orgA.id);
  });
});
