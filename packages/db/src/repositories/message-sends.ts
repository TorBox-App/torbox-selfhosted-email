import { and, count, desc, eq, lt } from "drizzle-orm";
import { db } from "../index";
import type { MessageSend, MessageSendStatus } from "../schema/batch";
import { messageSend } from "../schema/batch";
import type { DbClient } from "./events";

export type EmailLogFilters = {
  status?: MessageSendStatus;
  cursor?: string;
  limit?: number;
};

const EMAIL_LOG_LIST_FIELDS = {
  id: messageSend.id,
  messageId: messageSend.messageId,
  status: messageSend.status,
  recipient: messageSend.recipient,
  subject: messageSend.subject,
  from: messageSend.from,
  sourceType: messageSend.sourceType,
  sentAt: messageSend.sentAt,
  deliveredAt: messageSend.deliveredAt,
  bouncedAt: messageSend.bouncedAt,
  bouncedSubType: messageSend.bounceSubType,
  createdAt: messageSend.createdAt,
};

export type EmailLogListItem = {
  id: string;
  messageId: string | null;
  status: MessageSendStatus;
  recipient: string;
  subject: string | null;
  from: string | null;
  sourceType: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  bouncedSubType: string | null;
  createdAt: Date;
};

function buildConditions(organizationId: string, filters: EmailLogFilters) {
  const conditions: ReturnType<typeof eq>[] = [
    eq(messageSend.organizationId, organizationId),
  ];
  if (filters.status) {
    conditions.push(eq(messageSend.status, filters.status));
  }
  return conditions;
}

export async function listEmailLogs(
  organizationId: string,
  filters: EmailLogFilters,
  dbClient: DbClient = db
): Promise<{
  logs: EmailLogListItem[];
  total: number | null;
  nextCursor: string | null;
}> {
  const limit = Math.min(filters.limit ?? 20, 100);
  const conditions = buildConditions(organizationId, filters);

  // Skip the count on cursor pages — it's already known from the first page
  // and avoids an extra full-table scan for large orgs.
  const total = filters.cursor
    ? null
    : Number(
        (
          await dbClient
            .select({ count: count() })
            .from(messageSend)
            .where(and(...conditions))
        )[0]?.count ?? 0
      );

  const cursorConditions = [...conditions];
  if (filters.cursor) {
    cursorConditions.push(
      lt(messageSend.createdAt, new Date(filters.cursor)) as never
    );
  }

  const rows = await dbClient
    .select(EMAIL_LOG_LIST_FIELDS)
    .from(messageSend)
    .where(and(...cursorConditions))
    .orderBy(desc(messageSend.createdAt))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const logs = (
    hasNextPage ? rows.slice(0, limit) : rows
  ) as EmailLogListItem[];
  const lastLog = logs.at(-1);
  const nextCursor =
    hasNextPage && lastLog ? (lastLog.createdAt as Date).toISOString() : null;

  return { logs, total, nextCursor };
}

export async function getEmailLogByMessageId(
  messageId: string,
  organizationId: string,
  dbClient: DbClient = db
): Promise<MessageSend | null> {
  const [row] = await dbClient
    .select()
    .from(messageSend)
    .where(
      and(
        eq(messageSend.messageId, messageId),
        eq(messageSend.organizationId, organizationId)
      )
    )
    .limit(1);

  return row ?? null;
}
