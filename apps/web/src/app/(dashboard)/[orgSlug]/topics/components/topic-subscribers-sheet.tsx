"use client";

import { Users } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { getTopicSubscribers } from "@/actions/topics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TopicWithMeta } from "@/lib/topics";

type Subscriber = {
  contactId: string;
  email: string;
  status: string;
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
};

type TopicSubscribersSheetProps = {
  onClose: () => void;
  open: boolean;
  organizationId: string;
  topic: TopicWithMeta | null;
};

export function TopicSubscribersSheet({
  onClose,
  open,
  organizationId,
  topic,
}: TopicSubscribersSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Load subscribers when sheet opens or page changes
  useEffect(() => {
    if (open && topic) {
      startTransition(async () => {
        const result = await getTopicSubscribers(topic.id, organizationId, {
          page,
          pageSize,
          status: "subscribed",
        });
        if (result.success && result.subscribers) {
          setSubscribers(result.subscribers as Subscriber[]);
          setTotal(result.total || 0);
        }
      });
    }
  }, [open, topic, organizationId, page]);

  // Reset page when topic changes
  useEffect(() => {
    setPage(1);
  }, [topic?.id]);

  if (!topic) return null;

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {topic.name}
          </SheetTitle>
          <SheetDescription>
            {topic.subscriberCount.toLocaleString()} subscribers
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Topic Info */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">/{topic.slug}</Badge>
            <Badge variant={topic.public ? "secondary" : "outline"}>
              {topic.public ? "Public" : "Private"}
            </Badge>
            {topic.doubleOptIn && <Badge>Double Opt-In</Badge>}
          </div>

          {topic.description && (
            <p className="text-muted-foreground text-sm">{topic.description}</p>
          )}

          {/* Subscribers List */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Subscribed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow>
                    <TableCell className="text-center" colSpan={2}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : subscribers.length > 0 ? (
                  subscribers.map((subscriber) => (
                    <TableRow key={subscriber.contactId}>
                      <TableCell className="font-medium">
                        {subscriber.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subscriber.subscribedAt
                          ? new Date(subscriber.subscribedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="text-center text-muted-foreground"
                      colSpan={2}
                    >
                      No subscribers yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between">
              <Button
                disabled={page <= 1 || isPending}
                onClick={() => setPage((p) => p - 1)}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                disabled={page >= totalPages || isPending}
                onClick={() => setPage((p) => p + 1)}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
