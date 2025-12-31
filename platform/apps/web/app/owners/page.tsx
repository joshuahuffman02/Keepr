import { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
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
  title: 'Campground Management Software | Camp Everyday',
  description: 'The modern campground reservation software with AI-powered insights, guest loyalty programs, and integrated staff scheduling. $100/mo flat + $2.30/booking. No contracts. Go live in 48 hours.',
  keywords: [
    'campground management software',
    'rv park reservation system',
    'campground booking software',
    'campground reservation software',
    'rv park management system',
    'campground software with loyalty program',
    'rv park software with staff scheduling',
    'campground software with ai',
  ],
  openGraph: {
    title: 'Camp Everyday - Modern Campground Management Software',
    description: 'The all-in-one platform for campgrounds and RV parks. AI-powered insights, guest loyalty programs, and integrated staff scheduling. $100/mo + $2.30/booking.',
    type: 'website',
    images: [
      {
        url: '/images/og/owners-preview.png',
        width: 1200,
        height: 630,
        alt: 'Camp Everyday - Modern Campground Management Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Camp Everyday - Modern Campground Software',
    description: 'AI-powered insights, loyalty programs, and staff scheduling in one platform.',
  },
  alternates: {
    canonical: 'https://campeveryday.com/owners',
  },
};

export default function OwnersPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <MarketingHeader />

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
