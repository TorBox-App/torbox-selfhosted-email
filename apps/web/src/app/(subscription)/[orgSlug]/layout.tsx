import { auth } from "@wraps/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getOrganizationWithMembership } from "@/lib/organization";

type SubscriptionLayoutProps = {
  children: ReactNode;
  params: Promise<{
    orgSlug: string;
  }>;
};

/**
 * Layout for subscription-related pages (upgrade, billing)
 * This layout validates org membership but does NOT check for active subscription
 * (since these pages are for users who need to subscribe)
 */
export default async function SubscriptionLayout({
  children,
  params,
}: SubscriptionLayoutProps) {
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

  return <>{children}</>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  return {
    title: "Subscribe | Wraps",
    description: "Subscribe to Wraps dashboard",
  };
}
