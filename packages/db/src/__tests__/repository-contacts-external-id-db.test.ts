import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  contactUniqueViolationField,
  findContact,
  resolveContactId,
} from "../repositories/contacts";
import { contact, organization } from "../schema";

const suffix = crypto.randomUUID().slice(0, 8);

const orgA = `repo-contact-extid-org-a-${suffix}`;
const orgB = `repo-contact-extid-org-b-${suffix}`;

// The customer stores their own UUIDs in externalId — the same shape Wraps
// uses for contact.id.
const uuidExternalId = crypto.randomUUID();
const emailExternalId = `user-${suffix}@customer-system.test`;

const uuidExtContact = {
  id: crypto.randomUUID(),
  organizationId: orgA,
  externalId: uuidExternalId,
  email: `uuid-ext-${suffix}@example.com`,
  emailHash: `uuid-ext-hash-${suffix}`,
};

const emailExtContact = {
  id: crypto.randomUUID(),
  organizationId: orgA,
  externalId: emailExternalId,
  email: `email-ext-${suffix}@example.com`,
  emailHash: `email-ext-hash-${suffix}`,
};

// Collides on purpose: its native id is another contact's externalId.
const collidingExternalId = crypto.randomUUID();
const nativeIdContact = {
  id: collidingExternalId,
  organizationId: orgA,
  email: `native-${suffix}@example.com`,
  emailHash: `native-hash-${suffix}`,
};
const shadowContact = {
  id: crypto.randomUUID(),
  organizationId: orgA,
  externalId: collidingExternalId,
  email: `shadow-${suffix}@example.com`,
  emailHash: `shadow-hash-${suffix}`,
};

const foreignExternalId = crypto.randomUUID();
const foreignContact = {
  id: crypto.randomUUID(),
  organizationId: orgB,
  externalId: foreignExternalId,
  email: `foreign-${suffix}@example.com`,
  emailHash: `foreign-hash-${suffix}`,
};

describe("Repository: contacts — UUID-shaped externalId resolution", () => {
  beforeAll(async () => {
    await db
      .insert(organization)
      .values([
        {
          id: orgA,
          name: "Contact ExtId Org A",
          slug: `contact-extid-a-${suffix}`,
          createdAt: new Date(),
        },
        {
          id: orgB,
          name: "Contact ExtId Org B",
          slug: `contact-extid-b-${suffix}`,
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values([
        uuidExtContact,
        emailExtContact,
        nativeIdContact,
        shadowContact,
        foreignContact,
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(contact).where(eq(contact.organizationId, orgA));
    await db.delete(contact).where(eq(contact.organizationId, orgB));
    await db.delete(organization).where(eq(organization.id, orgA));
    await db.delete(organization).where(eq(organization.id, orgB));
  });

  it("resolves a UUID-shaped externalId to the owning contact", async () => {
    const resolved = await resolveContactId(uuidExternalId, orgA);
    expect(resolved).toBe(uuidExtContact.id);
  });

  it("finds a contact by UUID-shaped externalId", async () => {
    const found = await findContact(uuidExternalId, orgA);
    expect(found?.id).toBe(uuidExtContact.id);
  });

  it("resolves an email-shaped externalId when no contact has that email", async () => {
    const resolved = await resolveContactId(emailExternalId, orgA);
    expect(resolved).toBe(emailExtContact.id);
  });

  it("prefers a native contact id over another contact's matching externalId", async () => {
    const resolved = await resolveContactId(collidingExternalId, orgA);
    expect(resolved).toBe(nativeIdContact.id);
    expect(resolved).not.toBe(shadowContact.id);
  });

  it("does not resolve an externalId belonging to another organization", async () => {
    const resolved = await resolveContactId(foreignExternalId, orgA);
    expect(resolved).toBeNull();
  });

  it("still resolves a plain contact UUID", async () => {
    const resolved = await resolveContactId(uuidExtContact.id, orgA);
    expect(resolved).toBe(uuidExtContact.id);
  });
});

// Pins the real Postgres error shape the API's 409 mapping depends on: a
// hand-built fake error would pass even if pg stopped populating `constraint`
// or the index were renamed.
describe("Repository: contacts — unique violation classification", () => {
  beforeAll(async () => {
    await db
      .insert(organization)
      .values({
        id: orgA,
        name: "Contact ExtId Org A",
        slug: `contact-extid-a-${suffix}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
    await db.insert(contact).values(uuidExtContact).onConflictDoNothing();
  });

  it("classifies a duplicate externalId as an externalId collision", async () => {
    const duplicate = db.insert(contact).values({
      id: crypto.randomUUID(),
      organizationId: orgA,
      externalId: uuidExternalId,
      email: `dupe-ext-${suffix}@example.com`,
      emailHash: `dupe-ext-hash-${suffix}`,
    });

    const error = await duplicate.then(
      () => null,
      (err: unknown) => err
    );

    expect(error).not.toBeNull();
    expect(contactUniqueViolationField(error)).toBe("externalId");
  });

  it("classifies a duplicate email hash as an email collision", async () => {
    const duplicate = db.insert(contact).values({
      id: crypto.randomUUID(),
      organizationId: orgA,
      email: uuidExtContact.email,
      emailHash: uuidExtContact.emailHash,
    });

    const error = await duplicate.then(
      () => null,
      (err: unknown) => err
    );

    expect(error).not.toBeNull();
    expect(contactUniqueViolationField(error)).toBe("email");
  });

  it("returns null for errors that are not unique violations", () => {
    expect(contactUniqueViolationField(new Error("boom"))).toBeNull();
    expect(contactUniqueViolationField(null)).toBeNull();
    expect(
      contactUniqueViolationField({ code: "23503", constraint: "some_fk" })
    ).toBeNull();
    expect(
      contactUniqueViolationField({ code: "23505", constraint: "other_idx" })
    ).toBeNull();
  });
});
