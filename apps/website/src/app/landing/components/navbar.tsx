"use client";

import { ChevronDown, Github, Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { trackEvent } from "@/utils/analytics";

const navigationItems = [
  {
    name: "Products",
    href: "/#features",
    hasSubmenu: true,
    submenuType: "features",
  },
  { name: "Docs", href: "/docs", hasSubmenu: true, submenuType: "docs" },
  { name: "Blog", href: "/blog" },
  { name: "Pricing", href: "/#pricing" },
  { name: "SMS", href: "/sms", badge: "Soon" },
];

// Features menu items
const featuresItems = [
  {
    name: "CLI & SDK",
    href: "/cli",
    description: "Free tools to deploy and send emails",
  },
  {
    name: "Platform",
    href: "/platform",
    description: "Wraps Platform for templates & broadcasts",
  },
  {
    name: "Email Tools",
    href: "/tools",
    description: "Check your email deliverability setup",
  },
  {
    name: "Calculator",
    href: "/calculator",
    description: "Estimate your AWS email costs",
  },
];

// Docs menu items for mobile
const docsItems = [
  { title: "Getting Started" },
  { name: "Quickstart", href: "/docs/quickstart" },
  { name: "CLI Reference", href: "/docs/cli-reference" },
  { name: "SDK Reference", href: "/docs/sdk-reference" },
  { title: "Infrastructure as Code" },
  { name: "CDK Reference", href: "/docs/cdk-reference" },
  { name: "Pulumi Reference", href: "/docs/pulumi-reference" },
  { title: "Resources" },
  { name: "Changelog", href: "/changelog" },
  { name: "GitHub Repository", href: "https://github.com/wraps-team/wraps" },
  { name: "TypeScript SDK", href: "https://github.com/wraps-team/wraps-js" },
  {
    name: "npm Package",
    href: "https://www.npmjs.com/package/@wraps.dev/email",
  },
];

// Smooth scroll function - only works when element exists on page
const smoothScrollTo = (targetId: string) => {
  const hash = targetId.startsWith("/#") ? targetId.slice(1) : targetId;
  if (hash.startsWith("#")) {
    const element = document.querySelector(hash);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return true;
    }
  }
  return false;
};

