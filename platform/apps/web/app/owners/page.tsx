import { Metadata } from 'next';
import { HeroSection } from '@/components/marketing/HeroSection';
import { FeaturePillars } from '@/components/marketing/FeaturePillars';
import { PopularFeatures } from '@/components/marketing/PopularFeatures';
import { SocialProof } from '@/components/marketing/SocialProof';
import { DemoCTA } from '@/components/marketing/DemoCTA';
import { Testimonials } from '@/components/marketing/Testimonials';
import { PricingPreview } from '@/components/marketing/PricingPreview';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Camp Everyday Host - Campground Management Software',
  description: 'The most powerful platform for campground and RV park owners. Streamline operations, boost revenue, and deliver exceptional guest experiences.',
  openGraph: {
    title: 'Camp Everyday Host - Campground Management Software',
    description: 'The most powerful platform for campground and RV park owners.',
    type: 'website',
  },
};

export default function OwnersPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <HeroSection />

      {/* Social Proof Bar */}
      <SocialProof />

      {/* Feature Pillars - 6 Core Categories */}
      <FeaturePillars />

      {/* Popular Features Showcase */}
      <section id="resources">
      <PopularFeatures />
      </section>

      {/* Testimonials */}
      <section id="about">
      <Testimonials />
      </section>

      {/* Pricing Preview */}
      <section id="pricing">
      <PricingPreview />
      </section>

      {/* Demo CTA */}
      <DemoCTA />

      {/* Footer */}
      <Footer />
    </div>
  );
}
