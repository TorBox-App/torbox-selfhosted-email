import { CliTabbedSection } from "./landing/components/cli-tabbed-section";
import { CTASection } from "./landing/components/cta-section";
import { FaqSection } from "./landing/components/faq-section";
import { LandingFooter } from "./landing/components/footer";
import { HeroSection } from "./landing/components/hero-section";
import { LandingNavbar } from "./landing/components/navbar";
import { PrinciplesSection } from "./landing/components/principles-section";
import { ProductTabbedSection } from "./landing/components/product-tabbed-section";
import { TrustedBySection } from "./landing/components/trusted-by-section";
import {
  premiumBgClass,
  UpgradeSection,
} from "./landing/components/upgrade-section";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main>
        {/* Hero & Credibility */}
        <HeroSection />
        <TrustedBySection />
        <PrinciplesSection />

        {/* Free Tier - CLI + SDK + Console */}
        <CliTabbedSection />

        {/* Transition to Premium */}
        <UpgradeSection />

        {/* Premium Tier - Wraps Platform */}
        <div className={premiumBgClass}>
          <ProductTabbedSection />
          <FaqSection />
          <CTASection />
        </div>
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
