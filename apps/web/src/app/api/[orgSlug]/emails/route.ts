import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { messageSend } from "@wraps/db/schema/batch";
import { and, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { EmailStatus } from "@/app/(dashboard)/[orgSlug]/emails/types";
import { queryEmailEvents, queryEventsByMessageIds } from "@/lib/aws/dynamodb";
import {
  aggregateEmailEvents,
  findIncompleteMessageIds,
} from "@/lib/email-aggregation";
import { createRequestLogger, serializeError } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify organization membership
    const orgWithMembership = await getOrganizationWithMembership(
      orgSlug,
      session.user.id
    );

    if (!orgWithMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const days = Math.min(
      365,
      Math.max(1, Number.parseInt(searchParams.get("days") || "7", 10))
    );
    const limit = Math.min(
      500,
      Math.max(1, Number.parseInt(searchParams.get("limit") || "100", 10))
    );

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

    // Get all AWS accounts for this organization
    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, orgWithMembership.id),
    });

    if (accounts.length === 0) {
      return NextResponse.json([]);
    }

    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails",
      method: "GET",
      orgSlug,
    });

    // Fetch email events from all accounts (time-windowed via GSI)
    const allEvents = await Promise.all(
      accounts.map(async (account) => {
        try {
          return await queryEmailEvents({
            awsAccountId: account.id,
            startTime,
            endTime,
            limit: 500,
          });
        } catch (error) {
          log.error(
            { err: serializeError(error), accountId: account.id },
            "Failed to fetch emails for account"
          );
          return [];
        }
      })
    );

    // Backfill complete events for messages missing their Send event.
    // The time-windowed query may only return engagement events (Open/Click)
    // for old emails, missing the original Send/Delivery events.
    const incomplete = findIncompleteMessageIds(allEvents);

    if (incomplete.size > 0) {
      // Map AWS account numbers back to internal DB IDs
      const accountsByNumber = new Map(
        accounts.map((a) => [a.accountId, a.id])
      );

      // Group incomplete messageIds by account
      const byAccount = new Map<string, string[]>();
      for (const [messageId, awsAccountNumber] of incomplete) {
        const internalId = accountsByNumber.get(awsAccountNumber);
        if (internalId) {
          const existing = byAccount.get(internalId) || [];
          existing.push(messageId);
          byAccount.set(internalId, existing);
        }
      }

      // Query complete event history for each account's incomplete messages
      const backfilled = await Promise.all(
        [...byAccount.entries()].map(async ([awsAccountId, messageIds]) => {
          try {
            return await queryEventsByMessageIds({ awsAccountId, messageIds });
          } catch (error) {
            log.error(
              { err: serializeError(error), awsAccountId },
              "Failed to backfill events"
            );
            return [];
          }
        })
      );

      for (const events of backfilled) {
        allEvents.push(events);
      }
    }

    // Aggregate DynamoDB events
    const emails = aggregateEmailEvents(allEvents).slice(0, limit);

    // Query PostgreSQL for all messages in the time window.
    // Used to both enrich authoritative sentAt on DynamoDB records AND fill in
    // any messages that exist in PG but are missing from DynamoDB (e.g. when
    // DynamoDB has older events but the Lambda hasn't written the newest sends yet).
    const pgEmails = await db
      .select({
        id: messageSend.id,
        messageId: messageSend.messageId,
        from: messageSend.from,
        recipient: messageSend.recipient,
        subject: messageSend.subject,
        status: messageSend.status,
        sentAt: messageSend.sentAt,
        openedAt: messageSend.openedAt,
        clickedAt: messageSend.clickedAt,
      })
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, orgWithMembership.id),
          eq(messageSend.channel, "email"),
          isNotNull(messageSend.sentAt),
          gte(messageSend.sentAt, startTime),
          lte(messageSend.sentAt, endTime)
        )
      )
      .orderBy(desc(messageSend.sentAt))
      .limit(limit);

    const pgByMessageId = new Map(
      pgEmails
        .filter((r) => r.messageId && r.sentAt)
        .map((r) => [r.messageId!, r])
    );

    // Enrich sentAt for existing DynamoDB entries (authoritative PG timestamp)
    const dynamoMessageIds = new Set<string>();
    for (const email of emails) {
      dynamoMessageIds.add(email.messageId);
      const pg = pgByMessageId.get(email.messageId);
      if (pg?.sentAt) {
        const authoritative = pg.sentAt.getTime();
        if (authoritative < email.sentAt) {
          email.sentAt = authoritative;
        }
      }
    }

    // Add PG records not present in DynamoDB results
    let addedFromPg = false;
    for (const pg of pgEmails) {
      const msgId = pg.messageId ?? pg.id;
      if (dynamoMessageIds.has(msgId)) continue;
      emails.push({
        id: pg.id,
        messageId: msgId,
        from: pg.from ?? "",
        to: [pg.recipient],
        subject: pg.subject ?? "(no subject)",
        status: (pg.status as EmailStatus) ?? "sent",
        sentAt: pg.sentAt!.getTime(),
        lastActivityAt:
          pg.clickedAt?.getTime() ??
          pg.openedAt?.getTime() ??
          pg.sentAt!.getTime(),
        eventCount: 1,
        hasOpened: !!pg.openedAt,
        hasClicked: !!pg.clickedAt,
      });
      addedFromPg = true;
    }

    if (addedFromPg) {
      emails.sort((a, b) => b.sentAt - a.sentAt);
    }

    return NextResponse.json(emails.slice(0, limit));
  } catch (error) {
    const log = createRequestLogger({
      path: "/api/[orgSlug]/emails",
      method: "GET",
    });
    log.error({ err: serializeError(error) }, "Error fetching emails");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
