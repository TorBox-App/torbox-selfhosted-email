import type { Metadata } from "next";
import DashboardPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Wraps Platform",
  description:
    "Templates, broadcasts, contacts, and analytics. The premium layer on top of your AWS infrastructure.",
  openGraph: {
    title: "Wraps Platform | Wraps",
    description:
      "Templates, broadcasts, contacts, and analytics. The premium layer on top of your AWS infrastructure.",
    images: [
      {
        url: "/wraps-platform-og.png",
        width: 1424,
        height: 752,
        alt: "Wraps Platform - Templates, broadcasts, contacts, and analytics",
      },
    ],
  },
  twitter: {
    title: "Wraps Platform | Wraps",
    description:
      "Templates, broadcasts, contacts, and analytics. The premium layer on top of your AWS infrastructure.",
    images: ["/wraps-platform-og.png"],
  },
  alternates: {
    canonical: "https://wraps.dev/platform",
  },
};

export default function DashboardPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>Wraps Platform</h1>
        <p>
          Templates, broadcasts, contacts, and analytics. The premium layer on
          top of your AWS infrastructure.
        </p>
        <h2>Template Builder</h2>
        <h2>Broadcast Campaigns</h2>
        <h2>Contact Management</h2>
        <h2>Analytics Dashboard</h2>
      </article>
      <DashboardPageContent />
    </>
  );
}
