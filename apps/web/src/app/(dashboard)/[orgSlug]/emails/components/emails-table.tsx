"use client";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Download, Loader2, Search, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkCreateContactsFromEmails } from "@/actions/contacts-bulk";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { emailCSVColumns } from "@/lib/csv-columns";
import { exportTableToCSV } from "@/lib/csv-export";
import { cn } from "@/lib/utils";
import { useEmailsData } from "../hooks/use-emails";
import { columns } from "./columns";

type EmailsTableProps = {
  orgSlug: string;
  organizationId: string;
  days: number;
};

export function EmailsTable({
  orgSlug,
  organizationId,
  days,
}: EmailsTableProps) {
  const {
    data: emails = [],
    isLoading,
    isFetching,
  } = useEmailsData(orgSlug, days);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastActivityAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [createContactsDialogOpen, setCreateContactsDialogOpen] =
    useState(false);

  // Ref for search input to enable keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const table = useReactTable({
    data: emails,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();

      // Search in subject
      const subject = row.original.subject?.toLowerCase() ?? "";
      if (subject.includes(search)) {
        return true;
      }

      // Search in recipient email addresses
      const recipients = row.original.to;
      if (recipients.some((email) => email.toLowerCase().includes(search))) {
        return true;
      }

      // Search in from address
      const from = row.original.from?.toLowerCase() ?? "";
      if (from.includes(search)) {
        return true;
      }

      return false;
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    getRowId: (row) => row.id,
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  // Get selected email IDs and extract unique recipient emails
  const selectedEmailIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  );

  const uniqueRecipientEmails = useMemo(() => {
    const recipientSet = new Set<string>();
    for (const emailId of selectedEmailIds) {
      const email = emails.find((e) => e.id === emailId);
      if (email?.to) {
        for (const recipient of email.to) {
          recipientSet.add(recipient.toLowerCase());
        }
      }
    }
    return [...recipientSet];
  }, [selectedEmailIds, emails]);

  // Handler for bulk create contacts
  const handleCreateContacts = async () => {
    if (uniqueRecipientEmails.length === 0) {
      return;
    }

    startTransition(async () => {
      const result = await bulkCreateContactsFromEmails(
        organizationId,
        uniqueRecipientEmails
      );

      if (result.success) {
        const messages: string[] = [];
        if (result.created > 0) {
          messages.push(
            `Created ${result.created} contact${result.created === 1 ? "" : "s"}`
          );
        }
        if (result.skipped > 0) {
          messages.push(`${result.skipped} already existed`);
        }
        if (result.errors.length > 0) {
          messages.push(`${result.errors.length} failed`);
        }

        toast.success("Contacts created", {
          description: messages.join(", "),
        });
        setCreateContactsDialogOpen(false);
        setRowSelection({});
        router.refresh();
      } else {
        toast.error("Error", { description: result.error });
      }
    });
  };

  const statusFilter = table.getColumn("status")?.getFilterValue() as
    | string[]
    | undefined;

  return (
    <div className="w-full space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-16"
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              placeholder="Search emails"
              ref={searchInputRef}
              value={globalFilter ?? ""}
            />
            <Kbd className="absolute top-1/2 right-2 -translate-y-1/2 hidden sm:flex">
              ⌘F
            </Kbd>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Actions - shown when emails are selected */}
          {selectedEmailIds.length > 0 && (
            <Button
              onClick={() => setCreateContactsDialogOpen(true)}
              size="sm"
              variant="outline"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add to contacts ({uniqueRecipientEmails.length})
            </Button>
          )}

          {/* Button Group: Time Range | Status | Export */}
          <div className="flex w-full sm:w-auto">
            <Select
              onValueChange={(value) => {
                router.push(`/${orgSlug}/emails?days=${value}`);
              }}
              value={String(days)}
            >
              <SelectTrigger className="min-w-0 flex-1 sm:flex-initial sm:w-[150px] rounded-r-none border-r-0 focus:z-10">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => {
                const column = table.getColumn("status");
                if (value === "all") {
                  column?.setFilterValue(undefined);
                } else {
                  column?.setFilterValue([value]);
                }
              }}
              value={
                statusFilter && statusFilter.length > 0
                  ? statusFilter[0]
                  : "all"
              }
            >
              <SelectTrigger className="min-w-0 flex-1 sm:flex-initial sm:w-[140px] rounded-none border-r-0 focus:z-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="opened">Opened</SelectItem>
                <SelectItem value="clicked">Clicked</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="rounded-l-none focus:z-10"
                  disabled={isExporting}
                  onClick={() => {
                    setIsExporting(true);
                    try {
                      const selectedRows = table.getSelectedRowModel().rows;
                      const rows =
                        selectedRows.length > 0
                          ? selectedRows.map((r) => r.original)
                          : table
                              .getFilteredRowModel()
                              .rows.map((r) => r.original);
                      exportTableToCSV(
                        rows,
                        emailCSVColumns,
                        `emails-${new Date().toISOString().slice(0, 10)}.csv`
                      );
                      if (rows.length > 0) {
                        toast.success(`Exported ${rows.length} emails to CSV`);
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
      <div
        className={cn("rounded-md border transition-opacity", isFetching && !isLoading && "opacity-60")}
      >
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
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={`skeleton-${i}-${j}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  onClick={() => {
                    router.push(`/${orgSlug}/emails/${row.original.id}`);
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
                    <p className="text-muted-foreground">No emails found</p>
                    <p className="text-muted-foreground text-sm">
                      Try adjusting the time range or send your first email
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
              table.setPageSize(Number(value));
            }}
            value={`${table.getState().pagination.pageSize}`}
          >
            <SelectTrigger className="w-20" id="page-size">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[20, 50, 100, 200].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 text-center text-muted-foreground text-sm">
          Showing {table.getRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} emails
        </div>
        <div className="flex items-center space-x-2">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <div className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Create Contacts Confirmation Dialog */}
      <Dialog
        onOpenChange={setCreateContactsDialogOpen}
        open={createContactsDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contacts</DialogTitle>
            <DialogDescription>
              Create contacts from {uniqueRecipientEmails.length} unique email
              address{uniqueRecipientEmails.length === 1 ? "" : "es"}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-muted-foreground text-sm">
            Emails that already exist as contacts will be skipped automatically.
          </div>
          <DialogFooter>
            <Button
              onClick={() => setCreateContactsDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} onClick={handleCreateContacts}>
              <UserPlus className="mr-2 h-4 w-4" />
              {isPending ? "Creating..." : "Create Contacts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
