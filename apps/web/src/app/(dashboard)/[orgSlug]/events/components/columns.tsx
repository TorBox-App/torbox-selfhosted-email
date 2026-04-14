"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@wraps/ui/components/ui/badge";
import { Checkbox } from "@wraps/ui/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wraps/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wraps/ui/components/ui/tooltip";
import { ArrowUpDown, Eye, MoreHorizontal, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { EventWithContact } from "@/lib/events";
import { formatRelativeTime } from "@/lib/utils";

type ColumnActions = {
  onViewDetails: (event: EventWithContact) => void;
  orgSlug: string;
};

/**
 * Truncate and format JSON data for preview
 */
function formatEventDataPreview(data: Record<string, unknown> | null): string {
  if (!data) {
    return "-";
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return "-";
  }

  // Show first 3 key-value pairs
  const preview = entries
    .slice(0, 3)
    .map(([key, value]) => {
      const valueStr =
        typeof value === "string"
          ? value.length > 20
            ? `${value.substring(0, 20)}...`
            : value
          : JSON.stringify(value);
      return `${key}: ${valueStr}`;
    })
    .join(", ");

  if (entries.length > 3) {
    return `${preview}, +${entries.length - 3} more`;
  }

  return preview;
}

export function createColumns(
  actions: ColumnActions
): ColumnDef<EventWithContact>[] {
  return [
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
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          className="-ml-4"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground">
                  {formatRelativeTime(date)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{date.toLocaleString()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "eventName",
      header: "Event",
      cell: ({ row }) => {
        const eventName = row.getValue("eventName") as string;
        return (
          <Badge className="font-mono text-xs" variant="secondary">
            {eventName}
          </Badge>
        );
      },
    },
    {
      accessorKey: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const event = row.original;
        const displayName =
          event.contactFirstName || event.contactLastName
            ? `${event.contactFirstName || ""} ${event.contactLastName || ""}`.trim()
            : event.contactEmail;

        return (
          <Link
            className="flex items-center gap-2 hover:underline"
            href={`/${actions.orgSlug}/contacts?search=${encodeURIComponent(event.contactEmail || "")}`}
            onClick={(e) => e.stopPropagation()}
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="truncate max-w-[200px]">
              {displayName || "Unknown"}
            </span>
          </Link>
        );
      },
    },
    {
      accessorKey: "eventData",
      header: "Data",
      cell: ({ row }) => {
        const data = row.original.eventData;
        const preview = formatEventDataPreview(data);

        if (preview === "-") {
          return <span className="text-muted-foreground">-</span>;
        }

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs text-muted-foreground truncate max-w-[300px] block">
                  {preview}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const event = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button className="h-8 w-8 p-0" variant="ghost">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onViewDetails(event);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
