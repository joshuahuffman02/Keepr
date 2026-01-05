import { Metadata } from 'next';
import { HeroSection } from '@/components/marketing/HeroSection';
import { FeaturePillars } from '@/components/marketing/FeaturePillars';
import { PopularFeatures } from '@/components/marketing/PopularFeatures';
import { SocialProof } from '@/components/marketing/SocialProof';
import { DemoCTA } from '@/components/marketing/DemoCTA';
import { Testimonials } from '@/components/marketing/Testimonials';
import { PricingPreview } from '@/components/marketing/PricingPreview';
import { Footer } from '@/components/marketing/Footer';
import { FAQSection } from '@/components/marketing/FAQSection';
import { FAQJsonLd } from '@/components/seo';

// Removed: WhySwitch (merged into FeaturePillars), AiFeatures (content was vague)

const ownerFaqs = [
  {
    question: "How long does it take to get started?",
    answer: "Most campgrounds go live within 48 hours. We provide DIY setup guides, and our team can import your existing data from any system for free. No lengthy implementation or training sessions required.",
  },
  {
    question: "What does the $100/month flat fee include?",
    answer: "Everything you need to run your campground: online reservations, guest portal, staff scheduling, maintenance ticketing, POS system, loyalty programs, and AI-powered insights. The only additional cost is $2.30 per booking.",
  },
  {
    question: "Can I pass booking fees to guests?",
    answer: "Yes. You have full control over fee pass-through. You can absorb the $2.30 booking fee yourself, pass it to guests, or split it. All plans include this flexibility.",
  },
  {
    question: "Do you lock me into a contract?",
    answer: "No contracts, ever. Pay month-to-month and cancel anytime. We also offer a 30-day money-back guarantee if you're not satisfied.",
  },
  {
    question: "Can I migrate from my current reservation system?",
    answer: "Yes. We offer free data import from any campground software including Campspot, CampLife, Newbook, RoverPass, and others. Your reservation history, guest records, and site configurations all transfer over.",
  },
  {
    question: "Do you take a commission on bookings?",
    answer: "No. Unlike marketplace platforms that take 10% or more, we charge zero commission. The $2.30 per booking is a flat fee regardless of your nightly rate.",
  },
  {
    question: "What kind of support do you offer?",
    answer: "All plans include email support with same-day response during business hours. The Pro plan adds live chat and priority phone support. We also have an extensive help center with tutorials and guides.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use bank-level encryption (256-bit SSL), are PCI-DSS compliant for payment processing, and host on SOC 2 certified infrastructure. Your data is backed up daily and never shared with third parties.",
  },
];


export const metadata: Metadata = {
  title: 'Campground Management Software | Keepr',
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
    title: 'Keepr - Modern Campground Management Software',
    description: 'The all-in-one platform for campgrounds and RV parks. AI-powered insights, guest loyalty programs, and integrated staff scheduling. $100/mo + $2.30/booking.',
    type: 'website',
    images: [
      {
        url: '/images/og/owners-preview.png',
        width: 1200,
        height: 630,
        alt: 'Keepr - Modern Campground Management Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Keepr - Modern Campground Software',
    description: 'AI-powered insights, loyalty programs, and staff scheduling in one platform.',
  },
  alternates: {
    canonical: 'https://keeprstay.com/owners',
  },
};

export default function OwnersPage() {
  return (
    <div className="min-h-screen bg-card">
      <FAQJsonLd faqs={ownerFaqs} />

      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Social Proof - Outcome-focused stats with animations */}
      <SocialProof />

      {/* 3. Feature Pillars - 6 Core Categories */}
      <FeaturePillars />

      {/* 4. Popular Features Showcase */}
      <section id="resources" className="scroll-mt-24">
        <PopularFeatures />
      </section>

      {/* 5. Early Access Benefits */}
      <section id="about" className="scroll-mt-24">
        <Testimonials />
      </section>

      {/* 6. Pricing - Waterfall tier system */}
      <PricingPreview />

      {/* 7. FAQ Section */}
      <FAQSection
        faqs={ownerFaqs}
        title="Frequently Asked Questions"
        subtitle="Everything you need to know about getting started with Keepr."
        className="bg-slate-50"
      />

      {/* 8. Demo CTA */}
      <DemoCTA />

      {/* 9. Footer */}
      <Footer />
    </div>
  );
}
