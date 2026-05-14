import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { getSampleRecipientsWithProperties } from "../repositories/broadcasts";
import { contact, organization } from "../schema";

const orgId = `repo-broadcast-test-org-${crypto.randomUUID().slice(0, 8)}`;

const contactA = {
  id: `repo-bc-contact-a-${crypto.randomUUID().slice(0, 8)}`,
  organizationId: orgId,
  email: "a@example.com",
  emailHash: `hash-a-${crypto.randomUUID().slice(0, 8)}`,
  emailStatus: "active" as const,
  properties: { companyName: "Acme", dashboardUrl: "https://acme.example.com" },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const contactB = {
  id: `repo-bc-contact-b-${crypto.randomUUID().slice(0, 8)}`,
  organizationId: orgId,
  email: "b@example.com",
  emailHash: `hash-b-${crypto.randomUUID().slice(0, 8)}`,
  emailStatus: "active" as const,
  properties: {},
  createdAt: new Date("2026-01-02"),
  updatedAt: new Date("2026-01-02"),
};

describe("Repository: getSampleRecipientsWithProperties", () => {
  beforeAll(async () => {
    await db
      .insert(organization)
      .values({
        id: orgId,
        name: "Broadcast Repo Test Org",
        slug: `bc-repo-test-${orgId.slice(-8)}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values([contactA, contactB])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(contact).where(eq(contact.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("includes the properties field for each contact", async () => {
    const { contacts } = await getSampleRecipientsWithProperties(
      orgId,
      "email"
    );

    expect(contacts.length).toBeGreaterThanOrEqual(2);

    const contactWithProps = contacts.find((c) => c.id === contactA.id);
    expect(contactWithProps).toBeDefined();
    expect(contactWithProps?.properties).toEqual({
      companyName: "Acme",
      dashboardUrl: "https://acme.example.com",
    });
  });

  it("returns contacts with empty properties as empty object", async () => {
    const { contacts } = await getSampleRecipientsWithProperties(
      orgId,
      "email"
    );

    const contactWithoutProps = contacts.find((c) => c.id === contactB.id);
    expect(contactWithoutProps).toBeDefined();
    expect(contactWithoutProps?.properties).toEqual({});
  });

  it("returns totalCount matching the full audience size", async () => {
    const { totalCount } = await getSampleRecipientsWithProperties(
      orgId,
      "email"
    );

    expect(totalCount).toBe(2);
  });

  it("respects the limit parameter", async () => {
    const { contacts } = await getSampleRecipientsWithProperties(
      orgId,
      "email",
      undefined,
      1
    );

    expect(contacts).toHaveLength(1);
  });
});
