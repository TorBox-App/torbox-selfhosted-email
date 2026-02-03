"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Paperclip, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { InboundEmailListItem } from "../types";

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (diffInDays === 1) {
    return "Yesterday";
  }
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const columns: ColumnDef<InboundEmailListItem>[] = [
  {
    id: "from",
    accessorKey: "from",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="From" />
    ),
    cell: ({ row }) => (
      <div className="max-w-[250px] truncate font-mono text-sm">
        {row.original.from}
      </div>
    ),
    meta: {
      label: "From",
      placeholder: "Search sender...",
      variant: "text",
    },
    enableColumnFilter: true,
  },
  {
    id: "subject",
    accessorKey: "subject",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Subject" />
    ),
    cell: ({ row }) => (
      <div className="max-w-[400px] truncate">
        {row.original.subject || "(no subject)"}
      </div>
    ),
    meta: {
      label: "Subject",
      placeholder: "Search subjects...",
      variant: "text",
    },
    enableColumnFilter: true,
  },
  {
    id: "receivedAt",
    accessorKey: "receivedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Received" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatTimestamp(row.original.receivedAt)}
      </span>
    ),
    enableSorting: true,
  },
  {
    id: "attachments",
    accessorKey: "attachmentCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Attachments" />
    ),
    cell: ({ row }) => {
      if (!row.original.hasAttachments) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }
      return (
        <Badge
          className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"
          variant="outline"
        >
          <Paperclip className="mr-1 h-3 w-3" />
          {row.original.attachmentCount}
        </Badge>
      );
    },
    enableSorting: false,
  },
  {
    id: "spam",
    accessorKey: "spamVerdict",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Spam" />
    ),
    cell: ({ row }) => {
      const verdict = row.original.spamVerdict;
      if (!verdict) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }
      if (verdict === "PASS") {
        return (
          <Badge
            className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
            variant="outline"
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            Pass
          </Badge>
        );
      }
      return (
        <Badge
          className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
          variant="outline"
        >
          <ShieldAlert className="mr-1 h-3 w-3" />
          Fail
        </Badge>
      );
    },
    filterFn: (row, _id, value) => value.includes(row.getValue("spam")),
    meta: {
      label: "Spam Verdict",
      variant: "multiSelect",
      options: [
        { label: "Pass", value: "PASS" },
        { label: "Fail", value: "FAIL" },
      ],
    },
    enableColumnFilter: true,
    enableSorting: false,
  },
];
