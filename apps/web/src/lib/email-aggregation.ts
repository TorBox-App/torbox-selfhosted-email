import type {
  EmailListItem,
  EmailStatus,
} from "@/app/(dashboard)/[orgSlug]/emails/types";
import { isOpenEventBot } from "./email-bot-detection";

function mapEventTypeToStatus(eventType: string): EmailStatus {
  const mapping: Record<string, EmailStatus> = {
    Send: "sent",
    Delivery: "delivered",
    Open: "opened",
    Click: "clicked",
    Bounce: "bounced",
    Suppressed: "suppressed",
    Complaint: "complained",
    Reject: "rejected",
    "Rendering Failure": "rendering_failure",
    RenderingFailure: "rendering_failure",
    DeliveryDelay: "delivery_delay",
  };
  return (mapping[eventType] as EmailStatus) || "sent";
}

type DynamoEmailEvent = {
  messageId: string;
  sentAt: number;
  mailSentAt?: number;
  accountId: string;
  from: string;
  to: string[];
  subject: string;
  eventType: string;
  eventData: string;
  additionalData?: string;
  createdAt: number;
  expiresAt: number;
};

export const STATUS_PRIORITY: EmailStatus[] = [
  "complained",
  "rendering_failure",
  "rejected",
  "failed",
  "suppressed",
  "bounced",
  "clicked",
  "opened",
  "delivery_delay",
  "delivered",
  "sent",
];

/**
 * Identifies messageIds that are missing a "Send" event in the query results.
 * This happens when the time-windowed query only returns engagement events
 * (Open, Click) because the original Send event is outside the window.
 * Returns a map of messageId → accountId (AWS account number) for backfilling.
 */
export function findIncompleteMessageIds(
  allEvents: DynamoEmailEvent[][]
): Map<string, string> {
  const messageIdInfo = new Map<
    string,
    { accountId: string; hasSend: boolean }
  >();

  for (const events of allEvents) {
    for (const event of events) {
      const existing = messageIdInfo.get(event.messageId);
      if (existing) {
        if (event.eventType === "Send") {
          existing.hasSend = true;
        }
      } else {
        messageIdInfo.set(event.messageId, {
          accountId: event.accountId,
          hasSend: event.eventType === "Send",
        });
      }
    }
  }

  const incomplete = new Map<string, string>();
  for (const [messageId, info] of messageIdInfo) {
    if (!info.hasSend) {
      incomplete.set(messageId, info.accountId);
    }
  }
  return incomplete;
}

export function aggregateEmailEvents(
  allEvents: DynamoEmailEvent[][]
): EmailListItem[] {
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
      lastActivityAt: number;
    }
  >();

  for (const events of allEvents) {
    for (const event of events) {
      const isBot =
        event.eventType === "Open" && isOpenEventBot(event.additionalData);
      const existing = emailsMap.get(event.messageId);
      const originalSentAt = event.mailSentAt ?? event.sentAt;

      if (existing) {
        existing.eventTypes.add(event.eventType);
        if (event.eventType === "Open" && !isBot) {
          existing.hasOpened = true;
        }
        if (event.eventType === "Click") {
          existing.hasClicked = true;
        }

        if (originalSentAt < existing.sentAt) {
          existing.sentAt = originalSentAt;
        }

        if (event.createdAt > existing.lastActivityAt) {
          existing.lastActivityAt = event.createdAt;
        }

        // Don't promote status for bot opens
        if (!(event.eventType === "Open" && isBot)) {
          const newStatus = mapEventTypeToStatus(event.eventType);
          const currentPriority = STATUS_PRIORITY.indexOf(existing.status);
          const newPriority = STATUS_PRIORITY.indexOf(newStatus);
          if (newPriority < currentPriority) {
            existing.status = newStatus;
          }
        }
      } else {
        emailsMap.set(event.messageId, {
          id: event.messageId,
          messageId: event.messageId,
          from: event.from,
          to: event.to,
          subject: event.subject,
          status:
            event.eventType === "Open" && isBot
              ? "delivered"
              : mapEventTypeToStatus(event.eventType),
          sentAt: originalSentAt,
          eventTypes: new Set([event.eventType]),
          hasOpened: event.eventType === "Open" && !isBot,
          hasClicked: event.eventType === "Click",
          lastActivityAt: event.createdAt,
        });
      }
    }
  }

  return Array.from(emailsMap.values())
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
      lastActivityAt: email.lastActivityAt,
    }))
    .sort((a, b) => b.sentAt - a.sentAt);
}
