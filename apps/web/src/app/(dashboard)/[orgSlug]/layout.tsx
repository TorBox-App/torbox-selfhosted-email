import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { organizationExtension } from "@wraps/db/schema/app";
import { subscription } from "@wraps/db/schema/auth";
import { and, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getOrganizationWithMembership } from "@/lib/organization";

type OrganizationLayoutProps = {
  children: ReactNode;
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
  const { orgSlug } = await params;
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  // Validate user has access to this organization
  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    // User doesn't have access to this organization
    redirect("/");
  }

  // Check if onboarding is completed
  const extension = await db.query.organizationExtension.findFirst({
    where: eq(organizationExtension.organizationId, orgWithMembership.id),
  });

  // Redirect to onboarding if not completed
  if (!extension?.onboardingCompleted) {
    redirect(`/${orgSlug}/onboarding`);
  }

  // Verify user has an active subscription (required for dashboard access)
  // Users must subscribe during onboarding to access the dashboard
  const activeSubscription = await db.query.subscription.findFirst({
    where: and(
      eq(subscription.referenceId, orgWithMembership.id),
      or(eq(subscription.status, "active"), eq(subscription.status, "trialing"))
    ),
  });

  // If subscription is cancelled/expired, redirect to upgrade page
  if (!activeSubscription) {
    redirect(`/${orgSlug}/upgrade`);
  }

  return <>{children}</>;
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
    return {
      title: "Organization",
    };
  }

  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    return {
      title: "Organization Not Found",
    };
  }

  return {
    title: `${orgWithMembership.name} | Wraps`,
    description: `${orgWithMembership.name} dashboard on Wraps`,
  };
}
