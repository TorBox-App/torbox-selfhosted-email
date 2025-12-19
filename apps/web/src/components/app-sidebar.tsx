"use client";

import { BarChart3, FileText, Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Logo } from "@/components/logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useActiveOrganization } from "@/contexts/organization-context";
import { useProductsStatus } from "@/hooks/use-products-status";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { activeOrganization } = useActiveOrganization();
  const orgSlug = activeOrganization?.slug ?? "";
  const { data: productsStatus } = useProductsStatus(orgSlug || undefined);

  // Check if products are enabled
  const isEmailEnabled =
    productsStatus?.products.find((p) => p.id === "email")?.enabled ?? true;
  const isSMSEnabled =
    productsStatus?.products.find((p) => p.id === "sms")?.enabled ?? false;

  // Email navigation - always shown with full nav if enabled, otherwise single link
  const emailNavGroup = orgSlug
    ? {
        label: "Email",
        items: isEmailEnabled
          ? [
              {
                title: "Emails",
                url: `/${orgSlug}/emails`,
                icon: Mail,
              },
              {
                title: "Templates",
                url: `/${orgSlug}/emails/templates`,
                icon: FileText,
              },
              {
                title: "Analytics",
                url: `/${orgSlug}/emails/analytics`,
                icon: BarChart3,
              },
            ]
          : [
              {
                title: "Setup Email",
                url: `/${orgSlug}/emails/setup`,
                icon: Mail,
              },
            ],
      }
    : null;

  // SMS navigation - full nav if enabled, otherwise single link to setup
  const smsNavGroup = orgSlug
    ? {
        label: "SMS",
        items: isSMSEnabled
          ? [
              {
                title: "SMS",
                url: `/${orgSlug}/sms`,
                icon: MessageSquare,
              },
              {
                title: "Analytics",
                url: `/${orgSlug}/sms/analytics`,
                icon: BarChart3,
              },
            ]
          : [
              {
                title: "Setup SMS",
                url: `/${orgSlug}/sms/setup`,
                icon: MessageSquare,
              },
            ],
      }
    : null;

  const orgScopedNavGroups = [emailNavGroup, smsNavGroup].filter(
    (g): g is NonNullable<typeof g> => g !== null
  );

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href={orgSlug ? `/${orgSlug}/emails` : "/"}>
                <Logo className="rounded-sm" size={42} />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {orgScopedNavGroups.map((group) => (
          <NavMain items={group.items} key={group.label} label={group.label} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {/* <SidebarNotification /> */}
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
