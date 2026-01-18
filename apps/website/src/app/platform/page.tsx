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
  },
  twitter: {
    title: "Wraps Platform | Wraps",
    description:
      "Templates, broadcasts, contacts, and analytics. The premium layer on top of your AWS infrastructure.",
  },
};

export default function DashboardPage() {
  return <DashboardPageContent />;
}
