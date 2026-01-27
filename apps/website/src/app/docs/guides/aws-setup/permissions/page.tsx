import type { Metadata } from "next";
import PermissionsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "IAM Permissions",
  description:
    "Required AWS IAM permissions for deploying Wraps infrastructure.",
  openGraph: {
    title: "IAM Permissions | Wraps",
    description:
      "Required AWS IAM permissions for deploying Wraps infrastructure.",
    type: "website",
    url: "https://wraps.dev/docs/guides/aws-setup/permissions",
  },
  twitter: {
    title: "IAM Permissions | Wraps",
    description:
      "Required AWS IAM permissions for deploying Wraps infrastructure.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/guides/aws-setup/permissions",
  },
};

export default function PermissionsPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article className="sr-only" aria-hidden="true">
        <h1>IAM Permissions</h1>
        <p>Required AWS IAM permissions for deploying Wraps infrastructure.</p>
      </article>
      <PermissionsPageContent />
    </>
  );
}
