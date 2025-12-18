"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CONTACT_STATUS_COLORS,
  CONTACT_STATUS_LABELS,
  type ContactStatus,
  type ContactWithMeta,
} from "@/lib/contacts";

type ColumnActions = {
  onEdit: (contact: ContactWithMeta) => void;
  onDelete: (contact: ContactWithMeta) => void;
  onViewDetails: (contact: ContactWithMeta) => void;
};

export function createColumns(actions: ColumnActions): ColumnDef<ContactWithMeta>[] {
  return [
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <Button
            className="-ml-4"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("email")}</div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as ContactStatus;
        return (
          <Badge className={CONTACT_STATUS_COLORS[status]} variant="secondary">
            {CONTACT_STATUS_LABELS[status]}
          </Badge>
        );
      },
      filterFn: (row, _id, value: string[]) => {
        return value.includes(row.getValue("status"));
      },
    },
    {
      accessorKey: "topics",
      header: "Topics",
      cell: ({ row }) => {
        const topics = row.original.topics || [];
        const subscribedTopics = topics.filter((t) => t.status === "subscribed");

        if (subscribedTopics.length === 0) {
          return <span className="text-muted-foreground">None</span>;
        }

        return (
          <div className="flex flex-wrap gap-1">
            {subscribedTopics.slice(0, 2).map((t) => (
              <Badge key={t.topicId} variant="outline">
                {t.topicName}
              </Badge>
            ))}
            {subscribedTopics.length > 2 && (
              <Badge variant="outline">+{subscribedTopics.length - 2}</Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "emailsSent",
      header: ({ column }) => {
        return (
          <Button
            className="-ml-4"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
          >
            Sent
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="text-center">{row.getValue("emailsSent")}</div>
      ),
    },
    {
      accessorKey: "emailsOpened",
      header: "Opens",
      cell: ({ row }) => {
        const sent = row.original.emailsSent;
        const opened = row.getValue("emailsOpened") as number;
        const rate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0";
        return (
          <div className="text-center">
            {opened} <span className="text-muted-foreground text-xs">({rate}%)</span>
          </div>
        );
      },
    },
    {
      accessorKey: "emailsClicked",
      header: "Clicks",
      cell: ({ row }) => {
        const sent = row.original.emailsSent;
        const clicked = row.getValue("emailsClicked") as number;
        const rate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0";
        return (
          <div className="text-center">
            {clicked} <span className="text-muted-foreground text-xs">({rate}%)</span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            className="-ml-4"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <div className="text-muted-foreground">
            {date.toLocaleDateString()}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const contact = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8 p-0" variant="ghost">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onViewDetails(contact)}>
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onEdit(contact)}>
                Edit contact
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => actions.onDelete(contact)}
              >
                Delete contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
