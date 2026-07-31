import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  checkSegmentUsable,
  countBroadcastRecipients,
  getSampleRecipientsWithProperties,
} from "../repositories/broadcasts";
import { contact, organization, segment } from "../schema";

const orgId = `repo-broadcast-test-org-${crypto.randomUUID().slice(0, 8)}`;

const contactA = {
  id: `repo-bc-contact-a-${crypto.randomUUID().slice(0, 8)}`,
  organizationId: orgId,
  email: "a@example.com",
  emailHash: `hash-a-${crypto.randomUUID().slice(0, 8)}`,
  emailStatus: "active" as const,
  jobTitle: "Head of Growth",
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

    await db.insert(contact).values([contactA, contactB]).onConflictDoNothing();
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

  it("includes jobTitle, which broadcast variable mappings can target", async () => {
    const { contacts } = await getSampleRecipientsWithProperties(
      orgId,
      "email"
    );

    const contactWithJobTitle = contacts.find((c) => c.id === contactA.id);
    expect(contactWithJobTitle?.jobTitle).toBe("Head of Growth");
    expect(contacts.find((c) => c.id === contactB.id)?.jobTitle).toBeNull();
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

/**
 * A segment whose condition compiles to no SQL must target nobody. Before this
 * was enforced, the segment clause was simply omitted and the broadcast widened
 * to every contact in the organization — the failure is silent and the blast
 * radius is a full-list send, so it is pinned against a real query.
 */
describe("Repository: countBroadcastRecipients fails closed on bad segments", () => {
  const badOrgId = `repo-bc-failclosed-org-${crypto.randomUUID().slice(0, 8)}`;
  const unknownFieldSegmentId = `repo-bc-seg-unknown-${crypto.randomUUID().slice(0, 8)}`;
  const badBucketSegmentId = `repo-bc-seg-bucket-${crypto.randomUUID().slice(0, 8)}`;
  const goodSegmentId = `repo-bc-seg-good-${crypto.randomUUID().slice(0, 8)}`;
  const goodSegmentIdB = `repo-bc-seg-good-b-${crypto.randomUUID().slice(0, 8)}`;

  const partitionCondition = (index: number) => ({
    logic: "AND" as const,
    groups: [
      {
        filters: [
          {
            field: "bucket",
            operator: "inBucket" as const,
            value: { buckets: 2, index },
          },
        ],
      },
    ],
  });

  const makeContact = (label: string) => ({
    id: `repo-bc-fc-${label}-${crypto.randomUUID().slice(0, 8)}`,
    organizationId: badOrgId,
    email: `${label}@fail-closed.example.com`,
    emailHash: `fc-hash-${label}-${crypto.randomUUID().slice(0, 8)}`,
    emailStatus: "active" as const,
    properties: {},
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  });

  beforeAll(async () => {
    await db
      .insert(organization)
      .values({
        id: badOrgId,
        name: "Fail Closed Test Org",
        slug: `bc-fc-test-${badOrgId.slice(-8)}`,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(contact)
      .values([makeContact("x"), makeContact("y"), makeContact("z")])
      .onConflictDoNothing();

    await db
      .insert(segment)
      .values([
        {
          // Models a rollback: a stored operator/field this build cannot compile.
          id: unknownFieldSegmentId,
          organizationId: badOrgId,
          name: "Unknown field",
          condition: {
            logic: "AND",
            groups: [
              {
                filters: [
                  {
                    field: "fieldFromANewerRelease",
                    operator: "equals",
                    value: "x",
                  },
                ],
              },
            ],
          },
        },
        {
          id: badBucketSegmentId,
          organizationId: badOrgId,
          name: "Out of range partition",
          condition: {
            logic: "AND",
            groups: [
              {
                filters: [
                  {
                    field: "bucket",
                    operator: "inBucket",
                    value: { buckets: 6, index: 99 },
                  },
                ],
              },
            ],
          },
        },
        {
          id: goodSegmentId,
          organizationId: badOrgId,
          name: "Valid partition 1 of 2",
          condition: partitionCondition(1),
        },
        {
          id: goodSegmentIdB,
          organizationId: badOrgId,
          name: "Valid partition 2 of 2",
          condition: partitionCondition(2),
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(segment).where(eq(segment.organizationId, badOrgId));
    await db.delete(contact).where(eq(contact.organizationId, badOrgId));
    await db.delete(organization).where(eq(organization.id, badOrgId));
  });

  it("counts the whole audience when no segment filter is applied", async () => {
    // Guards the test itself: proves 0 below is the segment clause working,
    // not an empty fixture.
    expect(await countBroadcastRecipients(badOrgId, "email")).toBe(3);
  });

  it("counts nobody when the segment condition uses an unknown field", async () => {
    const count = await countBroadcastRecipients(badOrgId, "email", {
      audienceType: "segment",
      segmentId: unknownFieldSegmentId,
    });

    expect(count).toBe(0);
  });

  it("counts nobody when a partition filter is out of range", async () => {
    const count = await countBroadcastRecipients(badOrgId, "email", {
      audienceType: "segment",
      segmentId: badBucketSegmentId,
    });

    expect(count).toBe(0);
  });

  it("counts nobody when the segment has been deleted", async () => {
    const count = await countBroadcastRecipients(badOrgId, "email", {
      audienceType: "segment",
      segmentId: `repo-bc-seg-missing-${crypto.randomUUID().slice(0, 8)}`,
    });

    expect(count).toBe(0);
  });

  it("still counts valid partition segments, which tile the audience", async () => {
    // Asserting a per-partition size would be flaky — with 3 contacts across 2
    // buckets they can all hash into one. The invariant that holds regardless
    // of distribution is that the partitions sum to the whole audience.
    const [first, second] = await Promise.all([
      countBroadcastRecipients(badOrgId, "email", {
        audienceType: "segment",
        segmentId: goodSegmentId,
      }),
      countBroadcastRecipients(badOrgId, "email", {
        audienceType: "segment",
        segmentId: goodSegmentIdB,
      }),
    ]);

    expect(first + second).toBe(3);
  });

  it("reports why an unusable segment matched nobody", async () => {
    expect(await checkSegmentUsable(badOrgId, unknownFieldSegmentId)).toBe(
      "no-valid-filters"
    );
    expect(await checkSegmentUsable(badOrgId, badBucketSegmentId)).toBe(
      "no-valid-filters"
    );
    expect(await checkSegmentUsable(badOrgId, goodSegmentId)).toBe("ok");
    expect(await checkSegmentUsable(badOrgId, "no-such-segment")).toBe(
      "missing"
    );
  });

  it("does not treat another org's segment as usable", async () => {
    expect(await checkSegmentUsable(orgId, goodSegmentId)).toBe("missing");

    const count = await countBroadcastRecipients(orgId, "email", {
      audienceType: "segment",
      segmentId: goodSegmentId,
    });

    expect(count).toBe(0);
  });
});
