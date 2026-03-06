"use client";

import { ChevronRight, Code2, Pencil, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getTopicSubscribers } from "@/actions/topics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CodeTabs } from "@/components/ui/shadcn-io/code-tabs";
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
  canEdit: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  open: boolean;
  organizationId: string;
  topic: TopicWithMeta | null;
};

export function TopicSubscribersSheet({
  canEdit,
  onClose,
  onDelete,
  onEdit,
  open,
  organizationId,
  topic,
}: TopicSubscribersSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Stable reference for dependency arrays
  const topicId = topic?.id ?? null;

  // Reset state when topic changes or sheet opens with new topic
  useEffect(() => {
    if (open && topicId) {
      // Reset pagination and clear stale data
      setPage(1);
      setSubscribers([]);
      setTotal(0);
    }
  }, [open, topicId]);

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
  }, [open, organizationId, page, topic]);

  if (!topic) {
    return null;
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <SheetContent className="flex flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader className="px-4">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {topic.name}
          </SheetTitle>
          <SheetDescription>
            {topic.subscriberCount.toLocaleString()} subscribers
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
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

          {/* Quick Start */}
          <QuickStartSnippets slug={topic.slug} />

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
                          ? new Date(
                              subscriber.subscribedAt
                            ).toLocaleDateString()
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

        {/* Actions Footer */}
        {canEdit && (
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <Button className="flex-1" onClick={onEdit} variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Topic
            </Button>
            <Button
              aria-label="Delete topic"
              onClick={onDelete}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function QuickStartSnippets({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);

  const codes = useMemo(
    () => ({
      typescript: {
        "@wraps.dev/client": `import { createPlatformClient } from "@wraps.dev/client";

const client = createPlatformClient({ apiKey: "wraps_..." });

// Subscribe a contact to this topic
await client.POST("/v1/contacts/", {
  body: {
    email: "user@example.com",
    topicSlugs: ["${slug}"],
  },
});`,
      },
      curl: {
        cURL: `curl -X POST https://api.wraps.dev/v1/contacts/ \\
  -H "Authorization: Bearer wraps_..." \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","topicSlugs":["${slug}"]}'`,
      },
    }),
    [slug]
  );

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger asChild>
        <Button className="gap-1.5" size="sm" variant="ghost">
          <Code2 className="h-4 w-4" />
          Quick start
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        <CodeTabs codes={codes.typescript} lang="typescript" />
        <CodeTabs codes={codes.curl} lang="bash" />
      </CollapsibleContent>
    </Collapsible>
  );
}
