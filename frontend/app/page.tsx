import { FeatureGrid } from '@/components/landing/feature-grid';
import { Footer } from '@/components/landing/footer';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingHero } from '@/components/landing/landing-hero';
import { SecuritySection } from '@/components/landing/security-section';

export default function LandingPage() {
  return (
    <main>
      <LandingHero />
      <FeatureGrid />
      <SecuritySection />
      <HowItWorks />
      <Footer />
    </main>
  );
}
