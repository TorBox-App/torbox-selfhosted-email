"use client";

import type { organization } from "@wraps/db";
import type { InferSelectModel } from "drizzle-orm";
import { useParams, useRouter } from "next/navigation";
import posthog from "posthog-js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { authClient } from "@/lib/auth-client";

type OrganizationContextValue = {
  activeOrganization: InferSelectModel<typeof organization> | null;
  isLoading: boolean;
  setActiveOrganization: (orgSlug: string) => Promise<void>;
  organizations: InferSelectModel<typeof organization>[];
  userRole: "owner" | "admin" | "member" | null;
};

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams<{ orgSlug?: string }>();
  const { data: activeOrgData, isPending } = authClient.useActiveOrganization();
  const [organizations, setOrganizations] = useState<
    InferSelectModel<typeof organization>[]
  >([]);
  const autoSetAttempted = useRef(false);

  // Fetch all user's organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
      const { data } = await authClient.organization.list();
      if (data) {
        const orgs = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          slug: item.slug || null,
          logo: item.logo || null,
          brandColor: item.brandColor || null,
          metadata: item.metadata || null,
          stripeOrganizationId: item.stripeOrganizationId || null,
          createdAt: new Date(item.createdAt),
        }));
        setOrganizations(orgs);
      }
    };

    fetchOrganizations();
  }, []);

  // Identify organization group in PostHog when active org changes
  useEffect(() => {
    if (!activeOrgData) {
      return;
    }
    const orgData = (activeOrgData as any).organization || activeOrgData;
    if (orgData?.id) {
      posthog.group("organization", orgData.id, {
        name: orgData.name,
        slug: orgData.slug,
      });
    }
  }, [activeOrgData]);

  // Auto-set active org from URL when session has no active org
  // (e.g., after deleting the previously active org)
  useEffect(() => {
    if (isPending || activeOrgData || autoSetAttempted.current) {
      return;
    }
    if (!params.orgSlug) {
      return;
    }

    autoSetAttempted.current = true;
    authClient.organization.setActive({
      organizationSlug: params.orgSlug,
    });
  }, [isPending, activeOrgData, params.orgSlug]);

  const setActiveOrganization = async (orgSlug: string) => {
    const { data, error } = await authClient.organization.setActive({
      organizationSlug: orgSlug,
    });

    if (!error && data) {
      router.push(`/${orgSlug}/emails`);
    }
  };

  // Map better-auth organization to our format
  const activeOrg = activeOrgData
    ? (() => {
        const orgData = (activeOrgData as any).organization || activeOrgData;
        return {
          id: orgData.id,
          name: orgData.name,
          slug: orgData.slug || null,
          logo: orgData.logo || null,
          brandColor: orgData.brandColor || null,
          metadata: orgData.metadata || null,
          stripeOrganizationId: orgData.stripeOrganizationId || null,
          createdAt: orgData.createdAt
            ? new Date(orgData.createdAt)
            : new Date(),
        };
      })()
    : null;

  const value: OrganizationContextValue = {
    activeOrganization: activeOrg,
    isLoading: isPending,
    setActiveOrganization,
    organizations,
    userRole: ((activeOrgData as any)?.role ?? null) as
      | "owner"
      | "admin"
      | "member"
      | null,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useActiveOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useActiveOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}
