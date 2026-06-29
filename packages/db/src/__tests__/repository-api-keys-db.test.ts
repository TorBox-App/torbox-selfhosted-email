import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  deleteApiKeyForOrg,
  findApiKeyByHash,
  findApiKeyForOrg,
  listApiKeysForOrg,
  updateApiKeyForOrg,
} from "../repositories/api-keys";
import { apiKey, organization } from "../schema";

const suffix = crypto.randomUUID().slice(0, 8);

const orgA = `repo-apikey-org-a-${suffix}`;
const orgB = `repo-apikey-org-b-${suffix}`;

const keyA = {
  id: `repo-apikey-key-a-${suffix}`,
  organizationId: orgA,
  name: "Key A",
  keyHash: `repo-apikey-hash-a-${suffix}`,
  prefix: "wraps_live_aaaa1111...",
  permissions: ["email:send"],
  createdAt: new Date("2026-01-01"),
};

const keyB = {
  id: `repo-apikey-key-b-${suffix}`,
  organizationId: orgB,
  name: "Key B",
  keyHash: `repo-apikey-hash-b-${suffix}`,
  prefix: "wraps_live_bbbb2222...",
  permissions: ["email:send", "contacts:read"],
  createdAt: new Date("2026-01-02"),
};

describe("Repository: api-keys", () => {
  beforeAll(async () => {
    await db
      .insert(organization)
      .values([
        {
          id: orgA,
          name: "API Key Repo Test Org A",
          slug: `apikey-repo-a-${suffix}`,
          createdAt: new Date(),
        },
        {
          id: orgB,
          name: "API Key Repo Test Org B",
          slug: `apikey-repo-b-${suffix}`,
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    await db.insert(apiKey).values([keyA, keyB]).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(apiKey).where(eq(apiKey.organizationId, orgA));
    await db.delete(apiKey).where(eq(apiKey.organizationId, orgB));
    await db.delete(organization).where(eq(organization.id, orgA));
    await db.delete(organization).where(eq(organization.id, orgB));
  });

  it("listApiKeysForOrg returns only the org's keys (no cross-org leak)", async () => {
    const keys = await listApiKeysForOrg(orgA);

    const ids = keys.map((k) => k.id);
    expect(ids).toContain(keyA.id);
    expect(ids).not.toContain(keyB.id);
  });

  it("findApiKeyForOrg returns undefined for a key owned by a different org (IDOR guard)", async () => {
    const result = await findApiKeyForOrg(keyB.id, orgA);
    expect(result).toBeUndefined();
  });

  it("findApiKeyForOrg resolves a key when id and org match", async () => {
    const result = await findApiKeyForOrg(keyB.id, orgB);
    expect(result?.id).toBe(keyB.id);
  });

  it("findApiKeyByHash resolves a key regardless of org (unscoped auth path)", async () => {
    const result = await findApiKeyByHash(keyB.keyHash);
    expect(result?.id).toBe(keyB.id);
    expect(result?.organizationId).toBe(orgB);
  });

  it("updateApiKeyForOrg does not affect a key owned by a different org", async () => {
    const updated = await updateApiKeyForOrg(keyB.id, orgA, {
      name: "hacked",
    });
    expect(updated).toBeNull();

    // Confirm keyB was NOT modified
    const reread = await findApiKeyForOrg(keyB.id, orgB);
    expect(reread?.name).toBe(keyB.name);
  });

  it("deleteApiKeyForOrg does not delete a key owned by a different org", async () => {
    await deleteApiKeyForOrg(keyB.id, orgA);

    // Confirm keyB STILL EXISTS
    const reread = await findApiKeyForOrg(keyB.id, orgB);
    expect(reread?.id).toBe(keyB.id);
  });
});
