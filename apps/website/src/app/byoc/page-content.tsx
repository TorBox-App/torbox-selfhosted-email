"use client";

import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { ByocCtaSection } from "./components/cta-section";
import { ByocHeroSection } from "./components/hero-section";
import { LeavingSection } from "./components/leaving-section";
import { LivesWhereSection } from "./components/lives-where-section";
import { NoEnterpriseSection } from "./components/no-enterprise-section";
import { SyncsSection } from "./components/syncs-section";
import { WhatByocMeansSection } from "./components/what-byoc-means-section";
import { WhyByocSection } from "./components/why-byoc-section";

export default function ByocPageContent() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <ByocHeroSection />
        <WhatByocMeansSection />
        <LivesWhereSection />
        <WhyByocSection />
        <NoEnterpriseSection />
        <SyncsSection />
        <LeavingSection />
        <ByocCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
