"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    icon: LucideIcon;
    isActive?: boolean;
    items: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  // Check if any subitem is active to determine if parent should be open
  const isGroupActive = (group: (typeof items)[0]) => {
    if (group.isActive) {
      return true;
    }
    return group.items.some(
      (subItem) =>
        pathname === subItem.url || pathname.startsWith(`${subItem.url}/`)
    );
  };

  const isSubItemActive = (url: string) =>
    pathname === url || pathname.startsWith(`${url}/`);

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) =>
          isCollapsed ? (
            // Collapsed: show hover card with sub-items
            <HoverCard key={item.title} openDelay={0} closeDelay={100}>
              <HoverCardTrigger asChild>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isGroupActive(item)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </HoverCardTrigger>
              <HoverCardContent
                side="right"
                align="start"
                sideOffset={8}
                className="w-48 p-2"
              >
                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1.5 text-sm font-medium">
                    {item.title}
                  </div>
                  {item.items.map((subItem) => (
                    <Link
                      key={subItem.title}
                      href={subItem.url}
                      className={`rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                        isSubItemActive(subItem.url)
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {subItem.title}
                    </Link>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            // Expanded: show collapsible with sub-items
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isGroupActive(item)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isSubItemActive(subItem.url)}
                        >
                          <Link href={subItem.url}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
