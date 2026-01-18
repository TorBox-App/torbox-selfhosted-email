import type { Metadata } from "next";
import GuidesPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "In-depth guides for production access, domain verification, and AWS setup.",
  openGraph: {
    title: "Guides | Wraps",
    description:
      "In-depth guides for production access, domain verification, and AWS setup.",
    type: "website",
    url: "https://wraps.dev/docs/guides",
  },
  twitter: {
    title: "Guides | Wraps",
    description:
      "In-depth guides for production access, domain verification, and AWS setup.",
  },
};

export default function GuidesPage() {
  return <GuidesPageContent />;
}
