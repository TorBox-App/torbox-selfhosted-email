import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { messageSend } from "@wraps/db/schema/batch";
import { and, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import type { EmailStatus } from "@/app/(dashboard)/[orgSlug]/emails/types";
import { queryEmailEvents } from "@/lib/aws/dynamodb";
import { aggregateEmailEvents } from "@/lib/email-aggregation";
import { getOrganizationWithMembership } from "@/lib/organization";
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

    // Group events by messageId, filtering out bot opens
    const emails = aggregateEmailEvents(allEvents).slice(0, limit);

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
