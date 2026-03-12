"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useActiveOrganization } from "@/contexts/organization-context";
import { useProductsStore } from "@/stores/products-store";

export function SidebarInvite() {
  const { state } = useSidebar();
  const { activeOrganization } = useActiveOrganization();
  const productsStatus = useProductsStore((s) => s.status);

  const orgSlug = activeOrganization?.slug;
  const memberCount = productsStatus?.memberCount;

  // Only show for single-member orgs with expanded sidebar
  if (!(orgSlug && memberCount !== undefined && memberCount <= 1) || state === "collapsed") {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link
          aria-label="Invite your team"
          className="flex items-start gap-3 rounded-lg border border-border/50 bg-gradient-to-br from-sidebar-accent/50 to-sidebar-accent/20 p-3 text-sm transition-colors hover:border-border hover:bg-sidebar-accent"
          href={`/${orgSlug}/settings/members`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Invite your team</span>
            <span className="text-muted-foreground text-xs">
              Add a teammate to help build
            </span>
          </div>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
