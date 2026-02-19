import type { Metadata } from "next";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { ChangelogHeroSection } from "./components/hero-section";
import { ChangelogReleasesSection } from "./components/releases-section";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Latest updates, improvements, and releases for Wraps CLI, SDK, and Platform.",
  openGraph: {
    title: "Changelog | Wraps",
    description:
      "Latest updates, improvements, and releases for Wraps CLI, SDK, and Platform.",
  },
  twitter: {
    title: "Changelog | Wraps",
    description:
      "Latest updates, improvements, and releases for Wraps CLI, SDK, and Platform.",
  },
  alternates: {
    canonical: "https://wraps.dev/changelog",
  },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <ChangelogHeroSection />
        <ChangelogReleasesSection />
      </main>
      <LandingFooter />
    </div>
  );
}
