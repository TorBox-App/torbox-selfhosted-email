"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  MailOpen,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  Play,
  Send,
  UserPlus,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getContactTimeline,
  type TimelineEvent,
  type TimelineEventType,
} from "@/actions/contacts";
import { cn } from "@/lib/utils";

type ContactTimelineProps = {
  contactId: string;
  organizationId: string;
  orgSlug: string;
};

// Base config for event types (used for non-email events and fallback)
const EVENT_CONFIG: Record<
  TimelineEventType,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  email_sent: {
    icon: Send,
    label: "Email sent",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  email_delivered: {
    icon: Mail,
    label: "Email delivered",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  email_opened: {
    icon: MailOpen,
    label: "Email opened",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  email_clicked: {
    icon: MousePointerClick,
    label: "Email clicked",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  email_bounced: {
    icon: XCircle,
    label: "Email bounced",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  email_complained: {
    icon: AlertTriangle,
    label: "Spam complaint",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  sms_sent: {
    icon: Send,
    label: "SMS sent",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  sms_delivered: {
    icon: MessageSquare,
    label: "SMS delivered",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  sms_clicked: {
    icon: MousePointerClick,
    label: "SMS clicked",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  sms_opted_out: {
    icon: XCircle,
    label: "SMS opt-out",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
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
};

// Get icon and label based on source type for email/SMS events
function getEventDisplay(event: TimelineEvent): {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
} {
  const baseConfig = EVENT_CONFIG[event.type];

  // For email events, customize based on source type
  if (event.type.startsWith("email_")) {
    const action = event.type.replace("email_", ""); // sent, delivered, opened, etc.
    const actionLabel =
      action === "complained"
        ? "Spam complaint"
        : action.charAt(0).toUpperCase() + action.slice(1);

    if (event.sourceType === "batch") {
      return {
        icon: Megaphone,
        label: `Broadcast ${actionLabel.toLowerCase()}`,
        color: baseConfig.color,
        bgColor: "bg-violet-100",
      };
    }
    if (event.sourceType === "workflow") {
      return {
        icon: Workflow,
        label: `Automation email ${actionLabel.toLowerCase()}`,
        color: baseConfig.color,
        bgColor: "bg-amber-100",
      };
    }
    // Transactional - use mail icon
    return {
      ...baseConfig,
      label: `Email ${actionLabel.toLowerCase()}`,
    };
  }

  return baseConfig;
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
  const config = getEventDisplay(event);
  const Icon = config.icon;

  // Build the detail text and link
  let detailText: string | null = null;
  let detailLink: string | null = null;

  if (event.type.startsWith("email_") || event.type.startsWith("sms_")) {
    // Default to subject
    if (event.subject) {
      detailText = `"${event.subject}"`;
    }

    // Link to individual email if we have a messageId
    if (event.messageId && event.channel === "email") {
      detailLink = `/${orgSlug}/emails/${event.messageId}`;
    }

    // Override detail text with source context
    if (event.sourceType === "batch" && event.batchName) {
      detailText = event.batchName;
    } else if (event.sourceType === "workflow" && event.workflowName) {
      detailText = event.workflowName;
    } else if (event.sourceType === "transactional") {
      detailText = event.subject || "Transactional";
    }
  } else if (event.type.startsWith("workflow_")) {
    detailText = event.workflowName || "Workflow";
    if (event.workflowId) {
      detailLink = `/${orgSlug}/automations/${event.workflowId}`;
    }
    // Show event trigger if available
    if (event.eventName && event.type === "workflow_started") {
      detailText = `${event.workflowName} (${event.eventName})`;
    }
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

        {/* Show event data preview for workflow triggers */}
        {event.eventData &&
          Object.keys(event.eventData).length > 0 &&
          event.type === "workflow_started" && (
            <div className="mt-1 flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" />
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
