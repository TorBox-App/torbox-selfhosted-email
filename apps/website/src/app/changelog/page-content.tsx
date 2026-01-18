"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { ChangelogHeroSection } from "./components/hero-section";
import { ChangelogReleasesSection } from "./components/releases-section";

export default function ChangelogPageContent() {
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
