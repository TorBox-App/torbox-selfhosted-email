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
      <ChangelogPageContent />
    </>
  );
}
