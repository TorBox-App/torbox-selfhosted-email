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
};

export default function PermissionsPage() {
  return <PermissionsPageContent />;
}
