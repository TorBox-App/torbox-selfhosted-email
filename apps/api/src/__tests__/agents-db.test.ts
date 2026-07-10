/**
 * Agent routes — create + read (real DB)
 *
 * Unit 4 (tracer): POST /v1/agents creates an agent for the authed org and
 * returns it.
 * Unit 5 (IDOR): GET /v1/agents/:id returns 404 for an agent owned by another
 * org.
 *
 * File suffix `-db.test.ts` = real Neon test branch (no DB mocks). AWS boundary
 * (STS/Lambda/DynamoDB) is mocked at the SDK level — the create/read paths here
 * never touch AWS, but the enforcer service is imported by the route module.
 */

import { agent, db, member, user } from "@wraps/db";
import { eq, inArray } from "drizzle-orm";
import { Elysia } from "elysia";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupBaseOrg,
  seedBaseOrg,
} from "../(ee)/__tests__/fixtures/real-db";
import { agentsRoutes } from "../routes/agents";

const PREFIX = `agents-db-${crypto.randomUUID().slice(0, 8)}`;

let ids: Awaited<ReturnType<typeof seedBaseOrg>>["ids"];
let accountNumber: string;

// A plain member of the primary org (role="member"), for RBAC assertions.
const MEMBER_USER_ID = `${PREFIX}-member-user`;

function appFor(organizationId: string, userId: string) {
  return new Elysia()
    .derive(() => ({
      auth: { apiKeyId: null, organizationId, userId, planId: "pro" },
    }))
    .use(agentsRoutes);
}

beforeAll(async () => {
  const fixture = await seedBaseOrg(PREFIX);
  ids = fixture.ids;
  accountNumber = fixture.accountNumber;

  const now = new Date();
  await db
    .insert(user)
    .values({
      id: MEMBER_USER_ID,
      email: `${PREFIX}-member@example.com`,
      name: "Plain Member",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      image: null,
    } as typeof user.$inferInsert)
    .onConflictDoNothing();
  await db
    .insert(member)
    .values({
      id: `${PREFIX}-member-row`,
      organizationId: ids.org,
      userId: MEMBER_USER_ID,
      role: "member",
      createdAt: now,
    } as typeof member.$inferInsert)
    .onConflictDoNothing();
});

beforeEach(async () => {
  await db
    .delete(agent)
    .where(inArray(agent.organizationId, [ids.org, ids.otherOrg]));
});

afterAll(async () => {
  await db
    .delete(agent)
    .where(inArray(agent.organizationId, [ids.org, ids.otherOrg]));
  await db.delete(member).where(eq(member.id, `${PREFIX}-member-row`));
  await db.delete(user).where(eq(user.id, MEMBER_USER_ID));
  await cleanupBaseOrg(PREFIX);
});

