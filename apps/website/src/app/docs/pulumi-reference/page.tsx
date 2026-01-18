import type { Metadata } from "next";
import PulumiReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "Pulumi Component Reference",
  description: "Deploy Wraps infrastructure with Pulumi.",
  openGraph: {
    title: "Pulumi Component Reference | Wraps",
    description: "Deploy Wraps infrastructure with Pulumi.",
    type: "website",
    url: "https://wraps.dev/docs/pulumi-reference",
  },
  twitter: {
    title: "Pulumi Component Reference | Wraps",
    description: "Deploy Wraps infrastructure with Pulumi.",
  },
};

export default function PulumiReferencePage() {
  return <PulumiReferencePageContent />;
}
