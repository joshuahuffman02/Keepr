import { Metadata } from 'next';
import { HeroSection } from '@/components/marketing/HeroSection';
import { WhySwitch } from '@/components/marketing/WhySwitch';
import { FeaturePillars } from '@/components/marketing/FeaturePillars';
import { PopularFeatures } from '@/components/marketing/PopularFeatures';
import { SocialProof } from '@/components/marketing/SocialProof';
import { DemoCTA } from '@/components/marketing/DemoCTA';
import { Testimonials } from '@/components/marketing/Testimonials';
import { PricingPreview } from '@/components/marketing/PricingPreview';
import { AiFeatures } from '@/components/marketing/AiFeatures';
import { Footer } from '@/components/marketing/Footer';


export const metadata: Metadata = {
  title: 'Camp Everyday - Modern Alternative to Campspot & Newbook',
  description: 'Tired of clunky legacy software? Camp Everyday is the modern reservation system for campgrounds and RV parks. No contracts, no hidden fees, go live in 48 hours.',
  openGraph: {
    title: 'Camp Everyday - Modern Alternative to Campspot & Newbook',
    description: 'Tired of clunky legacy software? The modern reservation system for campgrounds.',
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

      {/* Why Switch Section - Competitor Pain Points */}
      <WhySwitch />

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

      {/* AI Features */}
      <AiFeatures />

      {/* Demo CTA */}
      <DemoCTA />

      {/* Footer */}
      <Footer />
    </div>
  );
}
