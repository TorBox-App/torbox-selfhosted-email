import type { Metadata } from "next";
import CLIReferenceCdnPageContent from "./page-content";

export const metadata: Metadata = {
  title: "CDN CLI Commands",
  description: "CLI commands for managing CDN infrastructure.",
  openGraph: {
    title: "CDN CLI Commands | Wraps",
    description: "CLI commands for managing CDN infrastructure.",
    type: "website",
    url: "https://wraps.dev/docs/cli-reference/cdn",
  },
  twitter: {
    title: "CDN CLI Commands | Wraps",
    description: "CLI commands for managing CDN infrastructure.",
  },
};

export default function CLIReferenceCdnPage() {
  return <CLIReferenceCdnPageContent />;
}
