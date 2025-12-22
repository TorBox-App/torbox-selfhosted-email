import { auth } from "@wraps/auth";
import { redirect } from "next/navigation";
import { OrganizationSettingsAwsAccounts } from "@/components/organization-settings-aws-accounts";
import {
  getOrganizationPlanId,
  getOrganizationWithMembership,
} from "@/lib/organization";

type AwsAccountsPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function AwsAccountsPage({
  params,
}: AwsAccountsPageProps) {
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

  const planId = await getOrganizationPlanId(orgWithMembership.id);

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="font-bold text-3xl">AWS Accounts</h1>
        <p className="text-muted-foreground">
          Manage your connected AWS accounts and infrastructure.
        </p>
      </div>

      <OrganizationSettingsAwsAccounts
        organization={orgWithMembership}
        planId={planId}
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
    return { title: "AWS Accounts" };
  }

  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    return { title: "Organization Not Found" };
  }

  return {
    title: `AWS Accounts | ${orgWithMembership.name} | Wraps`,
    description: `Manage AWS accounts for ${orgWithMembership.name}`,
  };
}
