/**
 * Batch Sender — Claim-Before-Send (real DB)
 *
 * Exercises the INSERT claim and UPDATE re-claim SQL against the real
 * unique index `message_send_dedup_idx` on the Neon test branch.
 *
 * Tests 1–4 directly execute the same SQL shapes the worker uses (claim
 * INSERT, re-claim UPDATE) so they verify real index semantics — a mocked
 * DB cannot do this.
 *
 * Pattern: beforeAll seedBaseOrg → beforeEach clearWorkflowState → afterAll cleanupBaseOrg
 *
 * TEST_PREFIX: bs-claim-db (unique across all *-db.test.ts files)
 */

import { and, batchSend, contact, db, eq, messageSend, or } from "@wraps/db";
import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type BaseOrgFixture,
  cleanupBaseOrg,
  clearWorkflowState,
  seedBaseOrg,
} from "../(ee)/__tests__/fixtures/real-db";

const TEST_PREFIX = "bs-claim-db";
const BATCH_ID = `${TEST_PREFIX}-batch`;
const CONTACT_A_ID = `${TEST_PREFIX}-ca`;
const CONTACT_B_ID = `${TEST_PREFIX}-cb`;
const CLAIM_STALE_MINUTES = 15;

let fixture: BaseOrgFixture;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — same SQL shapes as batch-sender.ts
// ─────────────────────────────────────────────────────────────────────────────

type Recipient = { id: string; email: string };

/**
 * Run the claim INSERT against the real unique index.
 * Returns the contactIds that won the claim race.
 */
async function runClaim(
  orgId: string,
  awsAccountId: string,
  recipients: Recipient[]
): Promise<Array<{ contactId: string | null }>> {
  const now = new Date();
  const claimRows = recipients.map((c) => ({
    organizationId: orgId,
    contactId: c.id,
    awsAccountId,
    channel: "email" as const,
    batchSendId: BATCH_ID,
    sourceType: "batch" as const,
    recipient: c.email,
    status: "queued" as const,
    claimedAt: now,
  }));
  return db
    .insert(messageSend)
    .values(claimRows)
    .onConflictDoNothing()
    .returning({ contactId: messageSend.contactId });
}

/**
 * Run the re-claim UPDATE (failed rows + stale queued rows).
 * Returns the contactIds that were re-claimed.
 */
async function runReclaim(
  orgId: string,
  notClaimedIds: string[]
): Promise<Array<{ contactId: string | null }>> {
  if (notClaimedIds.length === 0) return [];
  return db
    .update(messageSend)
    .set({ status: "queued", error: null, claimedAt: new Date() })
    .where(
      and(
        eq(messageSend.organizationId, orgId),
        eq(messageSend.batchSendId, BATCH_ID),
        inArray(messageSend.contactId, notClaimedIds),
        or(
          eq(messageSend.status, "failed"),
          and(
            eq(messageSend.status, "queued"),
            sql`${messageSend.claimedAt} < now() - interval '${sql.raw(String(CLAIM_STALE_MINUTES))} minutes'`
          )
        )
      )
    )
    .returning({ contactId: messageSend.contactId });
}

