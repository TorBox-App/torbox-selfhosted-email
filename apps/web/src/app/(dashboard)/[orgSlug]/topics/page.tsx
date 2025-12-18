import { auth } from "@wraps/auth";
import { redirect } from "next/navigation";
import { listTopics } from "@/actions/topics";
import { getOrganizationWithMembership } from "@/lib/organization";
import { TopicsTable } from "./components/topics-table";

type TopicsPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function TopicsPage({ params }: TopicsPageProps) {
  const { orgSlug } = await params;

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

  const topicsResult = await listTopics(orgWithMembership.id);
  const topics = topicsResult.success ? topicsResult.topics : [];

  return (
    <>
      {/* Page Title and Description */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-2xl tracking-tight">Topics</h1>
          <p className="text-muted-foreground">
            Manage subscription topics for your audience
          </p>
        </div>
      </div>

      {/* Topics Table */}
      <div className="@container/main px-4 lg:px-6">
        <TopicsTable
          organizationId={orgWithMembership.id}
          orgSlug={orgSlug}
          topics={topics}
          userRole={orgWithMembership.userRole}
        />
      </div>
    </>
  );
}