describe("POST /v1/agents", () => {
  it("creates an agent for the authed org and returns it", async () => {
    const app = appFor(ids.org, ids.user);
    const res = await app.handle(
      new Request("http://localhost/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "support-bot",
          emailAddress: `support-bot@${PREFIX}.example.com`,
          domain: `${PREFIX}.example.com`,
          policy: {
            maxPerHour: 20,
            maxPerDay: 100,
            allowedRecipients: [],
            allowedRecipientDomains: ["example.com"],
          },
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("support-bot");
    expect(body.emailAddress).toBe(`support-bot@${PREFIX}.example.com`);
    expect(body.status).toBe("ACTIVE");
    expect(body.policy.maxPerHour).toBe(20);
    expect(body.policy.allowedRecipientDomains).toEqual(["example.com"]);

    // Re-query: row exists, scoped to the authed org.
    const rows = await db
      .select()
      .from(agent)
      .where(inArray(agent.organizationId, [ids.org]));
    expect(rows).toHaveLength(1);
    expect(rows[0].organizationId).toBe(ids.org);
    expect(rows[0].createdBy).toBe(ids.user);
  });
});

describe("GET /v1/agents/:id (IDOR)", () => {
  it("returns 404 for an agent owned by another org", async () => {
    // Seed an agent in the OTHER org.
    const [foreign] = await db
      .insert(agent)
      .values({
        organizationId: ids.otherOrg,
        name: "foreign-bot",
        emailAddress: `foreign-bot@${PREFIX}.example.com`,
        domain: `${PREFIX}.example.com`,
        policy: {
          maxPerHour: 5,
          maxPerDay: 20,
          allowedRecipients: [],
          allowedRecipientDomains: [],
        },
      })
      .returning();

    // Authenticated as the primary org, ask for the foreign agent's id.
    const app = appFor(ids.org, ids.user);
    const res = await app.handle(
      new Request(`http://localhost/v1/agents/${foreign.id}`, {
        method: "GET",
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Agent not found");
  });
});

describe("POST /v1/agents duplicate handling (COR-5)", () => {
  it("409s on a duplicate name and on a duplicate email with distinct messages", async () => {
    const app = appFor(ids.org, ids.user);
    const base = {
      name: "dupe-bot",
      emailAddress: `dupe-bot@${PREFIX}.example.com`,
      domain: `${PREFIX}.example.com`,
    };

    const first = await app.handle(
      new Request("http://localhost/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      })
    );
    expect(first.status).toBe(201);

    // Same name → 409 (name conflict message).
    const dupName = await app.handle(
      new Request("http://localhost/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...base,
          emailAddress: `other@${PREFIX}.example.com`,
        }),
      })
    );
    expect(dupName.status).toBe(409);
    expect((await dupName.json()).error).toContain("name");

    // Same email, different name → 409 (email conflict message).
    const dupEmail = await app.handle(
      new Request("http://localhost/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, name: "different-name" }),
      })
    );
    expect(dupEmail.status).toBe(409);
    expect((await dupEmail.json()).error).toContain("email");
  });
});

describe("RBAC on create/kill (SEC-7)", () => {
  it("403s a plain-member create; owner succeeds", async () => {
    const memberApp = appFor(ids.org, MEMBER_USER_ID);
    const denied = await memberApp.handle(
      new Request("http://localhost/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "rbac-bot",
          emailAddress: `rbac-bot@${PREFIX}.example.com`,
          domain: `${PREFIX}.example.com`,
        }),
      })
    );
    expect(denied.status).toBe(403);

    // No row was written.
    const rows = await db
      .select()
      .from(agent)
      .where(inArray(agent.organizationId, [ids.org]));
    expect(rows).toHaveLength(0);
  });

  it("403s a plain-member kill", async () => {
    const [a] = await db
      .insert(agent)
      .values({
        organizationId: ids.org,
        name: "kill-me",
        emailAddress: `kill-me@${PREFIX}.example.com`,
        domain: `${PREFIX}.example.com`,
        policy: {
          maxPerHour: 5,
          maxPerDay: 20,
          allowedRecipients: [],
          allowedRecipientDomains: [],
        },
      })
      .returning();

    const memberApp = appFor(ids.org, MEMBER_USER_ID);
    const res = await memberApp.handle(
      new Request(`http://localhost/v1/agents/${a.id}/kill`, {
        method: "POST",
      })
    );
    expect(res.status).toBe(403);

    // Still ACTIVE — the kill never ran.
    const [rowAfter] = await db.select().from(agent).where(eq(agent.id, a.id));
    expect(rowAfter.status).toBe("ACTIVE");
  });
});

