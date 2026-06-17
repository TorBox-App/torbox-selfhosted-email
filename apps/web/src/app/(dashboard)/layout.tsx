import { auth } from "@wraps/auth";
import { headers } from "next/headers";
import type React from "react";
import { OrganizationProvider } from "@/contexts/organization-context";
import { getUserOrganizations } from "@/lib/organization";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  // Seed the org switcher with server-rendered data so it renders instantly
  // instead of waiting on two client-side /api/auth round-trips.
  const memberships = session?.user
    ? await getUserOrganizations(session.user.id)
    : [];
  const initialOrganizations = memberships.map((m) => m.organization);

  const activeId = (
    session?.session as { activeOrganizationId?: string | null } | undefined
  )?.activeOrganizationId;
  const active = activeId
    ? memberships.find((m) => m.organization.id === activeId)
    : null;
  const initialActiveOrganization = active?.organization ?? null;
  const initialUserRole = active?.role ?? null;

  return (
    <OrganizationProvider
      initialActiveOrganization={initialActiveOrganization}
      initialOrganizations={initialOrganizations}
      initialUserRole={initialUserRole}
    >
      <DashboardShell>{children}</DashboardShell>
    </OrganizationProvider>
  );
}
