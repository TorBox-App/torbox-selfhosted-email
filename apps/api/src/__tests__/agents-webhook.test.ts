/**
 * Agent enforcer webhook — POST /v1/agents/webhook (real DB)
 *
 * Unit 6: a callback bearing a valid X-Wraps-Agent-Key inserts a PENDING queue
 * row + notification; an invalid key → 401; the org is derived from the matched
 * awsAccount (by secret), never from the request body.
 *
 * The enforcer Lambda authenticates with its account's 32-byte webhookSecret
 * (unique per account), compared in constant time.
 */

import {
  agent,
  agentApprovalQueue,
  awsAccount,
  db,
  member,
  notification,
  organization,
  user,
} from "@wraps/db";
import { eq, inArray } from "drizzle-orm";
import { Elysia } from "elysia";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { agentsWebhookRoutes } from "../routes/agents-webhook";

const P = `agents-wh-${crypto.randomUUID().slice(0, 8)}`;

const ORG_A = `${P}-org-a`;
const ORG_B = `${P}-org-b`;
const USER = `${P}-user`;
const SECRET_A = `${P}-secret-a-${"x".repeat(32)}`;
const SECRET_B = `${P}-secret-b-${"y".repeat(32)}`;
let agentId: string;

function app() {
  return new Elysia().use(agentsWebhookRoutes);
}

beforeAll(async () => {
  const now = new Date();
  await db
    .insert(user)
    .values({
      id: USER,
      email: `${P}@example.com`,
      name: "WH User",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      image: null,
    } as typeof user.$inferInsert)
    .onConflictDoUpdate({ target: user.id, set: { updatedAt: now } });
  for (const [id, slug] of [
    [ORG_A, `${P}-a`],
    [ORG_B, `${P}-b`],
  ] as const) {
    await db
      .insert(organization)
      .values({
        id,
        name: id,
        slug,
        createdAt: now,
      } as typeof organization.$inferInsert)
      .onConflictDoUpdate({ target: organization.id, set: { name: id } });
  }
  await db
    .insert(member)
    .values({
      id: `${P}-member`,
      organizationId: ORG_A,
      userId: USER,
      role: "owner",
      createdAt: now,
    } as typeof member.$inferInsert)
    .onConflictDoUpdate({ target: member.id, set: { role: "owner" } });
  await db
    .insert(awsAccount)
    .values({
      id: `${P}-aws-a`,
      organizationId: ORG_A,
      name: "A",
      accountId: "100000000001",
      region: "us-east-1",
      roleArn: "arn:aws:iam::100000000001:role/w",
      externalId: `${P}-ext-a`,
      webhookSecret: SECRET_A,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    } as typeof awsAccount.$inferInsert)
    .onConflictDoUpdate({
      target: awsAccount.id,
      set: { webhookSecret: SECRET_A },
    });
  await db
    .insert(awsAccount)
    .values({
      id: `${P}-aws-b`,
      organizationId: ORG_B,
      name: "B",
      accountId: "100000000002",
      region: "us-east-1",
      roleArn: "arn:aws:iam::100000000002:role/w",
      externalId: `${P}-ext-b`,
      webhookSecret: SECRET_B,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    } as typeof awsAccount.$inferInsert)
    .onConflictDoUpdate({
      target: awsAccount.id,
      set: { webhookSecret: SECRET_B },
    });
  const [a] = await db
    .insert(agent)
    .values({
      organizationId: ORG_A,
      name: "wh-bot",
      emailAddress: `wh-bot@${P}.example.com`,
      domain: `${P}.example.com`,
      policy: {
        maxPerHour: 20,
        maxPerDay: 100,
        allowedRecipients: [],
        allowedRecipientDomains: [],
      },
    })
    .returning();
  agentId = a.id;
});

beforeEach(async () => {
  await db
    .delete(agentApprovalQueue)
    .where(inArray(agentApprovalQueue.organizationId, [ORG_A, ORG_B]));
  await db
    .delete(notification)
    .where(inArray(notification.organizationId, [ORG_A, ORG_B]));
});

afterAll(async () => {
  await db
    .delete(agentApprovalQueue)
    .where(inArray(agentApprovalQueue.organizationId, [ORG_A, ORG_B]));
  await db
    .delete(notification)
    .where(inArray(notification.organizationId, [ORG_A, ORG_B]));
  await db.delete(agent).where(inArray(agent.organizationId, [ORG_A, ORG_B]));
  await db
    .delete(awsAccount)
    .where(inArray(awsAccount.organizationId, [ORG_A, ORG_B]));
  await db.delete(member).where(eq(member.id, `${P}-member`));
  await db.delete(organization).where(inArray(organization.id, [ORG_A, ORG_B]));
  await db.delete(user).where(eq(user.id, USER));
});

const payload = {
  from: `wh-bot@${P}.example.com`,
  to: "someone@external.com",
  subject: "Hi",
  html: "<p>hi</p>",
  text: "hi",
};

describe("POST /v1/agents/webhook", () => {
  it("valid key inserts a PENDING queue row + notification, org from awsAccount", async () => {
    const res = await app().handle(
      new Request("http://localhost/v1/agents/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wraps-Agent-Key": SECRET_A,
        },
        body: JSON.stringify({
          agentId,
          event: "pending_approval",
          payload,
          reason: "recipient not on allowlist",
          // A malicious org id in the body must be ignored.
          organizationId: ORG_B,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approvalId).toBeDefined();

    const rows = await db
      .select()
      .from(agentApprovalQueue)
      .where(eq(agentApprovalQueue.id, body.approvalId));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].organizationId).toBe(ORG_A); // from matched account, NOT body ORG_B
    expect(rows[0].agentId).toBe(agentId);
    expect(rows[0].reason).toBe("recipient not on allowlist");

    const notes = await db
      .select()
      .from(notification)
      .where(eq(notification.organizationId, ORG_A));
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some((n) => n.type === "agent.send_pending")).toBe(true);

    // Nothing leaked into ORG_B.
    const orgBRows = await db
      .select()
      .from(agentApprovalQueue)
      .where(eq(agentApprovalQueue.organizationId, ORG_B));
    expect(orgBRows).toHaveLength(0);
  });

  it("invalid key → 401 and writes nothing", async () => {
    const res = await app().handle(
      new Request("http://localhost/v1/agents/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wraps-Agent-Key": "totally-wrong-key",
        },
        body: JSON.stringify({
          agentId,
          event: "pending_approval",
          payload,
          reason: "x",
        }),
      })
    );

    expect(res.status).toBe(401);
    const rows = await db
      .select()
      .from(agentApprovalQueue)
      .where(inArray(agentApprovalQueue.organizationId, [ORG_A, ORG_B]));
    expect(rows).toHaveLength(0);
  });
});
