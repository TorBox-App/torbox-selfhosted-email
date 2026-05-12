import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { awsAccount } from "@wraps/db/schema/app";
import { messageSend } from "@wraps/db/schema/batch";
import { Badge } from "@wraps/ui/components/ui/badge";
import { Card, CardContent } from "@wraps/ui/components/ui/card";
import { and, eq, or } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailArchiveViewer } from "@/components/email-archive-viewer";
import { Button } from "@/components/ui/button";
import { queryEmailEvents, queryEventsByMessageIds } from "@/lib/aws/dynamodb";
import { isOpenEventBot } from "@/lib/email-bot-detection";
import { logger } from "@/lib/logger";
import { getOrganizationWithMembership } from "@/lib/organization";
import type { Email, EmailStatus } from "../types";
import { CopyButton } from "./components/copy-button";
import { EmailFields } from "./components/email-fields";
import { EventItem } from "./components/event-item";
import { EventTimeline } from "./components/event-timeline";

type EmailDetailPageProps = {
  params: Promise<{
    orgSlug: string;
    emailId: string;
  }>;
};

const EVENT_COLORS: Record<EmailStatus, string> = {
  sent: "text-blue-500",
  delivered: "text-green-500",
  bounced: "text-red-500",
  complained: "text-red-500",
  opened: "text-purple-500",
  clicked: "text-indigo-500",
  failed: "text-red-500",
  rejected: "text-red-500",
  rendering_failure: "text-red-500",
  delivery_delay: "text-yellow-500",
  suppressed: "text-amber-500",
};

const STATUS_VARIANTS: Record<
  EmailStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  delivered: "default",
  sent: "secondary",
  bounced: "destructive",
  complained: "destructive",
  failed: "destructive",
  opened: "default",
  clicked: "default",
  rejected: "destructive",
  rendering_failure: "destructive",
  delivery_delay: "secondary",
  suppressed: "destructive",
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
    Suppressed: "suppressed",
  };
  return (mapping[eventType] as EmailStatus) || "sent";
}

function pgStatusToEmailStatus(status: string | null | undefined): EmailStatus {
  switch (status) {
    case "pending":
    case "queued":
      return "sent";
    case "opted_out":
      return "suppressed";
    default:
      return (status as EmailStatus) ?? "sent";
  }
}

function buildEmailFromEvents(
  emailId: string,
  emailEvents: any[],
  archivingEnabled: boolean
): Email & { archivingEnabled: boolean } {
  const statusPriority: EmailStatus[] = [
    "complained",
    "rendering_failure",
    "rejected",
    "failed",
    "bounced",
    "suppressed",
    "clicked",
    "opened",
    "delivery_delay",
    "delivered",
    "sent",
  ];

  let finalStatus: EmailStatus = "sent";
  let currentPriority = statusPriority.indexOf(finalStatus);

  for (const event of emailEvents) {
    if (event.eventType === "Open" && isOpenEventBot(event.additionalData)) {
      continue;
    }
    const eventStatus = mapEventTypeToStatus(event.eventType);
    const eventPriority = statusPriority.indexOf(eventStatus);
    if (eventPriority < currentPriority) {
      finalStatus = eventStatus;
      currentPriority = eventPriority;
    }
  }

  const firstEvent = emailEvents[0];
  return {
    id: emailId,
    messageId: emailId,
    from: firstEvent.from,
    to: firstEvent.to,
    replyTo: undefined,
    subject: firstEvent.subject,
    htmlBody: firstEvent.additionalData
      ? (() => {
          try {
            const data = JSON.parse(firstEvent.additionalData);
            return data.htmlBody || data.textBody || undefined;
          } catch {
            return;
          }
        })()
      : undefined,
    textBody: undefined,
    status: finalStatus,
    sentAt: firstEvent.mailSentAt ?? firstEvent.sentAt,
    archivingEnabled,
    events: emailEvents.map((event) => ({
      type: event.eventType.toLowerCase().replace(/ /g, "_") as EmailStatus,
      timestamp: event.createdAt,
      metadata: event.additionalData
        ? (() => {
            try {
              return JSON.parse(event.additionalData);
            } catch {
              return {};
            }
          })()
        : {},
    })),
  };
}

