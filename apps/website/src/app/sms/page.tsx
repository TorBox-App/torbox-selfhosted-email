import type { Metadata } from "next";
import SmsPageContent from "./page-content";

export const metadata: Metadata = {
  title: "SMS Infrastructure",
  description:
    "Coming soon: Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  openGraph: {
    title: "SMS Infrastructure | Wraps",
    description:
      "Coming soon: Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  },
  twitter: {
    title: "SMS Infrastructure | Wraps",
    description:
      "Coming soon: Deploy SMS infrastructure to your AWS account with the same great DX as email.",
  },
  alternates: {
    canonical: "https://wraps.dev/sms",
  },
};

export default function SmsPage() {
  return (
    <>
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>SMS Infrastructure</h1>
        <p>
          Coming soon: Deploy SMS infrastructure to your AWS account with the
          same great DX as email.
        </p>
        <h2>Features</h2>
        <h2>Pricing</h2>
        <h2>SDK</h2>
      </article>
      <SmsPageContent />
    </>
  );
}
