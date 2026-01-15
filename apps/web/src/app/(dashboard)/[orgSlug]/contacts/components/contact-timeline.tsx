"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  Megaphone,
  MessageSquare,
  Play,
  UserPlus,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  getContactTimeline,
  type MessageStatusTimestamps,
  type TimelineEvent,
  type TimelineEventType,
} from "@/actions/contacts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ContactTimelineProps = {
  contactId: string;
  organizationId: string;
  orgSlug: string;
};

// Config for non-message event types
const EVENT_CONFIG: Record<
  Exclude<TimelineEventType, "message">,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  workflow_started: {
    icon: Play,
    label: "Automation started",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
  workflow_completed: {
    icon: CheckCircle2,
    label: "Automation completed",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  workflow_failed: {
    icon: XCircle,
    label: "Automation failed",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  contact_created: {
    icon: UserPlus,
    label: "Contact created",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  custom_event: {
    icon: Zap,
    label: "Event",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
};

// Status dot configuration for message events
const STATUS_DOT_CONFIG = {
  sent: {
    color: "bg-blue-500",
    label: "Sent",
  },
  delivered: {
    color: "bg-green-500",
    label: "Delivered",
  },
  opened: {
    color: "bg-purple-500",
    label: "Opened",
  },
  clicked: {
    color: "bg-indigo-500",
    label: "Clicked",
  },
  bounced: {
    color: "bg-red-500",
    label: "Bounced",
  },
  complained: {
    color: "bg-orange-500",
    label: "Spam complaint",
  },
  optedOut: {
    color: "bg-red-500",
    label: "Opted out",
  },
} as const;

// Get display config for message events based on source type
function getMessageDisplay(event: TimelineEvent): {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
} {
  const isEmail = event.channel === "email";
  const channelLabel = isEmail ? "Email" : "SMS";

  if (event.sourceType === "batch") {
    return {
      icon: Megaphone,
      label: "Broadcast",
      color: "text-violet-600",
      bgColor: "bg-violet-100",
    };
  }
  if (event.sourceType === "workflow") {
    return {
      icon: Workflow,
      label: `Automation ${channelLabel.toLowerCase()}`,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    };
  }
  // Transactional
  return {
    icon: isEmail ? Mail : MessageSquare,
    label: channelLabel,
    color: isEmail ? "text-blue-600" : "text-emerald-600",
    bgColor: isEmail ? "bg-blue-100" : "bg-emerald-100",
  };
}

function formatTimestampShort(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Status dots component for message delivery status
function StatusDots({
  status,
  channel,
}: {
  status: MessageStatusTimestamps;
  channel: "email" | "sms";
}) {
  // Determine which statuses to show based on channel
  const emailStatuses = [
    { key: "sent", timestamp: status.sentAt },
    { key: "delivered", timestamp: status.deliveredAt },
    { key: "opened", timestamp: status.openedAt },
    { key: "clicked", timestamp: status.clickedAt },
    { key: "bounced", timestamp: status.bouncedAt },
    { key: "complained", timestamp: status.complainedAt },
  ] as const;

  const smsStatuses = [
    { key: "sent", timestamp: status.sentAt },
    { key: "delivered", timestamp: status.deliveredAt },
    { key: "clicked", timestamp: status.clickedAt },
    { key: "optedOut", timestamp: status.optedOutAt },
  ] as const;

  const statuses = channel === "email" ? emailStatuses : smsStatuses;
  const activeStatuses = statuses.filter((s) => s.timestamp);

  if (activeStatuses.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {activeStatuses.map(({ key, timestamp }) => {
        const config = STATUS_DOT_CONFIG[key];
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  config.color
                )}
              />
            </TooltipTrigger>
            <TooltipContent className="text-xs" side="top">
              <span className="font-medium">{config.label}</span>
              {timestamp && (
                <span className="ml-1 text-muted-foreground">
                  {formatTimestampShort(new Date(timestamp))}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function TimelineEventRow({
  event,
  orgSlug,
}: {
  event: TimelineEvent;
  orgSlug: string;
}) {
  // Handle message events differently
  if (event.type === "message" && event.channel && event.status) {
    const config = getMessageDisplay(event);
    const Icon = config.icon;

    // Build detail text and link
    let detailText: string | null = null;
    let detailLink: string | null = null;

    if (event.sourceType === "batch" && event.batchName) {
      detailText = event.batchName;
    } else if (event.sourceType === "workflow" && event.workflowName) {
      detailText = event.workflowName;
    } else if (event.subject) {
      detailText = event.subject;
    }

    // Link to individual email if we have a messageId
    if (event.messageId && event.channel === "email") {
      detailLink = `/${orgSlug}/emails/${event.messageId}`;
    }

    return (
      <div className="group flex items-start gap-3 py-2">
        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            config.bgColor
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", config.color)} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{config.label}</span>
            <StatusDots channel={event.channel} status={event.status} />
            <span className="text-muted-foreground text-xs">
              {formatTimestamp(new Date(event.timestamp))}
            </span>
          </div>

          {detailText && (
            <div className="mt-0.5 flex items-center gap-1">
              {detailLink ? (
                <Link
                  className="flex items-center gap-1 truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
                  href={detailLink}
                >
                  <span className="truncate">{detailText}</span>
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ) : (
                <span className="truncate text-muted-foreground text-xs">
                  {detailText}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Handle workflow and contact_created events
  const config =
    EVENT_CONFIG[event.type as Exclude<TimelineEventType, "message">];
  if (!config) {
    return null;
  }

  const Icon = config.icon;

  // Build detail text and link for workflow events and custom events
  let detailText: string | null = null;
  let detailLink: string | null = null;

  if (event.type.startsWith("workflow_")) {
    detailText = event.workflowName || "Workflow";
    if (event.workflowId) {
      detailLink = `/${orgSlug}/automations/${event.workflowId}`;
    }
    // Show event trigger if available
    if (event.eventName && event.type === "workflow_started") {
      detailText = `${event.workflowName} (${event.eventName})`;
    }
  }

  // For custom events, show the event name as detail text and link to events page
  if (event.type === "custom_event" && event.eventName) {
    detailText = event.eventName;
    detailLink = `/${orgSlug}/events?eventName=${encodeURIComponent(event.eventName)}`;
  }

  return (
    <div className="group flex items-start gap-3 py-2">
      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          config.bgColor
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", config.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{config.label}</span>
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(new Date(event.timestamp))}
          </span>
        </div>

        {detailText && (
          <div className="mt-0.5 flex items-center gap-1">
            {detailLink ? (
              <Link
                className="flex items-center gap-1 truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
                href={detailLink}
              >
                <span className="truncate">{detailText}</span>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ) : (
              <span className="truncate text-muted-foreground text-xs">
                {detailText}
              </span>
            )}
          </div>
        )}

        {/* Show event data preview for workflow triggers and custom events */}
        {event.eventData &&
          Object.keys(event.eventData).length > 0 &&
          (event.type === "workflow_started" ||
            event.type === "custom_event") && (
            <div className="mt-1 flex items-center gap-1">
              <Zap
                className={cn(
                  "h-3 w-3",
                  event.type === "custom_event"
                    ? "text-purple-500"
                    : "text-amber-500"
                )}
              />
              <span className="truncate text-muted-foreground text-xs">
                {Object.entries(event.eventData)
                  .slice(0, 2)
                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                  .join(", ")}
                {Object.keys(event.eventData).length > 2 && "..."}
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

export function ContactTimeline({
  contactId,
  organizationId,
  orgSlug,
}: ContactTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Load timeline on mount
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      const result = await getContactTimeline(contactId, organizationId);

      if (result.success) {
        setEvents(result.events);
        setHasMore(result.hasMore);
      } else {
        setError(result.error);
      }

      setIsLoading(false);
    }

    load();
  }, [contactId, organizationId]);

  // Load more handler
  const handleLoadMore = () => {
    startTransition(async () => {
      const result = await getContactTimeline(contactId, organizationId, {
        offset: events.length,
      });

      if (result.success) {
        setEvents((prev) => [...prev, ...result.events]);
        setHasMore(result.hasMore);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div className="flex items-start gap-3" key={i}>
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Activity</h3>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Activity</h3>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Clock className="h-4 w-4" />
          <span>No activity yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm">Activity</h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute top-0 bottom-0 left-[13px] w-px bg-border" />

        {/* Events */}
        <div className="relative space-y-1">
          {events.map((event) => (
            <TimelineEventRow event={event} key={event.id} orgSlug={orgSlug} />
          ))}
        </div>
      </div>

      {/* Load more */}
      {hasMore && (
        <Button
          className="w-full"
          disabled={isPending}
          onClick={handleLoadMore}
          size="sm"
          variant="ghost"
        >
          {isPending ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  );
}
