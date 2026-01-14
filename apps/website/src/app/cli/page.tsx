"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { CliCommandsSection } from "./components/commands-section";
import { CliConsoleSection } from "./components/console-section";
import { CliCtaSection } from "./components/cta-section";
import { CliHeroSection } from "./components/hero-section";
import { CliServicesSection } from "./components/services-section";

export default function CliPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <CliHeroSection />
        <CliServicesSection />
        <CliCommandsSection />
        <CliConsoleSection />
        <CliCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
