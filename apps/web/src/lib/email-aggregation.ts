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

const STATUS_PRIORITY: EmailStatus[] = [
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
    }
  >();

  for (const events of allEvents) {
    for (const event of events) {
      const isBot =
        event.eventType === "Open" && isOpenEventBot(event.additionalData);
      const existing = emailsMap.get(event.messageId);

      if (existing) {
        existing.eventTypes.add(event.eventType);
        if (event.eventType === "Open" && !isBot) {
          existing.hasOpened = true;
        }
        if (event.eventType === "Click") {
          existing.hasClicked = true;
        }

        if (event.sentAt < existing.sentAt) {
          existing.sentAt = event.sentAt;
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
          sentAt: event.sentAt,
          eventTypes: new Set([event.eventType]),
          hasOpened: event.eventType === "Open" && !isBot,
          hasClicked: event.eventType === "Click",
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
    }))
    .sort((a, b) => b.sentAt - a.sentAt);
}
