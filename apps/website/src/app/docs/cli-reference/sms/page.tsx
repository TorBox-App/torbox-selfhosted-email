import type { Metadata } from "next";
import CLIReferenceSMSPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS CLI Commands",
  description: "CLI commands for managing SMS infrastructure.",
  openGraph: {
    title: "SMS CLI Commands | Wraps",
    description: "CLI commands for managing SMS infrastructure.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference/sms",
  },
  twitter: {
    title: "SMS CLI Commands | Wraps",
    description: "CLI commands for managing SMS infrastructure.",
  },
};

export default function CLIReferenceSMSPage() {
  return <CLIReferenceSMSPageContent />;
}
