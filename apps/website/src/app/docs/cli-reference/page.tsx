import type { Metadata } from "next";
import CLIReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "CLI Reference",
  description: "Complete reference for all Wraps CLI commands.",
  openGraph: {
    title: "CLI Reference | Wraps",
    description: "Complete reference for all Wraps CLI commands.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference",
  },
  twitter: {
    title: "CLI Reference | Wraps",
    description: "Complete reference for all Wraps CLI commands.",
  },
};

export default function CLIReferencePage() {
  return <CLIReferencePageContent />;
}
