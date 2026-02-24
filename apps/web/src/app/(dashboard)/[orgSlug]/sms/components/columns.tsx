"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CheckCircle2,
  type Circle,
  Clock,
  Phone,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { SMSListItem, SMSStatus } from "../types";

const STATUS_CONFIG: Record<
  SMSStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: typeof Circle;
  }
> = {
  sent: {
    label: "Sent",
    variant: "secondary",
    className:
      "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    icon: Clock,
  },
  delivered: {
    label: "Delivered",
    variant: "default",
    className:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: CheckCircle2,
  },
  queued: {
    label: "Queued",
    variant: "secondary",
    className:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: Clock,
  },
  failed: {
    label: "Failed",
    variant: "default",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  blocked: {
    label: "Blocked",
    variant: "default",
    className:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    icon: Ban,
  },
  invalid: {
    label: "Invalid",
    variant: "default",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  opted_out: {
    label: "Opted Out",
    variant: "default",
    className:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    icon: Ban,
  },
  carrier_unreachable: {
    label: "Carrier Unreachable",
    variant: "default",
    className:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    icon: XCircle,
  },
  ttl_expired: {
    label: "TTL Expired",
    variant: "default",
    className:
      "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    icon: Clock,
  },
};

function formatTimestamp(timestamp: number): string {
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

function formatPhoneNumber(phone: string): string {
  // Format US phone numbers nicely
  if (phone.startsWith("+1") && phone.length === 12) {
    return `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
  }
  return phone;
}

export const columns: ColumnDef<SMSListItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "destinationNumber",
    accessorKey: "destinationNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="To" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 font-mono text-sm">
        <Phone className="h-4 w-4 text-muted-foreground" />
        {formatPhoneNumber(row.original.destinationNumber)}
      </div>
    ),
    meta: {
      label: "Recipient",
      placeholder: "Search phone numbers...",
      variant: "text",
    },
    enableColumnFilter: true,
  },
  {
    id: "originationNumber",
    accessorKey: "originationNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="From" />
    ),
    cell: ({ row }) => {
      const from = row.original.originationNumber;
      if (!from) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }
      return (
        <span className="font-mono text-sm">
          {formatPhoneNumber(from)}
        </span>
      );
    },
    enableColumnFilter: false,
    enableSorting: false,
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const config = STATUS_CONFIG[status] || STATUS_CONFIG.sent;
      const Icon = config.icon;

      return (
        <Badge className={config.className} variant={config.variant}>
          <Icon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
      );
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    meta: {
      label: "Status",
      variant: "multiSelect",
      options: Object.entries(STATUS_CONFIG).map(([key, config]) => ({
        label: config.label,
        value: key,
      })),
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    id: "sentAt",
    accessorKey: "sentAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Sent" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatTimestamp(row.original.sentAt)}
      </span>
    ),
    meta: {
      label: "Sent Date",
      variant: "dateRange",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
];
