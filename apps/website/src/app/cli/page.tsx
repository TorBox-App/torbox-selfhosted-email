"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { CliConsoleSection } from "./components/console-section";
import { CliCtaSection } from "./components/cta-section";
import { CliFeaturesSection } from "./components/features-section";
import { CliHeroSection } from "./components/hero-section";
import { CliServicesSection } from "./components/services-section";

export default function CliPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <CliHeroSection />
        <CliServicesSection />
        <CliConsoleSection />
        <CliFeaturesSection />
        <CliCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
