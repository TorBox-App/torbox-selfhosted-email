import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { messageSend } from "@wraps/db/schema/batch";
import { and, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { Mail } from "lucide-react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { EmailStatus } from "@/app/(dashboard)/[orgSlug]/emails/types";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { queryEmailEvents, queryEventsByMessageIds } from "@/lib/aws/dynamodb";
import {
  aggregateEmailEvents,
  findIncompleteMessageIds,
} from "@/lib/email-aggregation";
import { getOrganizationWithMembership } from "@/lib/organization";
import { checkHasAwsAccounts } from "@/lib/setup-status";
import { EmailAnalytics } from "./components/email-analytics";
import { EmailsTable } from "./components/emails-table";
import type { EmailListItem } from "./types";

type EmailsPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
  searchParams: Promise<{
    days?: string;
    limit?: string;
  }>;
};

async function fetchEmails(
  organizationId: string,
  days = 7,
  limit = 100
): Promise<EmailListItem[]> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

    // Get all AWS accounts for this organization
    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, organizationId),
    });

    if (accounts.length === 0) {
      return [];
    }

    // Fetch email events from all accounts
    const allEvents = await Promise.all(
      accounts.map(async (account) => {
        try {
          return await queryEmailEvents({
            awsAccountId: account.id,
            startTime,
            endTime,
            limit: 500, // Get more to aggregate by message
          });
        } catch (error) {
          // Log detailed error for debugging role assumption issues
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[fetchEmails] Failed to fetch emails for account ${account.id} (${account.accountId}):`,
            {
              error: errorMessage,
              roleArn: account.roleArn,
              region: account.region,
              hasExternalId: !!account.externalId,
            }
          );
          return [];
        }
      })
    );

    // Backfill complete events for messages missing their Send event.
    // The time-windowed GSI query may only return engagement events (Open/Click)
    // for old emails, missing the original Send/Delivery events.
    const incomplete = findIncompleteMessageIds(allEvents);

    if (incomplete.size > 0) {
      const accountsByNumber = new Map(
        accounts.map((a) => [a.accountId, a.id])
      );

      const byAccount = new Map<string, string[]>();
      for (const [messageId, awsAccountNumber] of incomplete) {
        const internalId = accountsByNumber.get(awsAccountNumber);
        if (internalId) {
          const existing = byAccount.get(internalId) || [];
          existing.push(messageId);
          byAccount.set(internalId, existing);
        }
      }

      const backfilled = await Promise.all(
        [...byAccount.entries()].map(async ([awsAccountId, messageIds]) => {
          try {
            return await queryEventsByMessageIds({ awsAccountId, messageIds });
          } catch {
            return [];
          }
        })
      );

      for (const events of backfilled) {
        allEvents.push(events);
      }
    }

    // Group events by messageId, filtering out bot opens
    const emails = aggregateEmailEvents(allEvents).slice(0, limit);

    // Enrich with authoritative sentAt from PostgreSQL.
    // DynamoDB Send events may be TTL-expired, leaving only engagement events
    // with incorrect timestamps. The message_send table always has the real sentAt.
    const messageIds = emails.map((e) => e.messageId).filter(Boolean);
    if (messageIds.length > 0) {
      const pgRecords = await db
        .select({
          messageId: messageSend.messageId,
          sentAt: messageSend.sentAt,
        })
        .from(messageSend)
        .where(
          and(
            eq(messageSend.organizationId, organizationId),
            inArray(messageSend.messageId, messageIds)
          )
        );

      const pgSentAt = new Map(
        pgRecords
          .filter((r) => r.messageId && r.sentAt)
          .map((r) => [r.messageId, r.sentAt?.getTime()])
      );

      for (const email of emails) {
        const authoritative = pgSentAt.get(email.messageId);
        if (authoritative && authoritative < email.sentAt) {
          email.sentAt = authoritative;
        }
      }
    }

    // If DynamoDB returned no data, fall back to PostgreSQL messageSend table
    if (emails.length === 0) {
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
            eq(messageSend.organizationId, organizationId),
            eq(messageSend.channel, "email"),
            isNotNull(messageSend.sentAt),
            gte(messageSend.sentAt, startTime),
            lte(messageSend.sentAt, endTime)
          )
        )
        .orderBy(desc(messageSend.sentAt))
        .limit(limit);

      return pgEmails.map((e) => ({
        id: e.id,
        messageId: e.messageId ?? e.id,
        from: e.from ?? "",
        to: [e.recipient],
        subject: e.subject ?? "(no subject)",
        status: (e.status as EmailStatus) ?? "sent",
        sentAt: e.sentAt?.getTime() ?? 0,
        lastActivityAt:
          e.clickedAt?.getTime() ??
          e.openedAt?.getTime() ??
          e.sentAt?.getTime() ??
          0,
        eventCount: 1,
        hasOpened: !!e.openedAt,
        hasClicked: !!e.clickedAt,
      }));
    }

    return emails;
  } catch (error) {
    console.error("[fetchEmails] Error fetching emails:", error);
    return [];
  }
}

export default async function EmailsPage({
  params,
  searchParams,
}: EmailsPageProps) {
  const { orgSlug } = await params;
  const { days = "7", limit = "100" } = await searchParams;

  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    redirect("/");
  }

  // Check if org has any AWS accounts before fetching
  const hasAccounts = await checkHasAwsAccounts(orgWithMembership.id);

  if (!hasAccounts) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 lg:p-6">
        <Empty className="max-w-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Mail className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Email Activity</EmptyTitle>
            <EmptyDescription>
              See every email your application sends — delivery status, opens,
              clicks, and bounces in real time.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/${orgSlug}/setup`}>
                  Connect AWS to start sending
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <a
                  href="https://docs.wraps.dev/email"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View documentation
                </a>
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const getCachedEmails = unstable_cache(
    fetchEmails,
    [`emails-${orgWithMembership.id}`],
    { revalidate: 60, tags: [`emails-${orgWithMembership.id}`] }
  );

  const emails = await getCachedEmails(
    orgWithMembership.id,
    Number.parseInt(days, 10),
    Number.parseInt(limit, 10)
  );

  return (
    <>
      {/* Email Analytics */}
      <div className="px-4 lg:px-6">
        <EmailAnalytics orgSlug={orgSlug} />
      </div>

      {/* Emails Table */}
      <div className="@container/main px-4 lg:px-6">
        <EmailsTable
          data={emails}
          days={Number.parseInt(days, 10)}
          organizationId={orgWithMembership.id}
          orgSlug={orgSlug}
        />
      </div>
    </>
  );
}
