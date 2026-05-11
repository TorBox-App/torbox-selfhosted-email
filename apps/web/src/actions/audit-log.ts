"use server";

import { auditLog, db } from "@wraps/db";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import {
  type AuditLogAction,
  auditLogEntry,
  getAuditContext,
} from "@/lib/audit";
import { createActionLogger, serializeError } from "@/lib/logger";
import { getOrganizationPlan } from "@/lib/plan-limits";
import { getHistoryRetentionDays } from "@/lib/plans";
import { verifyOrgAccess } from "./shared/verify-org-access";

export type { AuditLogAction } from "@/lib/audit";

export async function writeAuditLog(params: {
  organizationId: string;
  actorId: string;
  actorEmail: string;
  action: AuditLogAction;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const log = createActionLogger("writeAuditLog", {
    orgSlug: params.organizationId,
  });
  try {
    const ctx = await getAuditContext();
    await db.insert(auditLog).values(auditLogEntry(ctx, params));
  } catch (error) {
    log.error({ err: serializeError(error) }, "Failed to write audit log");
  }
}

export type ListAuditLogsResult =
  | {
      success: true;
      data: (typeof auditLog.$inferSelect)[];
      nextCursor: string | null;
    }
  | { success: false; error: string };

export async function listAuditLogs(
  organizationId: string,
  opts?: {
    cursor?: string;
    limit?: number;
    filter?: {
      action?: AuditLogAction;
      actorId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    };
  }
): Promise<ListAuditLogsResult> {
  const access = await verifyOrgAccess(organizationId);
  if (!access) return { success: false, error: "Unauthorized" };

  if (access.role !== "owner" && access.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const planId = await getOrganizationPlan(organizationId);
  const retentionDays = getHistoryRetentionDays(planId);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const limit = opts?.limit ?? 50;
  const filter = opts?.filter;

  const conditions = [
    eq(auditLog.organizationId, organizationId),
    gte(auditLog.createdAt, cutoff),
  ];

  if (filter?.action) {
    conditions.push(eq(auditLog.action, filter.action));
  }

  if (filter?.actorId) {
    conditions.push(eq(auditLog.userId, filter.actorId));
  }

  if (filter?.dateFrom) {
    conditions.push(gte(auditLog.createdAt, filter.dateFrom));
  }

  if (filter?.dateTo) {
    conditions.push(lt(auditLog.createdAt, filter.dateTo));
  }

  if (opts?.cursor) {
    conditions.push(lt(auditLog.createdAt, new Date(opts.cursor)));
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && data.length > 0 ? data.at(-1)!.createdAt.toISOString() : null;

  return { success: true, data, nextCursor };
}
