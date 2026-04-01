"use client";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createSegment,
  deleteSegment,
  updateSegment,
} from "@/actions/segments";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FilterCondition, SegmentWithMeta } from "@/lib/segments";
import type { TopicWithMeta } from "@/lib/topics";
import { createColumns } from "./columns";
import { SegmentDetailsSheet } from "./segment-details-sheet";
import { SegmentFormDialog } from "./segment-form-dialog";

type SegmentsTableProps = {
  segments: SegmentWithMeta[];
  orgSlug: string;
  organizationId: string;
  propertyKeys: string[];
  topics: TopicWithMeta[];
  userRole: "owner" | "admin" | "member";
};

export function SegmentsTable({
  segments,
  orgSlug,
  organizationId,
  propertyKeys,
  topics,
  userRole,
}: SegmentsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

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

  // Dialog/sheet state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] =
    useState<SegmentWithMeta | null>(null);

  // Column actions
  const columnActions = useMemo(
    () => ({
      onEdit: (segment: SegmentWithMeta) => {
        setSelectedSegment(segment);
        setEditDialogOpen(true);
      },
      onDelete: (segment: SegmentWithMeta) => {
        setSelectedSegment(segment);
        setDeleteDialogOpen(true);
      },
    }),
    []
  );

  const columns = useMemo(() => createColumns(columnActions), [columnActions]);

  const table = useReactTable({
    data: segments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  // Handlers
  const handleCreateSegment = async (data: {
    name: string;
    description?: string;
    condition: FilterCondition;
    trackMembership?: boolean;
  }) => {
    startTransition(async () => {
      const result = await createSegment(organizationId, data);
      if (result.success) {
        toast.success("Segment created", {
          description: `${data.name} has been created.`,
        });
        setCreateDialogOpen(false);
        router.refresh();
      } else {
        toast.error("Error", {
          description: result.error,
        });
      }
    });
  };

  const handleUpdateSegment = async (data: {
    name?: string;
    description?: string | null;
    condition?: FilterCondition;
    trackMembership?: boolean;
  }) => {
    if (!selectedSegment) {
      return;
    }

    startTransition(async () => {
      const result = await updateSegment(
        selectedSegment.id,
        organizationId,
        data
      );
      if (result.success) {
        toast.success("Segment updated", {
          description: "The segment has been updated.",
        });
        setEditDialogOpen(false);
        setSelectedSegment(null);
        router.refresh();
      } else {
        toast.error("Error", {
          description: result.error,
        });
      }
    });
  };

  const handleDeleteSegment = async () => {
    if (!selectedSegment) {
      return;
    }

    startTransition(async () => {
      const result = await deleteSegment(selectedSegment.id, organizationId);
      if (result.success) {
        toast.success("Segment deleted", {
          description: "The segment has been removed.",
        });
        setDeleteDialogOpen(false);
        setSelectedSegment(null);
        router.refresh();
      } else {
        toast.error("Error", {
          description: result.error,
        });
      }
    });
  };

  const canEdit = userRole === "owner" || userRole === "admin";

  return (
    <div className="w-full space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-16"
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search segments"
              ref={searchInputRef}
              value={globalFilter}
            />
            <Kbd className="absolute top-1/2 right-2 -translate-y-1/2 hidden sm:flex">
              ⌘F
            </Kbd>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Add Segment Button */}
          {canEdit && (
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Segment
            </Button>
          )}
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
            {segments.length > 0 && table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  onClick={() => {
                    setSelectedSegment(row.original);
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
                    <p className="text-muted-foreground">No segments found</p>
                    {canEdit && (
                      <Button
                        onClick={() => setCreateDialogOpen(true)}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create your first segment
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <SegmentFormDialog
        isPending={isPending}
        mode="create"
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateSegment}
        open={createDialogOpen}
        organizationId={organizationId}
        propertyKeys={propertyKeys}
        topics={topics}
      />

      {/* Edit Dialog */}
      <SegmentFormDialog
        isPending={isPending}
        mode="edit"
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedSegment(null);
          }
        }}
        onSubmit={handleUpdateSegment}
        open={editDialogOpen}
        organizationId={organizationId}
        propertyKeys={propertyKeys}
        segment={selectedSegment}
        topics={topics}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Segment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedSegment?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={handleDeleteSegment}
              variant="destructive"
            >
              {isPending ? "Deleting\u2026" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Sheet */}
      <SegmentDetailsSheet
        canEdit={canEdit}
        onClose={() => {
          setDetailsSheetOpen(false);
          setSelectedSegment(null);
        }}
        onDelete={() => {
          setDetailsSheetOpen(false);
          setDeleteDialogOpen(true);
        }}
        onEdit={() => {
          setDetailsSheetOpen(false);
          setEditDialogOpen(true);
        }}
        open={detailsSheetOpen}
        organizationId={organizationId}
        segment={selectedSegment}
        topics={topics}
      />
    </div>
  );
}
