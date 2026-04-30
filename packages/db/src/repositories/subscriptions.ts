import { eq } from "drizzle-orm";
import { db } from "../index";
import { subscription } from "../schema/auth";

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | DrizzleTransaction;

export type SubscriptionRecord = typeof subscription.$inferSelect;

export async function getActiveSubscription(
  organizationId: string,
  dbClient: DbClient = db
): Promise<SubscriptionRecord | null> {
  const [result] = await dbClient
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, organizationId))
    .limit(1);
  return result ?? null;
}

export async function createFreeSubscription(
  organizationId: string,
  userId: string,
  dbClient: DbClient = db
): Promise<SubscriptionRecord> {
  const now = new Date();
  const [created] = await dbClient
    .insert(subscription)
    .values({
      id: crypto.randomUUID(),
      plan: "free",
      referenceId: organizationId,
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      seats: 1,
      annual: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
}
