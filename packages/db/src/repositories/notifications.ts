import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import { member, notification } from "../schema/auth";

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | DrizzleTransaction;

export type NotificationRecord = typeof notification.$inferSelect;

const MAX_FANOUT = 1000;

type NotificationPayload = {
  type: string;
  title: string;
  body?: string;
  href?: string;
  data?: Record<string, unknown>;
};

// ── Notify a single user ─────────────────────────────────────────────────────

export async function notifyUser(
  params: NotificationPayload & { userId: string; organizationId?: string },
  dbClient: DbClient = db
) {
  const [row] = await dbClient
    .insert(notification)
    .values({
      userId: params.userId,
      organizationId: params.organizationId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      href: params.href ?? null,
      data: params.data ?? null,
    })
    .returning();
  return row;
}

// ── Notify all members of an organization (optionally filtered by role) ──────

export async function notifyOrg(
  params: NotificationPayload & {
    organizationId: string;
    roles?: string[];
    excludeUserIds?: string[];
  },
  dbClient: DbClient = db
) {
  const members = await dbClient
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(eq(member.organizationId, params.organizationId))
    .limit(MAX_FANOUT);

  const targets = members.filter((m) => {
    if (params.excludeUserIds?.includes(m.userId)) {
      return false;
    }
    if (!params.roles?.length) {
      return true;
    }
    // better-auth stores multi-role members as a comma-separated list
    return m.role.split(",").some((role) => params.roles?.includes(role));
  });

  if (targets.length === 0) {
    return [];
  }

  return dbClient
    .insert(notification)
    .values(
      targets.map((m) => ({
        userId: m.userId,
        organizationId: params.organizationId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        href: params.href ?? null,
        data: params.data ?? null,
      }))
    )
    .returning();
}

// ── Dedupe guard for recurring detectors (crons, event pipelines) ────────────

export async function hasRecentNotification(
  params: {
    organizationId: string;
    type: string;
    since: Date;
    dataEquals?: { key: string; value: string };
  },
  dbClient: DbClient = db
) {
  const conditions = [
    eq(notification.organizationId, params.organizationId),
    eq(notification.type, params.type),
    gte(notification.createdAt, params.since),
  ];
  if (params.dataEquals) {
    conditions.push(
      sql`${notification.data}->>${params.dataEquals.key} = ${params.dataEquals.value}`
    );
  }
  const rows = await dbClient
    .select({ id: notification.id })
    .from(notification)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

// ── Test/cleanup helper ──────────────────────────────────────────────────────

export async function deleteNotificationsForOrg(
  organizationId: string,
  types?: string[],
  dbClient: DbClient = db
) {
  const conditions = [eq(notification.organizationId, organizationId)];
  if (types?.length) {
    conditions.push(inArray(notification.type, types));
  }
  await dbClient.delete(notification).where(and(...conditions));
}
