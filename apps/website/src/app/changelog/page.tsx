import type { Metadata } from "next";
import ChangelogPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Latest updates, improvements, and releases for Wraps CLI, SDK, and Platform.",
  openGraph: {
    title: "Changelog | Wraps",
    description:
      "Latest updates, improvements, and releases for Wraps CLI, SDK, and Platform.",
  },
  twitter: {
    title: "Changelog | Wraps",
    description:
      "Latest updates, improvements, and releases for Wraps CLI, SDK, and Platform.",
  },
  alternates: {
    canonical: "https://wraps.dev/changelog",
  },
};

export default function ChangelogPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Changelog</h1>
        <p>
          Latest updates, improvements, and releases for Wraps CLI, SDK, and
          Platform.
        </p>
      </article>
      <ChangelogPageContent />
    </>
  );
}
