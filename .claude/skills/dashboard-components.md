# Dashboard Components Skill

You are an expert at building dashboard pages and components for the Next.js web app.

## Page Structure

All dashboard pages follow this pattern:

```typescript
// apps/web/src/app/(dashboard)/[orgSlug]/my-page/page.tsx

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrganizationWithMembership } from "@/lib/organization";
import { checkFeatureAccess } from "@/lib/plan-limits";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
};

export default async function MyPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const { page = "1", search } = await searchParams;

  // 1. Auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  // 2. Org access verification
  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    redirect("/");
  }

  // 3. Feature access check
  const featureAccess = await checkFeatureAccess(
    orgWithMembership.id,
    "my-feature"
  );

  // 4. Fetch data in parallel
  const [dataResult, otherData] = await Promise.all([
    listData(orgWithMembership.id, { page: Number(page), search }),
    getOtherData(orgWithMembership.id),
  ]);

  // 5. Handle feature gate
  if (!featureAccess.allowed) {
    return (
      <>
        <PageHeader title="My Feature" />
        <FeatureGate
          isAllowed={false}
          currentPlanId={featureAccess.currentPlan}
          requiredPlanId={featureAccess.requiredPlan}
          feature="My Feature"
          orgSlug={orgSlug}
        />
      </>
    );
  }

  // 6. Render page
  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-2xl tracking-tight">My Page</h1>
          <p className="text-muted-foreground">Description here</p>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6">
        <MyDataTable
          data={dataResult.success ? dataResult.data : []}
          total={dataResult.total || 0}
          page={Number(page)}
          userRole={orgWithMembership.role}
        />
      </div>
    </>
  );
}
```

## Server Actions

```typescript
// apps/web/src/actions/my-feature.ts
"use server";

import { revalidatePath } from "next/cache";
import { db, myTable, eq, and } from "@wraps/db";

type CreateResult = { success: true; data: MyData } | { success: false; error: string };

export async function createItem(
  organizationId: string,
  data: { name: string; description?: string }
): Promise<CreateResult> {
  try {
    // 1. Verify org access (important!)
    const access = await verifyOrgAccess(organizationId);
    if (!access) {
      return { success: false, error: "Unauthorized" };
    }

    // 2. Check plan limits
    const limitCheck = await checkLimit(organizationId, "items");
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.message };
    }

    // 3. Database operation
    const [result] = await db
      .insert(myTable)
      .values({
        organizationId,
        name: data.name,
        description: data.description,
      })
      .returning();

    // 4. Revalidate cache
    revalidatePath(`/[orgSlug]/my-page`);

    return { success: true, data: result };
  } catch (error) {
    console.error("[createItem]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## Data Table Pattern

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useCallback } from "react";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { toast } from "sonner";

type TableProps = {
  data: MyData[];
  total: number;
  page: number;
  pageSize: number;
  userRole: "owner" | "admin" | "member";
};

export function MyDataTable({ data, total, page, pageSize, userRole }: TableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MyData | null>(null);

  // Table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      pagination: { pageIndex: page - 1, pageSize },
    },
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  // Search with URL params
  const handleSearch = useCallback((value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }, [router]);

  // Create action
  const handleCreate = async (formData: CreateFormData) => {
    startTransition(async () => {
      const result = await createItem(organizationId, formData);

      if (result.success) {
        toast.success("Item created");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error("Error", { description: result.error });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <SearchInput onSearch={handleSearch} />
        <Button onClick={() => setDialogOpen(true)}>Add Item</Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  No items found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination page={page} pageCount={Math.ceil(total / pageSize)} />

      {/* Dialog */}
      <CreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
        isPending={isPending}
      />
    </div>
  );
}
```

## Form Dialog Pattern

```typescript
"use client";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  item?: MyData | null;  // For edit mode
};

export function ItemFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  item,
}: DialogProps) {
  const [name, setName] = useState("");
  const mode = item ? "edit" : "create";

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(item?.name || "");
    }
  }, [open, item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Item" : "Edit Item"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Saving..." : mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## Feature Gating

```typescript
// Server-side check
const featureAccess = await checkFeatureAccess(orgId, "segments");

if (!featureAccess.allowed) {
  return (
    <FeatureGate
      isAllowed={false}
      currentPlanId={featureAccess.currentPlan}
      requiredPlanId="pro"
      feature="Segments"
      featureDescription="Create dynamic audience segments"
      orgSlug={orgSlug}
    />
  );
}

// Client-side conditional
{proFeaturesEnabled ? (
  <AdvancedOptions {...props} />
) : (
  <div className="rounded-md border border-dashed p-3">
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <Lock className="h-4 w-4" />
      <span>Requires Pro plan</span>
    </div>
  </div>
)}
```

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useActiveOrganization()` | Current org + role |
| `useTransition()` | Track async action state |
| `useRouter()` | Navigation |
| `useSearchParams()` | URL query params |

## Key Patterns

1. **Server Components for data** - Fetch in page.tsx
2. **Client Components for interaction** - Tables, forms, dialogs
3. **Server Actions for mutations** - Create, update, delete
4. **useTransition for loading** - Disable buttons during action
5. **router.refresh()** - Revalidate after mutation
6. **URL-based pagination** - Search params, not state

## Common Mistakes

1. **Missing auth check** - Always verify session
2. **Missing org scoping** - Verify user belongs to org
3. **Forgetting revalidatePath** - Data won't update
4. **Not using startTransition** - No loading state
5. **Direct fetch in client** - Use server actions instead
