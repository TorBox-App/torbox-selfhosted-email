import { auth } from "@wraps/auth";
import { redirect } from "next/navigation";
import { OrganizationSettingsMembers } from "@/components/organization-settings-members";
import { getOrganizationWithMembership } from "@/lib/organization";

type MembersPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function MembersPage({ params }: MembersPageProps) {
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

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="font-bold text-3xl">Team Members</h1>
        <p className="text-muted-foreground">
          Manage team members and their access to your organization.
        </p>
      </div>

      <OrganizationSettingsMembers
        organization={orgWithMembership}
        userRole={orgWithMembership.userRole}
      />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    return { title: "Team Members" };
  }

  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    return { title: "Organization Not Found" };
  }

  return {
    title: `Team Members | ${orgWithMembership.name} | Wraps`,
    description: `Manage team members for ${orgWithMembership.name}`,
  };
}
