import { CliTabbedSection } from "./components/cli-tabbed-section";
import { CTASection } from "./components/cta-section";
import { FaqSection } from "./components/faq-section";
import { LandingFooter } from "./components/footer";
import { HeroSection } from "./components/hero-section";
import { LandingNavbar } from "./components/navbar";
import { PrinciplesSection } from "./components/principles-section";
import { ProductTabbedSection } from "./components/product-tabbed-section";
import { TrustedBySection } from "./components/trusted-by-section";
import { premiumBgClass, UpgradeSection } from "./components/upgrade-section";

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