// Check if href is a hash link (starts with # or /#)
const isHashLink = (href: string) =>
  href.startsWith("#") || href.startsWith("/#");

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const { setTheme, theme } = useTheme();

  // Handle hash scrolling on page load (for navigation from other pages)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Small delay to ensure the page has rendered
      const timeoutId = setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center">
          <a className="flex cursor-pointer items-center" href="/">
            <Logo size={32} />
          </a>
        </div>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden xl:flex">
          <NavigationMenuList>
            {navigationItems.map((item) => (
              <NavigationMenuItem key={item.name}>
                {item.hasSubmenu ? (
                  <>
                    <NavigationMenuTrigger
                      className="cursor-pointer bg-transparent px-4 py-2 font-medium text-sm transition-colors hover:bg-transparent hover:text-primary focus:bg-transparent focus:text-primary data-[state=open]:bg-transparent data-active:bg-transparent"
                      onClick={() => {
                        if (item.submenuType === "docs") {
                          window.location.href = item.href;
                        }
                      }}
                    >
                      {item.name}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      {item.submenuType === "features" ? (
                        <div className="grid w-[320px] gap-2 p-4">
                          {featuresItems.map((featureItem) => (
                            <NavigationMenuLink asChild key={featureItem.name}>
                              <a
                                className="block cursor-pointer select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                href={featureItem.href}
                              >
                                <div className="mb-1 font-medium text-sm leading-none">
                                  {featureItem.name}
                                </div>
                                <p className="text-muted-foreground text-xs leading-snug">
                                  {featureItem.description}
                                </p>
                              </a>
                            </NavigationMenuLink>
                          ))}
                        </div>
                      ) : (
                        <div className="grid w-[400px] gap-3 p-4">
                          {docsItems.map((docItem) =>
                            docItem.title ? (
                              <div
                                className="px-2 py-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider"
                                key={`title-${docItem.title}`}
                              >
                                {docItem.title}
                              </div>
                            ) : (
                              <NavigationMenuLink asChild key={docItem.name}>
                                <a
                                  className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                  href={docItem.href || "#"}
                                  rel={
                                    docItem.href?.startsWith("http")
                                      ? "noopener noreferrer"
                                      : undefined
                                  }
                                  target={
                                    docItem.href?.startsWith("http")
                                      ? "_blank"
                                      : undefined
                                  }
                                >
                                  <div className="font-medium text-sm leading-none">
                                    {docItem.name}
                                  </div>
                                </a>
                              </NavigationMenuLink>
                            )
                          )}
                        </div>
                      )}
                    </NavigationMenuContent>
                  </>
                ) : (
                  <NavigationMenuLink
                    className="group inline-flex h-10 w-max cursor-pointer items-center justify-center px-4 py-2 font-medium text-sm transition-colors hover:text-primary focus:text-primary focus:outline-none"
                    href={item.href}
                    onClick={(e) => {
                      // Try smooth scroll for hash links (works if element exists on page)
                      // Otherwise let browser navigate to /#hash
                      if (isHashLink(item.href) && smoothScrollTo(item.href)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {item.name}
                      {item.badge && (
                        <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 font-medium text-[10px] text-orange-600 dark:text-orange-400">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </NavigationMenuLink>
                )}
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Desktop CTA */}
        <div className="hidden items-center space-x-2 xl:flex">
          <ModeToggle variant="ghost" />
          <Button
            asChild
            className="cursor-pointer"
            size="icon"
            variant="ghost"
          >
            <a
              aria-label="GitHub Repository"
              href="https://github.com/wraps-team/wraps"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Github aria-hidden="true" className="h-5 w-5" />
            </a>
          </Button>
          <Button asChild className="cursor-pointer" variant="outline">
            <a href="/docs">Documentation</a>
          </Button>
          <Button
            asChild
            className="cursor-pointer bg-orange-500 text-white hover:bg-orange-600"
          >
            <a
              href="https://app.wraps.dev/auth?mode=signup"
              onClick={() =>
                trackEvent("cta_click", {
                  location: "navbar_desktop",
                  cta_text: "Start for free",
                })
              }
              rel="noopener noreferrer"
              target="_blank"
            >
              Start for free
            </a>
          </Button>
        </div>

        {/* Mobile Menu */}
        <Sheet onOpenChange={setIsOpen} open={isOpen}>
          <SheetTrigger asChild className="xl:hidden">
            <Button className="cursor-pointer" size="icon" variant="ghost">
              <Menu aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:w-[400px] [&>button]:hidden"
            side="right"
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <SheetHeader className="space-y-0 border-b p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Logo size={24} />
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      aria-label={
                        theme === "light"
                          ? "Switch to dark mode"
                          : "Switch to light mode"
                      }
                      className="h-8 w-8 cursor-pointer"
                      onClick={() =>
                        setTheme(theme === "light" ? "dark" : "light")
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <Moon
                        aria-hidden="true"
                        className="dark:-rotate-90 h-4 w-4 rotate-0 scale-100 transition-all dark:scale-0"
                      />
                      <Sun
                        aria-hidden="true"
                        className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
                      />
                    </Button>
                    <Button
                      asChild
                      className="h-8 w-8 cursor-pointer"
                      size="icon"
                      variant="ghost"
                    >
                      <a
                        aria-label="GitHub Repository"
                        href="https://github.com/wraps-team/wraps"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Github aria-hidden="true" className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      aria-label="Close menu"
                      className="h-8 w-8 cursor-pointer"
                      onClick={() => setIsOpen(false)}
                      size="icon"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Navigation Links */}
              <div className="flex-1 overflow-y-auto">
                <nav className="space-y-1 p-6">
                  {navigationItems.map((item) => (
                    <div key={item.name}>
                      {item.hasSubmenu ? (
                        item.submenuType === "features" ? (
                          <Collapsible
                            onOpenChange={setFeaturesOpen}
                            open={featuresOpen}
                          >
                            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-3 font-medium text-base transition-colors hover:bg-accent hover:text-accent-foreground">
                              {item.name}
                              <ChevronDown
                                aria-hidden="true"
                                className={`h-4 w-4 transition-transform ${featuresOpen ? "rotate-180" : ""}`}
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-1 pl-4">
                              {featuresItems.map((featureItem) => (
                                <a
                                  className="flex cursor-pointer flex-col rounded-lg px-4 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
                                  href={featureItem.href}
                                  key={featureItem.name}
                                  onClick={() => setIsOpen(false)}
                                >
                                  <span className="font-medium text-sm">
                                    {featureItem.name}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {featureItem.description}
                                  </span>
                                </a>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <Collapsible
                            onOpenChange={setDocsOpen}
                            open={docsOpen}
                          >
                            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-3 font-medium text-base transition-colors hover:bg-accent hover:text-accent-foreground">
                              {item.name}
                              <ChevronDown
                                aria-hidden="true"
                                className={`h-4 w-4 transition-transform ${docsOpen ? "rotate-180" : ""}`}
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-1 pl-4">
                              {docsItems.map((docItem) =>
                                docItem.title ? (
                                  <div
                                    className="mt-5 px-4 py-2 font-semibold text-muted-foreground/50 text-xs uppercase tracking-wider"
                                    key={`title-${docItem.title}`}
                                  >
                                    {docItem.title}
                                  </div>
                                ) : (
                                  <a
                                    className="flex cursor-pointer items-center rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                    href={docItem.href || "#"}
                                    key={docItem.name}
                                    onClick={() => {
                                      setIsOpen(false);
                                    }}
                                    rel={
                                      docItem.href?.startsWith("http")
                                        ? "noopener noreferrer"
                                        : undefined
                                    }
                                    target={
                                      docItem.href?.startsWith("http")
                                        ? "_blank"
                                        : undefined
                                    }
                                  >
                                    {docItem.name}
                                  </a>
                                )
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      ) : (
                        <a
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-3 font-medium text-base transition-colors hover:bg-accent hover:text-accent-foreground"
                          href={item.href}
                          onClick={(e) => {
                            setIsOpen(false);
                            if (isHashLink(item.href)) {
                              // Check if element exists on current page
                              const hash = item.href.startsWith("/#")
                                ? item.href.slice(1)
                                : item.href;
                              const element = document.querySelector(hash);
                              if (element) {
                                // Element exists, smooth scroll after menu closes
                                e.preventDefault();
                                setTimeout(
                                  () => smoothScrollTo(item.href),
                                  100
                                );
                              }
                              // Otherwise let browser navigate to /#hash
                            }
                          }}
                        >
                          {item.name}
                          {item.badge && (
                            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 font-medium text-orange-600 text-xs dark:text-orange-400">
                              {item.badge}
                            </span>
                          )}
                        </a>
                      )}
                    </div>
                  ))}
                </nav>
              </div>

              {/* Footer Actions */}
              <div className="space-y-4 border-t p-6">
                {/* Primary Actions */}
                <div className="space-y-3">
                  <Button
                    asChild
                    className="w-full cursor-pointer bg-orange-500 text-white hover:bg-orange-600"
                    size="lg"
                  >
                    <a
                      href="https://app.wraps.dev/auth?mode=signup&plan=starter"
                      onClick={() => {
                        trackEvent("cta_click", {
                          location: "navbar_mobile",
                          cta_text: "Get Platform",
                        });
                        setIsOpen(false);
                      }}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Get Platform
                    </a>
                  </Button>

                  <Button
                    asChild
                    className="w-full cursor-pointer"
                    size="lg"
                    variant="outline"
                  >
                    <a href="/docs">Documentation</a>
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
