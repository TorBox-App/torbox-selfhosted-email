import { auth } from "@wraps/auth";
import { redirect } from "next/navigation";
import { listWorkflows } from "@/actions/workflows";
import { getOrganizationWithMembership } from "@/lib/organization";
import { WorkflowsTable } from "./components/workflows-table";

type AutomationsPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
  }>;
};

export default async function AutomationsPage({
  params,
  searchParams,
}: AutomationsPageProps) {
  const { orgSlug } = await params;
  const { page = "1", pageSize = "20", search, status } = await searchParams;

  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    redirect("/");
  }

  // Fetch workflows
  const workflowsResult = await listWorkflows(orgWithMembership.id, {
    page: Number.parseInt(page, 10),
    pageSize: Number.parseInt(pageSize, 10),
    search: search || undefined,
    status: status as "draft" | "enabled" | "paused" | "archived" | undefined,
  });

  const workflows = workflowsResult.success ? workflowsResult.workflows : [];
  const total = workflowsResult.success ? workflowsResult.total : 0;

  return (
    <>
      {/* Page Title and Description */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-2xl tracking-tight">Automations</h1>
          <p className="text-muted-foreground">
            Create automated workflows triggered by events
          </p>
        </div>
      </div>

      {/* Workflows Table */}
      <div className="@container/main px-4 lg:px-6">
        <WorkflowsTable
          organizationId={orgWithMembership.id}
          orgSlug={orgSlug}
          total={total}
          userRole={orgWithMembership.userRole}
          workflows={workflows}
        />
      </div>
    </>
  );
}
