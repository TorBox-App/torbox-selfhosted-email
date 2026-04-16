import type { Metadata } from "next";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { JsonLd } from "@/components/json-ld";
import { AgentsPromptSection } from "./components/agent-prompt-section";
import { AgentsCtaSection } from "./components/cta-section";
import { AgentsHeroSection } from "./components/hero-section";
import { AgentsRecipeSection } from "./components/recipe-section";
import { AgentsTrustSection } from "./components/trust-section";
import { AgentsWhyOwnSection } from "./components/why-own-section";

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Wraps for Agents",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Linux, Windows",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Email infrastructure your agent owns. Deploy AWS SES to your account, send transactional email from your agent's code, wire Wraps docs via MCP. No stored credentials, no vendor lock-in.",
  url: "https://wraps.dev/agents",
  author: {
    "@type": "Organization",
    name: "Wraps",
    url: "https://wraps.dev",
  },
  license: "https://opensource.org/licenses/AGPL-3.0",
  programmingLanguage: "TypeScript",
};

export const metadata: Metadata = {
  title: "Email infrastructure your agent owns | Wraps",
  description:
    "Give your agent a sender. Deploy AWS SES to your account in one command. Your domain, your reputation, your infra — the agent just sends.",
  openGraph: {
    title: "Email infrastructure your agent owns | Wraps",
    description:
      "Give your agent a sender. Deploy AWS SES to your account in one command. Your domain, your reputation, your infra — the agent just sends.",
    images: [
      {
        url: "/agents-og.webp",
        width: 1200,
        height: 630,
        alt: "Wraps for Agents — email infrastructure your agent owns",
      },
    ],
  },
  twitter: {
    title: "Email infrastructure your agent owns | Wraps",
    description:
      "Give your agent a sender. Deploy AWS SES to your account in one command. Your domain, your reputation, your infra — the agent just sends.",
    images: ["/agents-og.webp"],
  },
  alternates: {
    canonical: "https://wraps.dev/agents",
  },
};

export default function AgentsPage() {
  return (
    <>
      <JsonLd data={softwareSchema} />
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main>
          <AgentsHeroSection />
          <AgentsPromptSection />
          <AgentsWhyOwnSection />
          <AgentsRecipeSection />
          <AgentsTrustSection />
          <AgentsCtaSection />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
