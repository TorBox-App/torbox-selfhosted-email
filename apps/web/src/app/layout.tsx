import type { Metadata } from "next";
import "./globals.css";

import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/contexts/query-client-context";
import { SessionProvider } from "@/contexts/session-context";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: "Wraps",
    template: "%s | Wraps",
  },
  description:
    "Deploy production-ready email infrastructure to your AWS account in minutes. Zero stored credentials, beautiful DX, and transparent AWS pricing.",
  icons: {
    icon: [
      { url: "/favicon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const isDark = themeCookie === "dark";

  return (
    <html className={`${inter.variable} antialiased${isDark ? " dark" : ""}`} lang="en">
      <body className={inter.className}>
        <NuqsAdapter>
          <QueryProvider>
            <SessionProvider>
              <ThemeProvider defaultTheme="system" storageKey="nextjs-ui-theme">
                <SidebarConfigProvider>{children}</SidebarConfigProvider>
                <Toaster />
              </ThemeProvider>
            </SessionProvider>
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
