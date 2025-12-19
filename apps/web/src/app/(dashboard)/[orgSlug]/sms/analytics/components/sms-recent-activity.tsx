"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSMSRecentActivity } from "../hooks/use-sms-analytics";

const getActivityIcon = (status: string) => {
  const statusLower = status.toLowerCase();

  if (statusLower === "delivered" || statusLower === "delivery") {
    return (
      <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" />
    );
  }
  if (statusLower === "queued" || statusLower === "pending") {
    return <Clock className="h-4 w-4 text-gray-700 dark:text-gray-400" />;
  }
  if (statusLower === "sent") {
    return (
      <MessageSquare className="h-4 w-4 text-blue-700 dark:text-blue-400" />
    );
  }
  if (
    statusLower === "failed" ||
    statusLower === "failure" ||
    statusLower === "blocked"
  ) {
    return <XCircle className="h-4 w-4 text-red-700 dark:text-red-400" />;
  }
  if (statusLower === "invalid" || statusLower.includes("unreachable")) {
    return (
      <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-400" />
    );
  }
  return <Clock className="h-4 w-4 text-gray-700 dark:text-gray-400" />;
};

const getActivityBadgeConfig = (status: string) => {
  const statusLower = status.toLowerCase();

  const configs: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      className: string;
      label: string;
    }
  > = {
    delivered: {
      variant: "default",
      className:
        "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      label: "Delivered",
    },
    delivery: {
      variant: "default",
      className:
        "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      label: "Delivered",
    },
    sent: {
      variant: "default",
      className:
        "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      label: "Sent",
    },
    queued: {
      variant: "default",
      className:
        "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
      label: "Queued",
    },
    pending: {
      variant: "default",
      className:
        "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
      label: "Pending",
    },
    failed: {
      variant: "default",
      className:
        "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
      label: "Failed",
    },
    failure: {
      variant: "default",
      className:
        "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
      label: "Failed",
    },
    blocked: {
      variant: "default",
      className:
        "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
      label: "Blocked",
    },
    invalid: {
      variant: "default",
      className:
        "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
      label: "Invalid",
    },
  };

  return (
    configs[statusLower] || {
      variant: "secondary" as const,
      className:
        "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
      label: status,
    }
  );
};

const formatTimestamp = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
};

const formatPhoneNumber = (phone: string) => {
  // Format as +1 (XXX) XXX-XXXX for US numbers
  if (phone.startsWith("+1") && phone.length === 12) {
    return `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
  }
  return phone;
};

export function SMSRecentActivity({ orgSlug }: { orgSlug: string }) {
  const {
    data: activities,
    isLoading,
    error,
  } = useSMSRecentActivity(orgSlug, 20);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton className="h-16 w-full" key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground text-sm">
            {error ? "Failed to load recent activity" : "No recent activity"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {activities.map((activity, index) => {
            const messageId = activity.id.split("-").slice(0, -1).join("-");
            const badgeConfig = getActivityBadgeConfig(activity.eventStatus);
            return (
              <Fragment key={activity.id}>
                <Item asChild>
                  <Link href={`/${orgSlug}/sms/${messageId}`}>
                    <ItemMedia>
                      {getActivityIcon(activity.eventStatus)}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {formatPhoneNumber(activity.destinationNumber)}
                      </ItemTitle>
                      <ItemDescription>
                        {formatTimestamp(activity.timestamp)}
                        {activity.segments && activity.segments > 1 && (
                          <span className="ml-2">
                            ({activity.segments} segments)
                          </span>
                        )}
                      </ItemDescription>
                    </ItemContent>
                    <Badge
                      className={cn("ml-auto", badgeConfig.className)}
                      variant={badgeConfig.variant}
                    >
                      {badgeConfig.label}
                    </Badge>
                  </Link>
                </Item>
                {index !== activities.length - 1 && <ItemSeparator />}
              </Fragment>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
