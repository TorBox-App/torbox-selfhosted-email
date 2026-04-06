"use client";

import { BookOpen, Calendar, CircleHelp, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const CAL_BOOKING_URL = "https://cal.com/wraps/get-started-with-wraps";

export function NavHelp() {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <CircleHelp className="size-4" />
              <span>Need Help?</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-56 rounded-lg"
            side={isMobile ? "top" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              We usually respond in &lt;30 mins
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="cursor-pointer">
                <a
                  href="https://wraps.dev/docs/quickstart"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <BookOpen />
                  Quick Start
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <a href="mailto:support@wraps.dev">
                  <Mail />
                  Email support@wraps.dev
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <a
                  href={CAL_BOOKING_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Calendar />
                  Book a 15m call
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
