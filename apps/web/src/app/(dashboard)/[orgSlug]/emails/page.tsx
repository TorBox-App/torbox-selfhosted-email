import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { messageSend } from "@wraps/db/schema/batch";
import { awsAccount } from "@wraps/db/schema/app";
import { and, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { EmailStatus } from "@/app/(dashboard)/[orgSlug]/emails/types";
import { queryEmailEvents } from "@/lib/aws/dynamodb";
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

// Map SES event types to our EmailStatus
function mapEventTypeToStatus(eventType: string): EmailStatus {
  const mapping: Record<string, EmailStatus> = {
    Send: "sent",
    Delivery: "delivered",
    Open: "opened",
    Click: "clicked",
    Bounce: "bounced",
    Complaint: "complained",
    Reject: "rejected",
    "Rendering Failure": "rendering_failure",
    RenderingFailure: "rendering_failure",
    DeliveryDelay: "delivery_delay",
  };
  return (mapping[eventType] as EmailStatus) || "sent";
}

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

    // Group events by messageId
    const emailsMap = new Map<
      string,
      {
        id: string;
        messageId: string;
        from: string;
        to: string[];
        subject: string;
        status: EmailStatus;
        sentAt: number;
        eventTypes: Set<string>;
        hasOpened: boolean;
        hasClicked: boolean;
      }
    >();

    for (const events of allEvents) {
      for (const event of events) {
        const existing = emailsMap.get(event.messageId);

        if (existing) {
          existing.eventTypes.add(event.eventType);
          if (event.eventType === "Open") {
            existing.hasOpened = true;
          }
          if (event.eventType === "Click") {
            existing.hasClicked = true;
          }

          // Always use the earliest sentAt (should be consistent, but this ensures it)
          if (event.sentAt < existing.sentAt) {
            existing.sentAt = event.sentAt;
          }

          // Update status to most significant event
          const newStatus = mapEventTypeToStatus(event.eventType);
          const statusPriority: EmailStatus[] = [
            "clicked",
            "complained",
            "bounced",
            "opened",
            "delivered",
            "sent",
            "failed",
            "rejected",
            "rendering_failure",
            "delivery_delay",
          ];

          const currentPriority = statusPriority.indexOf(existing.status);
          const newPriority = statusPriority.indexOf(newStatus);

          if (newPriority < currentPriority) {
            existing.status = newStatus;
          }
        } else {
          emailsMap.set(event.messageId, {
            id: event.messageId,
            messageId: event.messageId,
            from: event.from,
            to: event.to,
            subject: event.subject,
            status: mapEventTypeToStatus(event.eventType),
            sentAt: event.sentAt,
            eventTypes: new Set([event.eventType]),
            hasOpened: event.eventType === "Open",
            hasClicked: event.eventType === "Click",
          });
        }
      }
    }

    // Convert to array and sort by sentAt (newest first)
    const emails = Array.from(emailsMap.values())
      .map((email) => ({
        id: email.id,
        messageId: email.messageId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        status: email.status,
        sentAt: email.sentAt,
        eventCount: email.eventTypes.size,
        hasOpened: email.hasOpened,
        hasClicked: email.hasClicked,
      }))
      .sort((a, b) => b.sentAt - a.sentAt)
      .slice(0, limit);

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

  // Fetch actual emails directly
  const emails = await fetchEmails(
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
