"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Download, Loader2, Search, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { exportAllEvents } from "@/actions/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { eventCSVColumns } from "@/lib/csv-columns";
import { exportTableToCSV } from "@/lib/csv-export";
import type { DateRangePreset, EventWithContact } from "@/lib/events";
import { createColumns } from "./columns";
import { DateRangePicker } from "./date-range-picker";
import { EventDetailSheet } from "./event-detail-sheet";

type EventsTableProps = {
  datePreset?: string;
  eventNames: string[];
  events: EventWithContact[];
  organizationId: string;
  orgSlug: string;
  page: number;
  pageSize: number;
  total: number;
};

export function EventsTable({
  datePreset,
  eventNames,
  events,
  organizationId,
  orgSlug,
  page,
  pageSize,
  total,
}: EventsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Local input state (for immediate UI feedback)
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );

  // Debounced values (for triggering search)
  const [debouncedSearch] = useDebouncedValue(searchInput, { wait: 300 });

  // Ref for search input to enable keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track if this is the initial mount to avoid unnecessary navigation
  const isInitialMount = useRef(true);

  const [isExporting, setIsExporting] = useState(false);

  // Sheet state
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithContact | null>(
    null
  );

  // Navigation helpers
  const updateSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`/${orgSlug}/events?${params.toString()}`);
    },
    [router, orgSlug, searchParams]
  );

  // Update URL when debounced search changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    updateSearchParams({ search: debouncedSearch || undefined, page: "1" });
  }, [debouncedSearch, updateSearchParams]);

  // Keyboard shortcut: Cmd+F to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDateRangeChange = useCallback(
    (
      dateFrom: Date | undefined,
      dateTo: Date | undefined,
      preset: DateRangePreset | undefined
    ) => {
      updateSearchParams({
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        datePreset: preset,
        page: "1",
      });
    },
    [updateSearchParams]
  );

  // Column actions
  const columnActions = useMemo(
    () => ({
      onViewDetails: (event: EventWithContact) => {
        setSelectedEvent(event);
        setDetailsSheetOpen(true);
      },
      orgSlug,
    }),
    [orgSlug]
  );

  const columns = useMemo(() => createColumns(columnActions), [columnActions]);

  const table = useReactTable({
    data: events,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: true,
    manualFiltering: true, // Server-side filtering
    pageCount: Math.ceil(total / pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: page - 1,
        pageSize,
      },
    },
    getRowId: (row) => row.id,
  });

  const eventNameFilter = searchParams.get("eventName");
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");

  return (
    <div className="w-full space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-16"
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search events\u2026"
              ref={searchInputRef}
              value={searchInput}
            />
            <Kbd className="absolute top-1/2 right-2 -translate-y-1/2 hidden sm:flex">
              ⌘F
            </Kbd>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Button Group: Event Name | Date Range | Export */}
          <div className="flex w-full sm:w-auto">
            <Select
              onValueChange={(value) => {
                updateSearchParams({
                  eventName: value === "all" ? undefined : value,
                  page: "1",
                });
              }}
              value={eventNameFilter || "all"}
            >
              <SelectTrigger className="min-w-0 flex-1 sm:flex-initial sm:w-[180px] rounded-r-none border-r-0 focus:z-10">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {eventNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker
              dateFrom={dateFromParam ? new Date(dateFromParam) : undefined}
              dateTo={dateToParam ? new Date(dateToParam) : undefined}
              onDateRangeChange={handleDateRangeChange}
              preset={datePreset as DateRangePreset | undefined}
              triggerClassName="rounded-none border-r-0 focus:z-10"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="rounded-l-none focus:z-10"
                  disabled={isExporting}
                  onClick={async () => {
                    setIsExporting(true);
                    try {
                      const selectedRows = table.getSelectedRowModel().rows;
                      if (selectedRows.length > 0) {
                        const rows = selectedRows.map((r) => r.original);
                        exportTableToCSV(
                          rows,
                          eventCSVColumns,
                          `events-${new Date().toISOString().slice(0, 10)}.csv`
                        );
                        toast.success(`Exported ${rows.length} events to CSV`);
                      } else {
                        const result = await exportAllEvents(organizationId, {
                          search: searchInput || undefined,
                          eventName: eventNameFilter || undefined,
                          dateFrom: dateFromParam
                            ? new Date(dateFromParam)
                            : undefined,
                          dateTo: dateToParam
                            ? new Date(dateToParam)
                            : undefined,
                        });
                        if (result.success) {
                          exportTableToCSV(
                            result.events,
                            eventCSVColumns,
                            `events-${new Date().toISOString().slice(0, 10)}.csv`
                          );
                          toast.success(
                            `Exported ${result.events.length} events to CSV`
                          );
                        } else {
                          toast.error("Failed to export events");
                        }
                      }
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                  size="icon"
                  variant="outline"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span className="sr-only">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as CSV</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {events.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  key={row.id}
                  onClick={() => {
                    setSelectedEvent(row.original);
                    setDetailsSheetOpen(true);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-32 text-center"
                  colSpan={columns.length}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Zap className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No events found</p>
                    <p className="text-muted-foreground text-sm">
                      Events will appear here when tracked from your application
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex items-center space-x-2">
          <Label className="font-medium text-sm" htmlFor="page-size">
            Show
          </Label>
          <Select
            onValueChange={(value) => {
              updateSearchParams({ pageSize: value, page: "1" });
            }}
            value={`${pageSize}`}
          >
            <SelectTrigger className="w-20" id="page-size">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[20, 50, 100, 200].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 text-center text-muted-foreground text-sm">
          Showing {events.length} of {total} events
        </div>
        <div className="flex items-center space-x-2">
          <Button
            disabled={page <= 1}
            onClick={() => updateSearchParams({ page: `${page - 1}` })}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <div className="text-sm">
            Page {page} of {Math.ceil(total / pageSize) || 1}
          </div>
          <Button
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => updateSearchParams({ page: `${page + 1}` })}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Details Sheet */}
      <EventDetailSheet
        event={selectedEvent}
        onClose={() => {
          setDetailsSheetOpen(false);
          setSelectedEvent(null);
        }}
        open={detailsSheetOpen}
        orgSlug={orgSlug}
      />
    </div>
  );
}