async function fetchEmail(
  organizationId: string,
  emailId: string
): Promise<(Email & { archivingEnabled: boolean }) | null> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 90 * 24 * 60 * 60 * 1000);

    const accounts = await db.query.awsAccount.findMany({
      where: eq(awsAccount.organizationId, organizationId),
    });

    if (accounts.length === 0) {
      return null;
    }

    // Step 1: time-windowed DynamoDB query (fast path for recent emails)
    const allEventsWithAccount = await Promise.all(
      accounts.map(async (account) => {
        try {
          const events = await queryEmailEvents({
            awsAccountId: account.id,
            startTime,
            endTime,
            limit: 1000,
          });
          return { account, events };
        } catch {
          return { account, events: [] };
        }
      })
    );

    let emailAccount: (typeof accounts)[0] | null = null;
    let emailEvents: any[] = [];

    for (const { account, events } of allEventsWithAccount) {
      const matchingEvents = events.filter((e) => e.messageId === emailId);
      if (matchingEvents.length > 0) {
        emailAccount = account;
        emailEvents = matchingEvents;
        break;
      }
    }

    if (emailEvents.length > 0 && emailAccount) {
      emailEvents.sort((a, b) => a.sentAt - b.sentAt);
      return buildEmailFromEvents(
        emailId,
        emailEvents,
        emailAccount.features?.email?.archivingEnabled ?? false
      );
    }

    // Step 2: look up the PG record to get the canonical messageId and account.
    // Handles two cases:
    //  a) emailId is the PG UUID (old emails whose messageId wasn't set)
    //  b) emailId is the SES messageId but the email is older than 90 days
    const pgRecord = await db
      .select({
        id: messageSend.id,
        messageId: messageSend.messageId,
        awsAccountId: messageSend.awsAccountId,
        from: messageSend.from,
        recipient: messageSend.recipient,
        subject: messageSend.subject,
        status: messageSend.status,
        sentAt: messageSend.sentAt,
      })
      .from(messageSend)
      .where(
        and(
          eq(messageSend.organizationId, organizationId),
          eq(messageSend.channel, "email"),
          or(eq(messageSend.id, emailId), eq(messageSend.messageId, emailId))
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!pgRecord) {
      return null;
    }

    // Step 3: try a direct DynamoDB PK lookup (no time window) using the real messageId
    const realMessageId = pgRecord.messageId ?? emailId;
    const pgAccount = accounts.find((a) => a.id === pgRecord.awsAccountId);

    if (pgAccount) {
      try {
        const dynEvents = await queryEventsByMessageIds({
          awsAccountId: pgAccount.id,
          messageIds: [realMessageId],
        });
        if (dynEvents.length > 0) {
          dynEvents.sort((a, b) => a.sentAt - b.sentAt);
          return buildEmailFromEvents(
            realMessageId,
            dynEvents,
            pgAccount.features?.email?.archivingEnabled ?? false
          );
        }
      } catch {
        // fall through to PG-only
      }
    }

    // Step 4: PG-only fallback — show whatever metadata we have
    if (!pgRecord.sentAt) {
      return null;
    }
    return {
      id: emailId,
      messageId: realMessageId,
      from: pgRecord.from ?? "",
      to: [pgRecord.recipient],
      replyTo: undefined,
      subject: pgRecord.subject ?? "(no subject)",
      htmlBody: undefined,
      textBody: undefined,
      status: pgStatusToEmailStatus(pgRecord.status),
      sentAt: pgRecord.sentAt.getTime(),
      archivingEnabled: false,
      events: [],
    };
  } catch (error) {
    logger.error({ err: error }, "fetchEmail failed");
    return null;
  }
}

function _formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFullTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default async function EmailDetailPage({
  params,
}: EmailDetailPageProps) {
  const { orgSlug, emailId } = await params;
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

  // Fetch actual email directly (not via API to avoid auth issues)
  const email = await fetchEmail(orgWithMembership.id, emailId);

  // If email not found, redirect back to emails list
  if (!email) {
    redirect(`/${orgSlug}/emails`);
  }

  return (
    <>
      {/* Back Button */}
      <div className="px-4 lg:px-6">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/${orgSlug}/emails`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to emails
          </Link>
        </Button>
      </div>

      {/* Page Content */}
      <div className="space-y-6 px-4 lg:px-6">
        {/* Email Envelope Hero - Compact */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Subject Line & Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="mb-2 font-bold text-2xl">{email.subject}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                    <span>{formatFullTimestamp(email.sentAt)}</span>
                    <span>•</span>
                    <div className="flex min-w-0 max-w-full flex-row items-center gap-1">
                      <code className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {email.messageId}
                      </code>
                      <CopyButton text={email.messageId} />
                    </div>
                  </div>
                </div>
                <Badge
                  className="font-medium"
                  variant={STATUS_VARIANTS[email.status]}
                >
                  {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                </Badge>
              </div>

              {/* To/From - Compact Grid */}
              <EmailFields
                from={email.from}
                organizationId={orgWithMembership.id}
                to={email.to}
              />
            </div>
          </CardContent>
        </Card>

        {/* Event Timeline - Collapsible */}
        <EventTimeline eventCount={email.events.length}>
          {email.events.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              No events recorded yet
            </div>
          ) : (
            email.events.map((event, index) => (
              <EventItem
                color={EVENT_COLORS[event.type]}
                event={event}
                iconType={event.type}
                isLast={index === email.events.length - 1}
                key={`${event.type}-${event.timestamp}`}
              />
            ))
          )}
        </EventTimeline>

        {/* Email Archive Viewer - only show if archiving is enabled */}
        {email.archivingEnabled && (
          <EmailArchiveViewer
            archivingEnabled={email.archivingEnabled}
            messageId={email.messageId}
            orgSlug={orgSlug}
          />
        )}
      </div>
    </>
  );
}
