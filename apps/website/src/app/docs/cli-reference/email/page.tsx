import type { Metadata } from "next";
import CLIReferenceEmailPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Email CLI Commands",
  description: "CLI commands for managing email infrastructure.",
  openGraph: {
    title: "Email CLI Commands | Wraps",
    description: "CLI commands for managing email infrastructure.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference/email",
  },
  twitter: {
    title: "Email CLI Commands | Wraps",
    description: "CLI commands for managing email infrastructure.",
  },
};

export default function CLIReferenceEmailPage() {
  return <CLIReferenceEmailPageContent />;
}
