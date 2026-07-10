import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  decideApproval,
  findAgentForOrg,
  findApprovalForOrg,
  insertAgent,
  insertApprovalRequest,
  killAgentForOrg,
  markApprovalSent,
  updateAgentForOrg,
} from "../repositories/agents";
import { agent, organization, user } from "../schema";

const suffix = crypto.randomUUID().slice(0, 8);

const orgA = `repo-agent-org-a-${suffix}`;
const orgB = `repo-agent-org-b-${suffix}`;
const userA = `repo-agent-user-a-${suffix}`;

const agentA = {
  id: `repo-agent-a-${suffix}`,
  organizationId: orgA,
  name: "sdr-bot",
  emailAddress: `sdr-bot@a-${suffix}.example.com`,
  domain: `a-${suffix}.example.com`,
  policy: {
    maxPerHour: 20,
    maxPerDay: 100,
    allowedRecipients: ["ceo@acme.test"],
    allowedRecipientDomains: ["acme.test"],
  },
};

describe("Repository: agents", () => {
  beforeAll(async () => {
    await db
      .insert(organization)
      .values([
        {
          id: orgA,
          name: "Agent Repo Test Org A",
          slug: `agent-repo-a-${suffix}`,
          createdAt: new Date(),
        },
        {
          id: orgB,
          name: "Agent Repo Test Org B",
          slug: `agent-repo-b-${suffix}`,
          createdAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(user)
      .values({
        id: userA,
        name: "Agent Repo Test User A",
        email: `${userA}@test.wraps.dev`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(agent).where(eq(agent.organizationId, orgA));
    await db.delete(agent).where(eq(agent.organizationId, orgB));
    await db.delete(organization).where(eq(organization.id, orgA));
    await db.delete(organization).where(eq(organization.id, orgB));
    await db.delete(user).where(eq(user.id, userA));
  });

  it("insertAgent + findAgentForOrg round-trips policy jsonb, scoped to org", async () => {
    const inserted = await insertAgent(agentA);
    expect(inserted?.id).toBe(agentA.id);
    expect(inserted?.status).toBe("ACTIVE");
    expect(inserted?.policy.allowedRecipientDomains).toEqual(["acme.test"]);

    const found = await findAgentForOrg(agentA.id, orgA);
    expect(found?.emailAddress).toBe(agentA.emailAddress);
    expect(found?.policy.maxPerHour).toBe(20);

    // Cross-org read returns nothing (IDOR guard)
    const leaked = await findAgentForOrg(agentA.id, orgB);
    expect(leaked).toBeUndefined();
  });

  it("killAgentForOrg flips status to KILLED only within the owning org", async () => {
    // Cross-org kill is a no-op — agentA stays ACTIVE
    const crossOrg = await killAgentForOrg(agentA.id, orgB);
    expect(crossOrg).toBeNull();
    const stillActive = await findAgentForOrg(agentA.id, orgA);
    expect(stillActive?.status).toBe("ACTIVE");

    // Same-org kill flips to KILLED
    const killed = await killAgentForOrg(agentA.id, orgA);
    expect(killed?.status).toBe("KILLED");
    const reread = await findAgentForOrg(agentA.id, orgA);
    expect(reread?.status).toBe("KILLED");
  });

  it("approval queue: insert PENDING → decideApproval(APPROVED) stamps decidedBy/decidedAt; cross-org decide is a no-op", async () => {
    const approval = await insertApprovalRequest({
      organizationId: orgA,
      agentId: agentA.id,
      payload: {
        from: agentA.emailAddress,
        to: "ceo@acme.test",
        subject: "Q3 numbers",
        html: "<p>hi</p>",
      },
      reason: "recipient not on allowlist",
    });
    expect(approval?.status).toBe("PENDING");
    const approvalId = approval?.id;
    if (!approvalId) {
      throw new Error("expected approval id");
    }

    // Cross-org decide does nothing
    const crossOrg = await decideApproval(
      approvalId,
      orgB,
      "APPROVED",
      "user-b"
    );
    expect(crossOrg).toBeNull();
    const stillPending = await findApprovalForOrg(approvalId, orgA);
    expect(stillPending?.status).toBe("PENDING");

    // Same-org decide stamps decidedBy/decidedAt
    const decided = await decideApproval(approvalId, orgA, "APPROVED", userA);
    expect(decided?.status).toBe("APPROVED");
    expect(decided?.decidedBy).toBe(userA);
    expect(decided?.decidedAt).toBeInstanceOf(Date);
  });

  it("decideApproval on an already-APPROVED row returns null and preserves decidedBy/decidedAt", async () => {
    const approval = await insertApprovalRequest({
      organizationId: orgA,
      agentId: agentA.id,
      payload: {
        from: agentA.emailAddress,
        to: "ceo@acme.test",
        subject: "already decided",
      },
    });
    const approvalId = approval?.id;
    if (!approvalId) {
      throw new Error("expected approval id");
    }

    const first = await decideApproval(approvalId, orgA, "APPROVED", userA);
    expect(first?.status).toBe("APPROVED");
    const decidedAt = first?.decidedAt;

    // A second transition off PENDING must lose — no row returned.
    const second = await decideApproval(approvalId, orgA, "REJECTED", userA);
    expect(second).toBeNull();

    const reread = await findApprovalForOrg(approvalId, orgA);
    expect(reread?.status).toBe("APPROVED");
    expect(reread?.decidedBy).toBe(userA);
    expect(reread?.decidedAt?.getTime()).toBe(decidedAt?.getTime());
  });

  it("two concurrent decideApproval calls → exactly one wins the transition", async () => {
    const approval = await insertApprovalRequest({
      organizationId: orgA,
      agentId: agentA.id,
      payload: {
        from: agentA.emailAddress,
        to: "ceo@acme.test",
        subject: "race",
      },
    });
    const approvalId = approval?.id;
    if (!approvalId) {
      throw new Error("expected approval id");
    }

    const results = await Promise.all([
      decideApproval(approvalId, orgA, "APPROVED", userA),
      decideApproval(approvalId, orgA, "APPROVED", userA),
    ]);
    const winners = results.filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.status).toBe("APPROVED");
  });

  it("markApprovalSent on a PENDING (not APPROVED) row returns null and leaves status unchanged", async () => {
    const approval = await insertApprovalRequest({
      organizationId: orgA,
      agentId: agentA.id,
      payload: {
        from: agentA.emailAddress,
        to: "ceo@acme.test",
        subject: "not yet approved",
      },
    });
    const approvalId = approval?.id;
    if (!approvalId) {
      throw new Error("expected approval id");
    }

    const marked = await markApprovalSent(
      approvalId,
      orgA,
      "msg-should-not-set"
    );
    expect(marked).toBeNull();

    const reread = await findApprovalForOrg(approvalId, orgA);
    expect(reread?.status).toBe("PENDING");
    expect(reread?.messageId).toBeNull();
  });

  it("insertAgent with a duplicate (org, name) returns null without throwing", async () => {
    const dup = await insertAgent({
      organizationId: orgA,
      name: agentA.name,
      emailAddress: `other-${suffix}@a-${suffix}.example.com`,
      domain: `a-${suffix}.example.com`,
      policy: agentA.policy,
    });
    expect(dup).toBeNull();
  });

  it("two agents cannot share an emailAddress within one org (unique index)", async () => {
    const sharedEmail = `shared-${suffix}@a-${suffix}.example.com`;
    const first = await insertAgent({
      organizationId: orgA,
      name: `email-dup-1-${suffix}`,
      emailAddress: sharedEmail,
      domain: `a-${suffix}.example.com`,
      policy: agentA.policy,
    });
    expect(first?.emailAddress).toBe(sharedEmail);

    // Raw insert (bypassing onConflictDoNothing) proves the DB constraint.
    await expect(
      db.insert(agent).values({
        organizationId: orgA,
        name: `email-dup-2-${suffix}`,
        emailAddress: sharedEmail,
        domain: `a-${suffix}.example.com`,
        policy: agentA.policy,
      })
    ).rejects.toThrow();
  });

  it("updateAgentForOrg cannot resurrect a KILLED agent", async () => {
    const victim = await insertAgent({
      id: `repo-agent-kill-${suffix}`,
      organizationId: orgA,
      name: `kill-me-${suffix}`,
      emailAddress: `kill-me-${suffix}@a-${suffix}.example.com`,
      domain: `a-${suffix}.example.com`,
      policy: agentA.policy,
    });
    if (!victim) {
      throw new Error("expected inserted agent");
    }

    const killed = await killAgentForOrg(victim.id, orgA);
    expect(killed?.status).toBe("KILLED");

    // Attempting to flip it back must not resurrect it. The param type omits
    // `status`; cast simulates a caller bypassing the type to prove the runtime
    // strip still holds.
    const resurrected = await updateAgentForOrg(victim.id, orgA, {
      status: "ACTIVE",
    } as Parameters<typeof updateAgentForOrg>[2]);
    expect(resurrected?.status).toBe("KILLED");

    const reread = await findAgentForOrg(victim.id, orgA);
    expect(reread?.status).toBe("KILLED");
  });
});