describe("POST /v1/agents/:id/kill sync-failure surface (SEC-5)", () => {
  it("returns syncStatus=skipped for a not-yet-deployed agent", async () => {
    const [a] = await db
      .insert(agent)
      .values({
        organizationId: ids.org,
        name: "kill-skip",
        emailAddress: `kill-skip@${PREFIX}.example.com`,
        domain: `${PREFIX}.example.com`,
        policy: {
          maxPerHour: 5,
          maxPerDay: 20,
          allowedRecipients: [],
          allowedRecipientDomains: [],
        },
      })
      .returning();

    const app = appFor(ids.org, ids.user);
    const res = await app.handle(
      new Request(`http://localhost/v1/agents/${a.id}/kill`, {
        method: "POST",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.syncStatus).toBe("skipped");
    expect(body.agent.status).toBe("KILLED");
  });
});

describe("POST /v1/agents/:id/policy-sync ARN validation (SEC-6)", () => {
  it("400s when the ARN account segment does not match awsAccountId", async () => {
    const [a] = await db
      .insert(agent)
      .values({
        organizationId: ids.org,
        name: "sync-bot",
        emailAddress: `sync-bot@${PREFIX}.example.com`,
        domain: `${PREFIX}.example.com`,
        policy: {
          maxPerHour: 5,
          maxPerDay: 20,
          allowedRecipients: [],
          allowedRecipientDomains: [],
        },
      })
      .returning();

    const app = appFor(ids.org, ids.user);
    const res = await app.handle(
      new Request(`http://localhost/v1/agents/${a.id}/policy-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: "111111111111",
          enforcerFunctionArn:
            "arn:aws:lambda:us-east-1:222222222222:function:wraps-agent-enforcer",
          credentialUserArn: "arn:aws:iam::111111111111:user/wraps-agent-x",
        }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("account");
  });

  it("400s an alias-qualified enforcer ARN (must be unqualified)", async () => {
    const [a] = await db
      .insert(agent)
      .values({
        organizationId: ids.org,
        name: "sync-bot-2",
        emailAddress: `sync-bot-2@${PREFIX}.example.com`,
        domain: `${PREFIX}.example.com`,
        policy: {
          maxPerHour: 5,
          maxPerDay: 20,
          allowedRecipients: [],
          allowedRecipientDomains: [],
        },
      })
      .returning();

    const app = appFor(ids.org, ids.user);
    const res = await app.handle(
      new Request(`http://localhost/v1/agents/${a.id}/policy-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: "111111111111",
          enforcerFunctionArn:
            "arn:aws:lambda:us-east-1:111111111111:function:wraps-agent-enforcer:agent-abc",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("200s when the ARN accounts all match awsAccountId", async () => {
    const [a] = await db
      .insert(agent)
      .values({
        organizationId: ids.org,
        name: "sync-bot-ok",
        emailAddress: `sync-bot-ok@${PREFIX}.example.com`,
        domain: `${PREFIX}.example.com`,
        policy: {
          maxPerHour: 5,
          maxPerDay: 20,
          allowedRecipients: [],
          allowedRecipientDomains: [],
        },
        awsAccountId: ids.awsAccount,
      })
      .returning();

    const app = appFor(ids.org, ids.user);
    const res = await app.handle(
      new Request(`http://localhost/v1/agents/${a.id}/policy-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: accountNumber,
          enforcerFunctionArn: `arn:aws:lambda:us-east-1:${accountNumber}:function:wraps-agent-enforcer`,
          credentialUserArn: `arn:aws:iam::${accountNumber}:user/wraps-agent-ok`,
        }),
      })
    );
    // Validation passes; the initial policy sync is best-effort (STS not mocked
    // here, so it fails silently) — the route still returns 200 with the agent.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enforcerFunctionArn).toContain(accountNumber);

    // The stored awsAccountId must be the INTERNAL awsAccount.id, not the
    // 12-digit number — getCredentials() looks up by internal id, so storing
    // the raw number breaks policy sync + approval execute at runtime.
    const [stored] = await db.select().from(agent).where(eq(agent.id, a.id));
    expect(stored?.awsAccountId).toBe(ids.awsAccount);
  });

  it("400s when the account number has no connected awsAccount in the org", async () => {
    const [a] = await db
      .insert(agent)
      .values({
        organizationId: ids.org,
        name: "sync-bot-unconnected",
        emailAddress: `sync-bot-unconnected@${PREFIX}.example.com`,
        domain: `${PREFIX}.example.com`,
        policy: {
          maxPerHour: 5,
          maxPerDay: 20,
          allowedRecipients: [],
          allowedRecipientDomains: [],
        },
      })
      .returning();

    const app = appFor(ids.org, ids.user);
    const res = await app.handle(
      new Request(`http://localhost/v1/agents/${a.id}/policy-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awsAccountId: "444444444444",
          enforcerFunctionArn:
            "arn:aws:lambda:us-east-1:444444444444:function:wraps-agent-enforcer",
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not connected");
  });
});
