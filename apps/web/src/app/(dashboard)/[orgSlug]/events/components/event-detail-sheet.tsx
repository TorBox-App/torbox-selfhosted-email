"use client";

import { format } from "date-fns";
import { Copy, ExternalLink, User, Zap } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EventWithContact } from "@/lib/events";

type EventDetailSheetProps = {
  event: EventWithContact | null;
  onClose: () => void;
  open: boolean;
  orgSlug: string;
};

export function EventDetailSheet({
  event,
  onClose,
  open,
  orgSlug,
}: EventDetailSheetProps) {
  if (!event) {
    return null;
  }

  const handleCopyEventData = () => {
    if (event.eventData) {
      navigator.clipboard.writeText(JSON.stringify(event.eventData, null, 2));
      toast.success("Copied to clipboard");
    }
  };

  const contactDisplayName =
    event.contactFirstName || event.contactLastName
      ? `${event.contactFirstName || ""} ${event.contactLastName || ""}`.trim()
      : event.contactEmail || "Unknown";

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={open}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            Event Details
          </SheetTitle>
          <SheetDescription>
            View the full details of this event
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-6 px-4 pb-4 overflow-y-auto">
          {/* Event Name */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Event Name
            </label>
            <div className="mt-1">
              <Badge className="font-mono text-sm" variant="secondary">
                {event.eventName}
              </Badge>
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Timestamp
            </label>
            <p className="mt-1 text-sm">
              {format(new Date(event.createdAt), "PPpp")}
            </p>
          </div>

          {/* Contact */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Contact
            </label>
            <div className="mt-1 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{contactDisplayName}</span>
              <Link
                href={`/${orgSlug}/contacts?search=${encodeURIComponent(event.contactEmail || "")}`}
              >
                <Button className="h-6 px-2" size="sm" variant="ghost">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {event.contactEmail &&
              event.contactEmail !== contactDisplayName && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.contactEmail}
                </p>
              )}
          </div>

          {/* Event Data */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Event Data
              </label>
              {event.eventData && Object.keys(event.eventData).length > 0 && (
                <Button
                  className="h-6 px-2"
                  onClick={handleCopyEventData}
                  size="sm"
                  variant="ghost"
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              )}
            </div>
            <div className="mt-2 rounded-lg bg-muted p-4">
              {event.eventData && Object.keys(event.eventData).length > 0 ? (
                <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-96">
                  {JSON.stringify(event.eventData, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No event data
                </p>
              )}
            </div>
          </div>

          {/* Event ID */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Event ID
            </label>
            <p className="mt-1 text-xs font-mono text-muted-foreground">
              {event.id}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
