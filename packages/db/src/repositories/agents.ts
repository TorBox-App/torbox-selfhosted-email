import { and, desc } from "drizzle-orm";
import { db, eq } from "../index";
import type {
  Agent,
  AgentApproval,
  AgentApprovalStatus,
  NewAgent,
  NewAgentApproval,
} from "../schema/agents";
import { agent, agentApprovalQueue } from "../schema/agents";

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | DrizzleTransaction;

// ── Insert ────────────────────────────────────────────────────────────────────

export async function insertAgent(
  values: NewAgent,
  dbClient: DbClient = db
): Promise<Agent | null> {
  // Bare onConflictDoNothing (never a {target}) — the partial/multi-unique
  // caveat means a targeted clause can silently miss a constraint. A conflict
  // on any unique index (org+name, org+email) yields no row → null.
  const [inserted] = await dbClient
    .insert(agent)
    .values(values)
    .onConflictDoNothing()
    .returning();
  return inserted ?? null;
}

// ── Find ─────────────────────────────────────────────────────────────────────

export async function findAgentForOrg(
  agentId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<Agent | undefined> {
  return dbClient.query.agent.findFirst({
    where: (a, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(a.id, agentId), eqOp(a.organizationId, organizationId)),
  });
}

export async function findAgentByAddress(
  organizationId: string,
  emailAddress: string,
  dbClient: DbClient = db
): Promise<Agent | undefined> {
  return dbClient.query.agent.findFirst({
    where: (a, { and: andOp, eq: eqOp }) =>
      andOp(
        eqOp(a.organizationId, organizationId),
        eqOp(a.emailAddress, emailAddress)
      ),
  });
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listAgentsForOrg(
  organizationId: string,
  dbClient: DbClient = db
): Promise<Agent[]> {
  return dbClient.query.agent.findMany({
    where: (a, { eq: eqOp }) => eqOp(a.organizationId, organizationId),
    orderBy: [desc(agent.createdAt)],
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateAgentForOrg(
  agentId: string,
  organizationId: string,
  updateData: Omit<Partial<NewAgent>, "status">,
  dbClient: DbClient = db
): Promise<Agent | null> {
  // Kill is terminal: never let a general update flip status back (COR-10).
  // `killAgentForOrg` is the only path that mutates status. The param type omits
  // `status`; strip it at runtime too as belt-and-suspenders against a caller
  // that bypasses the type (e.g. via `as`).
  const { status: _status, ...safeUpdate } = updateData as Partial<NewAgent>;
  const [updated] = await dbClient
    .update(agent)
    .set({ ...safeUpdate, updatedAt: new Date() })
    .where(and(eq(agent.id, agentId), eq(agent.organizationId, organizationId)))
    .returning();
  return updated ?? null;
}

// ── Kill (status → KILLED) ────────────────────────────────────────────────────

export async function killAgentForOrg(
  agentId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<Agent | null> {
  const [killed] = await dbClient
    .update(agent)
    .set({ status: "KILLED", updatedAt: new Date() })
    .where(and(eq(agent.id, agentId), eq(agent.organizationId, organizationId)))
    .returning();
  return killed ?? null;
}

// ── Approval queue ────────────────────────────────────────────────────────────

export async function insertApprovalRequest(
  values: NewAgentApproval,
  dbClient: DbClient = db
): Promise<AgentApproval | null> {
  const [inserted] = await dbClient
    .insert(agentApprovalQueue)
    .values(values)
    .returning();
  return inserted ?? null;
}

export async function listApprovalQueueForOrg(
  organizationId: string,
  status?: AgentApprovalStatus,
  dbClient: DbClient = db
): Promise<AgentApproval[]> {
  return dbClient.query.agentApprovalQueue.findMany({
    where: (q, { and: andOp, eq: eqOp }) =>
      status
        ? andOp(eqOp(q.organizationId, organizationId), eqOp(q.status, status))
        : eqOp(q.organizationId, organizationId),
    orderBy: [desc(agentApprovalQueue.createdAt)],
  });
}

export async function findApprovalForOrg(
  approvalId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<AgentApproval | undefined> {
  return dbClient.query.agentApprovalQueue.findFirst({
    where: (q, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(q.id, approvalId), eqOp(q.organizationId, organizationId)),
  });
}

export async function decideApproval(
  approvalId: string,
  organizationId: string,
  status: AgentApprovalStatus,
  decidedBy: string,
  dbClient: DbClient = db
): Promise<AgentApproval | null> {
  // Atomic transition (COR-1/SEC-4): only a PENDING row can be decided.
  // The status precondition lives in the UPDATE ... WHERE so concurrent
  // deciders race in the database — exactly one wins; the loser gets null.
  const [decided] = await dbClient
    .update(agentApprovalQueue)
    .set({ status, decidedBy, decidedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(agentApprovalQueue.id, approvalId),
        eq(agentApprovalQueue.organizationId, organizationId),
        eq(agentApprovalQueue.status, "PENDING")
      )
    )
    .returning();
  return decided ?? null;
}

export async function markApprovalSent(
  approvalId: string,
  organizationId: string,
  messageId: string,
  dbClient: DbClient = db
): Promise<AgentApproval | null> {
  const [updated] = await dbClient
    .update(agentApprovalQueue)
    .set({ status: "SENT", messageId, updatedAt: new Date() })
    .where(
      and(
        eq(agentApprovalQueue.id, approvalId),
        eq(agentApprovalQueue.organizationId, organizationId),
        eq(agentApprovalQueue.status, "APPROVED")
      )
    )
    .returning();
  return updated ?? null;
}

export async function markApprovalFailed(
  approvalId: string,
  organizationId: string,
  errorMessage: string,
  dbClient: DbClient = db
): Promise<AgentApproval | null> {
  const [updated] = await dbClient
    .update(agentApprovalQueue)
    .set({ status: "FAILED", errorMessage, updatedAt: new Date() })
    .where(
      and(
        eq(agentApprovalQueue.id, approvalId),
        eq(agentApprovalQueue.organizationId, organizationId),
        eq(agentApprovalQueue.status, "APPROVED")
      )
    )
    .returning();
  return updated ?? null;
}
