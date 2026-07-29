/**
 * Public Layout
 *
 * Layout for public pages that don't require authentication.
 * Used for unsubscribe/preferences pages accessed via email links.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: "noindex, nofollow", // Don't index preference pages
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="pb-16">{children}</main>
      <footer className="fixed right-0 bottom-0 left-0 py-4 text-center">
        <a
          className="text-gray-400 text-xs transition-colors hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
          href="https://wraps.dev"
          rel="noopener noreferrer"
          target="_blank"
        >
          Powered by Wraps
        </a>
      </footer>
    </div>
  );
}
