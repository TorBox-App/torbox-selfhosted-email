import type { Metadata } from "next";
import CDKReferencePageContent from "./page-content";

export const metadata: Metadata = {
  title: "CDK Construct Reference",
  description: "Deploy Wraps infrastructure with AWS CDK.",
  openGraph: {
    title: "CDK Construct Reference | Wraps",
    description: "Deploy Wraps infrastructure with AWS CDK.",
    type: "website",
    url: "https://wraps.dev/docs/cdk-reference",
  },
  twitter: {
    title: "CDK Construct Reference | Wraps",
    description: "Deploy Wraps infrastructure with AWS CDK.",
  },
};

export default function CDKReferencePage() {
  return <CDKReferencePageContent />;
}
