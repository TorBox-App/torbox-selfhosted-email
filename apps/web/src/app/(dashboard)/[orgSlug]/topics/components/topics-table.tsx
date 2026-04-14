"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@wraps/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wraps/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wraps/ui/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wraps/ui/components/ui/table";
import { Eye, EyeOff, MoreHorizontal, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTopic, deleteTopic, updateTopic } from "@/actions/topics";
import { Button } from "@/components/ui/button";
import type { TopicWithMeta } from "@/lib/topics";
import { TopicFormDialog } from "./topic-form-dialog";
import { TopicSubscribersSheet } from "./topic-subscribers-sheet";

type TopicsTableProps = {
  orgSlug: string;
  organizationId: string;
  topics: TopicWithMeta[];
  userRole: "owner" | "admin" | "member";
};

export function TopicsTable({
  orgSlug,
  organizationId,
  topics,
  userRole,
}: TopicsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);

  // Dialog/sheet state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subscribersSheetOpen, setSubscribersSheetOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicWithMeta | null>(
    null
  );

  const canEdit = userRole === "owner" || userRole === "admin";

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }: { row: { original: TopicWithMeta } }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground text-xs">
              /{row.original.slug}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }: { row: { original: TopicWithMeta } }) => (
          <span className="text-muted-foreground">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        accessorKey: "subscriberCount",
        header: "Subscribers",
        cell: ({ row }: { row: { original: TopicWithMeta } }) => (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{row.original.subscriberCount.toLocaleString()}</span>
          </div>
        ),
      },
      {
        accessorKey: "public",
        header: "Visibility",
        cell: ({ row }: { row: { original: TopicWithMeta } }) => (
          <Badge variant={row.original.public ? "outline" : "secondary"}>
            {row.original.public ? (
              <Eye className="mr-1 h-3 w-3" />
            ) : (
              <EyeOff className="mr-1 h-3 w-3" />
            )}
            {row.original.public ? "Public" : "Private"}
          </Badge>
        ),
      },
      {
        accessorKey: "doubleOptIn",
        header: "Double Opt-In",
        cell: ({ row }: { row: { original: TopicWithMeta } }) => (
          <Badge variant={row.original.doubleOptIn ? "default" : "outline"}>
            {row.original.doubleOptIn ? "Required" : "Off"}
          </Badge>
        ),
      },
      {
        id: "actions",
        cell: ({ row }: { row: { original: TopicWithMeta } }) => {
          const topic = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-8 w-8 p-0" variant="ghost">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedTopic(topic);
                    setSubscribersSheetOpen(true);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  View subscribers
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedTopic(topic);
                        setEditDialogOpen(true);
                      }}
                    >
                      Edit topic
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setSelectedTopic(topic);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      Delete topic
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canEdit]
  );

  const table = useReactTable({
    data: topics,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  // Handlers
  const handleCreateTopic = async (data: {
    name?: string;
    slug?: string;
    description?: string | null;
    public?: boolean;
    doubleOptIn?: boolean;
  }) => {
    if (!data.name) {
      toast.error("Error", { description: "Name is required" });
      return;
    }
    const name = data.name; // Narrow the type
    startTransition(async () => {
      const result = await createTopic(organizationId, {
        name,
        slug: data.slug,
        description: data.description || undefined,
        public: data.public,
        doubleOptIn: data.doubleOptIn,
      });
      if (result.success) {
        toast.success("Topic created", {
          description: `${name} has been created.`,
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

  const handleUpdateTopic = async (data: {
    name?: string;
    slug?: string;
    description?: string | null;
    public?: boolean;
    doubleOptIn?: boolean;
  }) => {
    if (!selectedTopic) {
      return;
    }

    startTransition(async () => {
      const result = await updateTopic(selectedTopic.id, organizationId, data);
      if (result.success) {
        toast.success("Topic updated", {
          description: "The topic has been updated.",
        });
        setEditDialogOpen(false);
        setSelectedTopic(null);
        router.refresh();
      } else {
        toast.error("Error", {
          description: result.error,
        });
      }
    });
  };

  const handleDeleteTopic = async () => {
    if (!selectedTopic) {
      return;
    }

    startTransition(async () => {
      const result = await deleteTopic(selectedTopic.id, organizationId);
      if (result.success) {
        toast.success("Topic deleted", {
          description: "The topic has been removed.",
        });
        setDeleteDialogOpen(false);
        setSelectedTopic(null);
        router.refresh();
      } else {
        toast.error("Error", {
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-end">
        {canEdit && (
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Topic
          </Button>
        )}
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  onClick={() => {
                    setSelectedTopic(row.original);
                    setSubscribersSheetOpen(true);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={
                        cell.column.id === "actions"
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                    >
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
                    <p className="text-muted-foreground">No topics found</p>
                    {canEdit && (
                      <Button
                        onClick={() => setCreateDialogOpen(true)}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create your first topic
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
      <TopicFormDialog
        isPending={isPending}
        mode="create"
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTopic}
        open={createDialogOpen}
      />

      {/* Edit Dialog */}
      <TopicFormDialog
        isPending={isPending}
        mode="edit"
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedTopic(null);
          }
        }}
        onSubmit={handleUpdateTopic}
        open={editDialogOpen}
        topic={selectedTopic}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Topic</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedTopic?.name}&quot;?
              This will remove all {selectedTopic?.subscriberCount || 0}{" "}
              subscriptions. This action cannot be undone.
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
              onClick={handleDeleteTopic}
              variant="destructive"
            >
              {isPending ? "Deleting\u2026" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscribers Sheet */}
      <TopicSubscribersSheet
        canEdit={canEdit}
        onClose={() => {
          setSubscribersSheetOpen(false);
          setSelectedTopic(null);
        }}
        onDelete={() => {
          setSubscribersSheetOpen(false);
          setDeleteDialogOpen(true);
        }}
        onEdit={() => {
          setSubscribersSheetOpen(false);
          setEditDialogOpen(true);
        }}
        open={subscribersSheetOpen}
        organizationId={organizationId}
        topic={selectedTopic}
      />
    </div>
  );
}