beforeAll(async () => {
  fixture = await seedBaseOrg(TEST_PREFIX);

  const now = new Date();
  const orgId = fixture.ids.org;

  // Seed two contacts for the claim tests
  await db
    .insert(contact)
    .values([
      {
        id: CONTACT_A_ID,
        organizationId: orgId,
        email: `${TEST_PREFIX}-ca@example.com`,
        emailHash: `${TEST_PREFIX}-hash-ca`,
        firstName: "ClaimA",
        emailStatus: "active",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: CONTACT_B_ID,
        organizationId: orgId,
        email: `${TEST_PREFIX}-cb@example.com`,
        emailHash: `${TEST_PREFIX}-hash-cb`,
        firstName: "ClaimB",
        emailStatus: "active",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ] as typeof contact.$inferInsert[])
    .onConflictDoNothing();

  // Seed the batchSend row (FK required by messageSend.batchSendId)
  await db
    .insert(batchSend)
    .values({
      id: BATCH_ID,
      organizationId: orgId,
      awsAccountId: fixture.ids.awsAccount,
      channel: "email",
      status: "processing",
      totalRecipients: 2,
    } as typeof batchSend.$inferInsert)
    .onConflictDoNothing();
});

beforeEach(async () => {
  await clearWorkflowState(fixture.ids.org);
});

afterAll(async () => {
  // Delete batchSend before org cleanup
  await db.delete(batchSend).where(eq(batchSend.id, BATCH_ID));
  await cleanupBaseOrg(TEST_PREFIX);
  // Contacts cascade-delete with the org, so no explicit delete needed
});

describe("Batch sender claim-before-send (real DB)", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Concurrent duplicate claim
  // ───────────────────────────────────────────────────────────────────────────

  it("concurrent duplicate claim: union = full set, intersection = empty", async () => {
    const orgId = fixture.ids.org;
    const awsAccountId = fixture.ids.awsAccount;
    const recipients: Recipient[] = [
      { id: CONTACT_A_ID, email: `${TEST_PREFIX}-ca@example.com` },
      { id: CONTACT_B_ID, email: `${TEST_PREFIX}-cb@example.com` },
    ];

    // Fire two identical claim INSERTs concurrently (simulates duplicate SQS delivery)
    const [result1, result2] = await Promise.all([
      runClaim(orgId, awsAccountId, recipients),
      runClaim(orgId, awsAccountId, recipients),
    ]);

    const claimed1 = new Set(result1.map((r) => r.contactId));
    const claimed2 = new Set(result2.map((r) => r.contactId));

    // Union of both callers = full contact set (every contact claimed exactly once)
    const union = new Set([...claimed1, ...claimed2]);
    expect(union.size).toBe(2);
    expect(union.has(CONTACT_A_ID)).toBe(true);
    expect(union.has(CONTACT_B_ID)).toBe(true);

    // Intersection = empty (no contact claimed by both callers)
    const intersection = [...claimed1].filter((id) => claimed2.has(id));
    expect(intersection).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Sequential redelivery after success
  // ───────────────────────────────────────────────────────────────────────────

  it("sequential redelivery after success: zero contacts claimed or re-claimed", async () => {
    const orgId = fixture.ids.org;
    const awsAccountId = fixture.ids.awsAccount;

    // Seed a 'sent' row (simulates a successfully processed chunk)
    await db.insert(messageSend).values({
      organizationId: orgId,
      contactId: CONTACT_A_ID,
      awsAccountId,
      channel: "email",
      batchSendId: BATCH_ID,
      sourceType: "batch",
      recipient: `${TEST_PREFIX}-ca@example.com`,
      status: "sent",
      sentAt: new Date(),
      claimedAt: new Date(),
    } as typeof messageSend.$inferInsert);

    const recipients: Recipient[] = [
      { id: CONTACT_A_ID, email: `${TEST_PREFIX}-ca@example.com` },
    ];

    // Claim INSERT skips the sent row (unique index conflict)
    const claimed = await runClaim(orgId, awsAccountId, recipients);
    expect(claimed).toHaveLength(0);

    // Re-claim UPDATE skips it too (status is 'sent', not 'failed' or stale 'queued')
    const reclaimed = await runReclaim(orgId, [CONTACT_A_ID]);
    expect(reclaimed).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Failed-contact retry preserved
  // ───────────────────────────────────────────────────────────────────────────

  it("failed contact is re-claimed by UPDATE and its row is reset to queued", async () => {
    const orgId = fixture.ids.org;
    const awsAccountId = fixture.ids.awsAccount;

    // Seed a 'failed' row
    await db.insert(messageSend).values({
      organizationId: orgId,
      contactId: CONTACT_A_ID,
      awsAccountId,
      channel: "email",
      batchSendId: BATCH_ID,
      sourceType: "batch",
      recipient: `${TEST_PREFIX}-ca@example.com`,
      status: "failed",
      error: "previous failure",
      claimedAt: new Date(),
    } as typeof messageSend.$inferInsert);

    const recipients: Recipient[] = [
      { id: CONTACT_A_ID, email: `${TEST_PREFIX}-ca@example.com` },
    ];

    // Claim INSERT skips it (unique index conflict with failed row)
    const claimed = await runClaim(orgId, awsAccountId, recipients);
    expect(claimed).toHaveLength(0);

    // Re-claim UPDATE picks it up
    const reclaimed = await runReclaim(orgId, [CONTACT_A_ID]);
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].contactId).toBe(CONTACT_A_ID);

    // Verify the row was reset
    const [row] = await db
      .select({
        status: messageSend.status,
        error: messageSend.error,
        claimedAt: messageSend.claimedAt,
      })
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, orgId),
          eq(messageSend.batchSendId, BATCH_ID),
          eq(messageSend.contactId, CONTACT_A_ID)
        )
      );
    expect(row.status).toBe("queued");
    expect(row.error).toBeNull();
    expect(row.claimedAt).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Stale claim recovery
  // ───────────────────────────────────────────────────────────────────────────

  it("re-claims stale queued rows (20 min old) but not fresh ones (1 min old)", async () => {
    const orgId = fixture.ids.org;
    const awsAccountId = fixture.ids.awsAccount;

    const staleTime = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    const freshTime = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago

    // Seed a stale queued row (crashed Lambda — claim was set 20 min ago, no send)
    const [seeded] = await db
      .insert(messageSend)
      .values({
        organizationId: orgId,
        contactId: CONTACT_A_ID,
        awsAccountId,
        channel: "email",
        batchSendId: BATCH_ID,
        sourceType: "batch",
        recipient: `${TEST_PREFIX}-ca@example.com`,
        status: "queued",
        claimedAt: staleTime,
      } as typeof messageSend.$inferInsert)
      .returning({ id: messageSend.id });

    // Re-claim should pick up the stale row
    const reclaimed = await runReclaim(orgId, [CONTACT_A_ID]);
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].contactId).toBe(CONTACT_A_ID);

    // Reset the row to queued with a FRESH claimedAt (simulates an active live execution)
    await db
      .update(messageSend)
      .set({ status: "queued", claimedAt: freshTime })
      .where(eq(messageSend.id, seeded.id));

    // Re-claim should NOT touch the fresh row (would steal a live execution's claim)
    const reclaimed2 = await runReclaim(orgId, [CONTACT_A_ID]);
    expect(reclaimed2).toHaveLength(0);
  });
});
