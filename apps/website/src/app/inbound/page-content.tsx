"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { AnatomySection } from "./components/anatomy-section";
import { ArchitectureSection } from "./components/architecture-section";
import { CtaSection } from "./components/cta-section";
import { HeroSection } from "./components/hero-section";
import { PipelineSection } from "./components/pipeline-section";
import { SdkSection } from "./components/sdk-section";
import { UseCasesSection } from "./components/use-cases-section";

export default function InboundPageContent() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <HeroSection />
        <PipelineSection />
        <AnatomySection />
        <UseCasesSection />
        <SdkSection />
        <ArchitectureSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
