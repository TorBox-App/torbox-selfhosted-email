"use client";

import { Command as CommandPrimitive } from "cmdk";
import {
  BarChart3,
  Building2,
  Cloud,
  CreditCard,
  FileText,
  Key,
  type LucideIcon,
  Mail,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/contexts/organization-context";
import { cn } from "@/lib/utils";

const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-xl bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input
    className={cn(
      "mb-4 flex h-12 w-full border-zinc-200 border-b border-none bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-zinc-500 dark:border-zinc-800 dark:placeholder:text-zinc-400",
      className
    )}
    ref={ref}
    {...props}
  />
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    className={cn(
      "max-h-[400px] overflow-y-auto overflow-x-hidden pb-2",
      className
    )}
    ref={ref}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    className="flex h-12 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400"
    ref={ref}
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    className={cn(
      "overflow-hidden px-2 [&:not(:first-child)]:mt-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400",
      className
    )}
    ref={ref}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & {
    shortcut?: string;
  }
>(({ className, shortcut, children, ...props }, ref) => (
  <CommandPrimitive.Item
    className={cn(
      "relative flex h-12 cursor-pointer select-none items-center gap-2 rounded-lg px-4 text-sm text-zinc-700 outline-none transition-colors data-[disabled=true]:pointer-events-none data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900 data-[disabled=true]:opacity-50 dark:text-zinc-300 dark:data-[selected=true]:bg-zinc-800 dark:data-[selected=true]:text-zinc-100 [&+[cmdk-item]]:mt-1",
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
    {shortcut && (
      <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] opacity-100 sm:flex">
        {shortcut}
      </kbd>
    )}
  </CommandPrimitive.Item>
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

type SearchItem = {
  title: string;
  url: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string[];
};

type CommandSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const router = useRouter();
  const commandRef = useRef<HTMLDivElement>(null);
  const { activeOrganization } = useActiveOrganization();

  const orgSlug = activeOrganization?.slug;

  // Build search items with org-aware URLs
  const searchItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];

    // Organization Navigation (only if org is selected)
    if (orgSlug) {
      items.push(
        {
          title: "Emails",
          url: `/${orgSlug}/emails`,
          group: "Navigation",
          icon: Mail,
          shortcut: "G E",
          keywords: ["inbox", "sent", "messages"],
        },
        {
          title: "Templates",
          url: `/${orgSlug}/templates`,
          group: "Navigation",
          icon: FileText,
          shortcut: "G T",
          keywords: ["email templates", "editor"],
        },
        {
          title: "Analytics",
          url: `/${orgSlug}/analytics`,
          group: "Navigation",
          icon: BarChart3,
          shortcut: "G A",
          keywords: ["metrics", "stats", "dashboard", "reports"],
        }
      );
    }

    // Organization Settings (only if org is selected)
    if (orgSlug) {
      items.push(
        {
          title: "General Settings",
          url: `/${orgSlug}/settings`,
          group: "Settings",
          icon: Building2,
          shortcut: "G S",
          keywords: ["org", "workspace", "organization"],
        },
        {
          title: "AWS Accounts",
          url: `/${orgSlug}/settings/aws-accounts`,
          group: "Settings",
          icon: Cloud,
          keywords: ["amazon", "ses", "infrastructure", "connect"],
        },
        {
          title: "API Keys",
          url: `/${orgSlug}/settings/api-keys`,
          group: "Settings",
          icon: Key,
          keywords: ["developer", "access", "token"],
        },
        {
          title: "Team Members",
          url: `/${orgSlug}/settings/members`,
          group: "Settings",
          icon: Users,
          keywords: ["invite", "permissions", "roles"],
        },
        {
          title: "Billing",
          url: `/${orgSlug}/settings/billing`,
          group: "Settings",
          icon: CreditCard,
          keywords: ["subscription", "plan", "payment"],
        }
      );
    }

    // User Account Settings (always available)
    items.push(
      {
        title: "Security",
        url: "/settings/security",
        group: "Account",
        icon: Shield,
        keywords: ["password", "2fa", "passkey", "sessions"],
      },
      {
        title: "Account Settings",
        url: "/settings/account",
        group: "Account",
        icon: Settings,
        keywords: ["delete", "preferences"],
      }
    );

    return items;
  }, [orgSlug]);

  const groupedItems = searchItems.reduce(
    (acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = [];
      }
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<string, SearchItem[]>
  );

  const handleSelect = useCallback(
    (url: string) => {
      router.push(url);
      onOpenChange(false);
      // Bounce effect like Vercel
      if (commandRef.current) {
        commandRef.current.style.transform = "scale(0.96)";
        setTimeout(() => {
          if (commandRef.current) {
            commandRef.current.style.transform = "";
          }
        }, 100);
      }
    },
    [router, onOpenChange]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-[640px] overflow-hidden border border-zinc-200 p-0 shadow-2xl dark:border-zinc-800">
        <DialogTitle className="sr-only">Command Search</DialogTitle>
        <Command
          className="transition-transform duration-100 ease-out"
          ref={commandRef}
        >
          <CommandInput autoFocus placeholder="Where do you want to go?" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {Object.entries(groupedItems).map(([group, items]) => (
              <CommandGroup heading={group} key={group}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.url}
                      keywords={item.keywords}
                      onSelect={() => handleSelect(item.url)}
                      shortcut={item.shortcut}
                      value={item.title}
                    >
                      {Icon && <Icon className="mr-2 h-4 w-4" />}
                      {item.title}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="relative inline-flex h-8 w-full items-center justify-start gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1 font-medium text-muted-foreground text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:pr-12 md:w-36 lg:w-56"
      onClick={onClick}
      type="button"
    >
      <Search className="mr-2 h-3.5 w-3.5" />
      <span className="hidden lg:inline-flex">Search...</span>
      <span className="inline-flex lg:hidden">Search...</span>
      <kbd className="pointer-events-none absolute top-1.5 right-1.5 hidden h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] opacity-100 sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
